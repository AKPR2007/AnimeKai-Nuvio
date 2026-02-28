const axios = require('axios');
const cheerio = require('cheerio');
const { URLSearchParams, URL } = require('url');
const FormData = require('form-data');
const { CookieJar } = require('tough-cookie');
const fs = require('fs').promises;
const path = require('path');
const RedisCache = require('../utils/redisCache');
const { followRedirectToFilePage, extractFinalDownloadFromFilePage } = require('../utils/linkResolver');

// Debug logging flag - set DEBUG=true to enable verbose logging
const DEBUG = process.env.DEBUG === 'true' || process.env.UHDMOVIES_DEBUG === 'true';
const log = DEBUG ? console.log : () => { };
const logWarn = DEBUG ? console.warn : () => { };

// Dynamic import for axios-cookiejar-support
let axiosCookieJarSupport = null;
const getAxiosCookieJarSupport = async () => {
  if (!axiosCookieJarSupport) {
    axiosCookieJarSupport = await import('axios-cookiejar-support');
  }
  return axiosCookieJarSupport;
};

// --- Proxy Configuration ---
const UHDMOVIES_PROXY_URL = process.env.UHDMOVIES_PROXY_URL;
if (UHDMOVIES_PROXY_URL) {
  log(`[UHDMovies] Proxy support enabled: ${UHDMOVIES_PROXY_URL}`);
} else {
  log('[UHDMovies] No proxy configured, using direct connections');
}

// --- Domain Fetching ---
let uhdMoviesDomain = 'https://uhdmovies.email'; // Fallback domain
let domainCacheTimestamp = 0;
const DOMAIN_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

async function getUHDMoviesDomain() {
  const now = Date.now();
  if (now - domainCacheTimestamp < DOMAIN_CACHE_TTL) {
    return uhdMoviesDomain;
  }

  try {
    log('[UHDMovies] Fetching latest domain...');
    const response = await makeRequest('https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json', { timeout: 10000 });
    if (response.data && response.data.UHDMovies) {
      uhdMoviesDomain = response.data.UHDMovies;
      domainCacheTimestamp = now;
      log(`[UHDMovies] Updated domain to: ${uhdMoviesDomain}`);
    } else {
      logWarn('[UHDMovies] Domain JSON fetched, but "UHDMovies" key was not found. Using fallback.');
    }
  } catch (error) {
    console.error(`[UHDMovies] Failed to fetch latest domain, using fallback. Error: ${error.message}`);
  }
  return uhdMoviesDomain;
}

// Constants
const TMDB_API_KEY_UHDMOVIES = "439c478a771f35c05022f9feabcca01c"; // Public TMDB API key

// --- Caching Configuration ---
const CACHE_ENABLED = process.env.DISABLE_CACHE !== 'true'; // Set to true to disable caching for this provider
log(`[UHDMovies] Internal cache is ${CACHE_ENABLED ? 'enabled' : 'disabled'}.`);
const CACHE_DIR = process.env.VERCEL ? path.join('/tmp', '.uhd_cache') : path.join(__dirname, '.cache', 'uhdmovies'); // Cache directory inside providers/uhdmovies

// Initialize Redis cache
const redisCache = new RedisCache('UHDMovies');

// --- Caching Helper Functions ---
const ensureCacheDir = async () => {
  if (!CACHE_ENABLED) return;
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.error(`[UHDMovies Cache] Error creating cache directory: ${error.message}`);
    }
  }
};

const getFromCache = async (key) => {
  if (!CACHE_ENABLED) return null;

  // Try Redis cache first, then fallback to file system
  const cachedData = await redisCache.getFromCache(key, '', CACHE_DIR);
  if (cachedData) {
    return cachedData.data || cachedData; // Support both new format (data field) and legacy format
  }

  return null;
};

const saveToCache = async (key, data) => {
  if (!CACHE_ENABLED) return;

  const cacheData = {
    data: data
  };

  // Save to both Redis and file system
  await redisCache.saveToCache(key, cacheData, '', CACHE_DIR);
};

// Initialize cache directory on startup
ensureCacheDir();

// Configure axios with headers to mimic a browser
// Configure axios instance with optional proxy support
const createAxiosInstance = () => {
  const config = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0'
    },
    timeout: 30000
  };

  // Add proxy configuration if UHDMOVIES_PROXY_URL is set
  if (UHDMOVIES_PROXY_URL) {
    log(`[UHDMovies] Using proxy: ${UHDMOVIES_PROXY_URL}`);
    // For proxy URLs that expect the destination URL as a parameter
    config.transformRequest = [(data, headers) => {
      return data;
    }];
  }

  return axios.create(config);
};

const axiosInstance = createAxiosInstance();

// Proxy wrapper function
const makeRequest = async (url, options = {}) => {
  if (UHDMOVIES_PROXY_URL) {
    // Route through proxy
    const proxiedUrl = `${UHDMOVIES_PROXY_URL}${encodeURIComponent(url)}`;
    log(`[UHDMovies] Making proxied request to: ${url}`);
    return axiosInstance.get(proxiedUrl, options);
  } else {
    // Direct request
    log(`[UHDMovies] Making direct request to: ${url}`);
    return axiosInstance.get(url, options);
  }
};

// Simple In-Memory Cache
const uhdMoviesCache = {
  search: {},
  movie: {},
  show: {}
};

// Function to search for movies
async function searchMovies(query) {
  try {
    const baseUrl = await getUHDMoviesDomain();
    log(`[UHDMovies] Searching for: ${query}`);
    const searchUrl = `${baseUrl}/search/${encodeURIComponent(query)}`;

    const response = await makeRequest(searchUrl);
    const $ = cheerio.load(response.data);

    const searchResults = [];

    // New logic for grid-based search results
    $('article.gridlove-post').each((index, element) => {
      const linkElement = $(element).find('a[href*="/download-"]');
      if (linkElement.length > 0) {
        const link = linkElement.first().attr('href');
        // Prefer the 'title' attribute, fallback to h1 text
        const title = linkElement.first().attr('title') || $(element).find('h1.sanket').text().trim();

        if (link && title && !searchResults.some(item => item.link === link)) {
          searchResults.push({
            title,
            link: link.startsWith('http') ? link : `${baseUrl}${link}`
          });
        }
      }
    });

    // Fallback for original list-based search if new logic fails
    if (searchResults.length === 0) {
      log('[UHDMovies] Grid search logic found no results, trying original list-based logic...');
      $('a[href*="/download-"]').each((index, element) => {
        const link = $(element).attr('href');
        // Avoid duplicates by checking if link already exists in results
        if (link && !searchResults.some(item => item.link === link)) {
          const title = $(element).text().trim();
          if (title) {
            searchResults.push({
              title,
              link: link.startsWith('http') ? link : `${baseUrl}${link}`
            });
          }
        }
      });
    }

    log(`[UHDMovies] Found ${searchResults.length} results`);
    return searchResults;
  } catch (error) {
    console.error(`[UHDMovies] Error searching movies: ${error.message}`);
    return [];
  }
}

// Function to extract clean quality information from verbose text
function extractCleanQuality(fullQualityText) {
  if (!fullQualityText || fullQualityText === 'Unknown Quality') {
    return 'Unknown Quality';
  }

  const cleanedFullQualityText = fullQualityText.replace(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g, '').trim();
  const text = cleanedFullQualityText.toLowerCase();
  let quality = [];

  // Extract resolution
  if (text.includes('2160p') || text.includes('4k')) {
    quality.push('4K');
  } else if (text.includes('1080p')) {
    quality.push('1080p');
  } else if (text.includes('720p')) {
    quality.push('720p');
  } else if (text.includes('480p')) {
    quality.push('480p');
  }

  // Extract special features
  if (text.includes('hdr')) {
    quality.push('HDR');
  }
  if (text.includes('dolby vision') || text.includes('dovi') || /\bdv\b/.test(text)) {
    quality.push('DV');
  }
  if (text.includes('imax')) {
    quality.push('IMAX');
  }
  if (text.includes('bluray') || text.includes('blu-ray')) {
    quality.push('BluRay');
  }

  // If we found any quality indicators, join them
  if (quality.length > 0) {
    return quality.join(' | ');
  }

  // Fallback: try to extract a shorter version of the original text
  // Look for patterns like "Movie Name (Year) Resolution ..."
  const patterns = [
    /(\d{3,4}p.*?(?:x264|x265|hevc).*?)[\[\(]/i,
    /(\d{3,4}p.*?)[\[\(]/i,
    /((?:720p|1080p|2160p|4k).*?)$/i
  ];

  for (const pattern of patterns) {
    const match = cleanedFullQualityText.match(pattern);
    if (match && match[1].trim().length < 100) {
      return match[1].trim().replace(/x265/ig, 'HEVC');
    }
  }

  // Final fallback: truncate if too long
  if (cleanedFullQualityText.length > 80) {
    return cleanedFullQualityText.substring(0, 77).replace(/x265/ig, 'HEVC') + '...';
  }

  return cleanedFullQualityText.replace(/x265/ig, 'HEVC');
}

// Function to extract download links for TV shows from a page
async function extractTvShowDownloadLinks(showPageUrl, season, episode) {
  try {
    log(`[UHDMovies] Extracting TV show links from: ${showPageUrl} for S${season}E${episode}`);
    const response = await makeRequest(showPageUrl);
    const $ = cheerio.load(response.data);

    const showTitle = $('h1').first().text().trim();
    const downloadLinks = [];

    // --- NEW LOGIC TO SCOPE SEARCH TO THE CORRECT SEASON ---
    let inTargetSeason = false;
    let qualityText = '';

    $('.entry-content').find('*').each((index, element) => {
      const $el = $(element);
      const text = $el.text().trim();
      const seasonMatch = text.match(/^SEASON\s+(\d+)/i);

      // Check if we are entering a new season block
      if (seasonMatch) {
        const currentSeasonNum = parseInt(seasonMatch[1], 10);
        if (currentSeasonNum == season) {
          inTargetSeason = true;
          log(`[UHDMovies] Entering Season ${season} block.`);
        } else if (inTargetSeason) {
          // We've hit the next season, so we stop.
          log(`[UHDMovies] Exiting Season ${season} block, now in Season ${currentSeasonNum}.`);
          inTargetSeason = false;
          return false; // Exit .each() loop
        }
      }

      if (inTargetSeason) {
        // This element is within the correct season's block.

        // Is this a quality header? (e.g., a <pre> or a <p> with <strong>)
        // It often contains resolution, release group, etc.
        const isQualityHeader = $el.is('pre, p:has(strong), p:has(b), h3, h4');
        if (isQualityHeader) {
          const headerText = $el.text().trim();
          // Filter out irrelevant headers. We can be more aggressive here.
          if (headerText.length > 5 && !/plot|download|screenshot|trailer|join|powered by|season/i.test(headerText) && !($el.find('a').length > 0)) {
            qualityText = headerText; // Store the most recent quality header
          }
        }

        // Is this a paragraph with episode links?
        if ($el.is('p') && $el.find('a[href*="tech.unblockedgames.world"], a[href*="tech.examzculture.in"]').length > 0) {
          const linksParagraph = $el;
          const episodeRegex = new RegExp(`^Episode\\s+0*${episode}(?!\\d)`, 'i');
          const targetEpisodeLink = linksParagraph.find('a').filter((i, el) => {
            return episodeRegex.test($(el).text().trim());
          }).first();

          if (targetEpisodeLink.length > 0) {
            const link = targetEpisodeLink.attr('href');
            if (link && !downloadLinks.some(item => item.link === link)) {
              const sizeMatch = qualityText.match(/\[\s*([0-9.,]+\s*[KMGT]B)/i);
              const size = sizeMatch ? sizeMatch[1] : 'Unknown';

              const cleanQuality = extractCleanQuality(qualityText);
              const rawQuality = qualityText.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, ' ').trim();

              log(`[UHDMovies] Found match: Quality='${qualityText}', Link='${link}'`);
              downloadLinks.push({ quality: cleanQuality, size: size, link: link, rawQuality: rawQuality });
            }
          }
        }

        // --- ENHANCED: Check for maxbutton-gdrive-episode structure ---
        if ($el.is('p') && $el.find('a.maxbutton-gdrive-episode').length > 0) {
          const episodeRegex = new RegExp(`^Episode\\s+0*${episode}(?!\\d)`, 'i');
          const targetEpisodeLink = $el.find('a.maxbutton-gdrive-episode').filter((i, el) => {
            const episodeText = $(el).find('.mb-text').text().trim();
            return episodeRegex.test(episodeText);
          }).first();

          if (targetEpisodeLink.length > 0) {
            const link = targetEpisodeLink.attr('href');
            if (link && !downloadLinks.some(item => item.link === link)) {
              const sizeMatch = qualityText.match(/\[\s*([0-9.,]+\s*[KMGT]B)/i);
              const size = sizeMatch ? sizeMatch[1] : 'Unknown';

              const cleanQuality = extractCleanQuality(qualityText);
              const rawQuality = qualityText.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, ' ').trim();

              log(`[UHDMovies] Found match (maxbutton): Quality='${qualityText}', Link='${link}'`);
              downloadLinks.push({ quality: cleanQuality, size: size, link: link, rawQuality: rawQuality });
            }
          }
        }
      }
    });

    if (downloadLinks.length === 0) {
      log('[UHDMovies] Main extraction logic failed. Checking if requested season exists on page before fallback.');

      // Check if the requested season exists on the page at all
      let seasonExists = false;
      let actualSeasonsOnPage = new Set(); // Track what seasons actually have content

      // First pass: Look for actual episode content to see what seasons are available
      $('.entry-content').find('a[href*="tech.unblockedgames.world"], a[href*="tech.examzculture.in"], a.maxbutton-gdrive-episode').each((index, element) => {
        const $el = $(element);
        const linkText = $el.text().trim();
        const episodeText = $el.find('.mb-text').text().trim() || linkText;

        // Look for season indicators in episode links
        const seasonMatches = [
          episodeText.match(/S(\d{1,2})/i), // S01, S02, etc.
          episodeText.match(/Season\s+(\d+)/i), // Season 1, Season 2, etc.
          episodeText.match(/S(\d{1,2})E(\d{1,3})/i) // S01E01 format
        ];

        for (const match of seasonMatches) {
          if (match && match[1]) {
            const foundSeason = parseInt(match[1], 10);
            actualSeasonsOnPage.add(foundSeason);
          }
        }
      });

      log(`[UHDMovies] Actual seasons found on page: ${Array.from(actualSeasonsOnPage).sort((a, b) => a - b).join(', ')}`);

      // Check if requested season is in the actual content
      if (actualSeasonsOnPage.has(season)) {
        seasonExists = true;
        log(`[UHDMovies] Season ${season} confirmed to exist in actual episode content`);
      } else {
        // Fallback: Check page descriptions/titles for season mentions
        $('.entry-content').find('*').each((index, element) => {
          const $el = $(element);
          const text = $el.text().trim();
          // Match various season formats: "SEASON 2", "Season 2", "(Season 1 – 2)", "Season 1-2", etc.
          const seasonMatches = [
            text.match(/^SEASON\s+(\d+)/i),
            text.match(/\bSeason\s+(\d+)/i),
            text.match(/\(Season\s+\d+\s*[–-]\s*(\d+)\)/i), // Matches "(Season 1 – 2)"
            text.match(/Season\s+\d+\s*[–-]\s*(\d+)/i), // Matches "Season 1-2"
            text.match(/\bS(\d+)/i) // Matches "S2", "S02", etc.
          ];

          for (const match of seasonMatches) {
            if (match) {
              const currentSeasonNum = parseInt(match[1], 10);
              if (currentSeasonNum == season) {
                seasonExists = true;
                log(`[UHDMovies] Season ${season} found in page description: "${text.substring(0, 100)}..."`);
                return false; // Exit .each() loop
              }
              // For range formats like "Season 1 – 2", check if requested season is in range
              if (match[0].includes('–') || match[0].includes('-')) {
                const rangeMatch = match[0].match(/Season\s+(\d+)\s*[–-]\s*(\d+)/i);
                if (rangeMatch) {
                  const startSeason = parseInt(rangeMatch[1], 10);
                  const endSeason = parseInt(rangeMatch[2], 10);
                  if (season >= startSeason && season <= endSeason) {
                    seasonExists = true;
                    log(`[UHDMovies] Season ${season} found in range ${startSeason}-${endSeason} in page description`);
                    return false; // Exit .each() loop
                  }
                }
              }
            }
          }
        });
      }

      if (!seasonExists) {
        log(`[UHDMovies] Season ${season} not found on page. Available seasons may not include the requested season.`);
        // Don't use fallback if the season doesn't exist to avoid wrong episodes
        return { title: showTitle, links: [], seasonNotFound: true };
      }

      log(`[UHDMovies] Season ${season} exists on page but episode extraction failed. Trying fallback method with season filtering.`);

      // --- ENHANCED FALLBACK LOGIC FOR NEW HTML STRUCTURE ---
      // Try the new maxbutton-gdrive-episode structure first
      $('.entry-content').find('a.maxbutton-gdrive-episode').each((i, el) => {
        const linkElement = $(el);
        const episodeText = linkElement.find('.mb-text').text().trim();
        const episodeRegex = new RegExp(`^Episode\\s+0*${episode}(?!\\d)`, 'i');

        if (episodeRegex.test(episodeText)) {
          const link = linkElement.attr('href');
          if (link && !downloadLinks.some(item => item.link === link)) {
            let qualityText = 'Unknown Quality';

            // Look for quality info in the preceding paragraph or heading
            const parentP = linkElement.closest('p, div');
            const prevElement = parentP.prev();
            if (prevElement.length > 0) {
              const prevText = prevElement.text().trim();
              if (prevText && prevText.length > 5 && !prevText.toLowerCase().includes('download')) {
                qualityText = prevText;
              }
            }

            // Check if this episode belongs to the correct season
            // Enhanced season check - look for various season formats
            const seasonCheckRegexes = [
              new RegExp(`\\.S0*${season}[\\.]`, 'i'),  // .S01.
              new RegExp(`S0*${season}[\\.]`, 'i'),     // S01.
              new RegExp(`S0*${season}\\b`, 'i'),       // S01 (word boundary)
              new RegExp(`Season\\s+0*${season}\\b`, 'i'), // Season 1
              new RegExp(`S0*${season}`, 'i')           // S01 anywhere
            ];

            const seasonMatch = seasonCheckRegexes.some(regex => regex.test(qualityText));
            if (!seasonMatch) {
              log(`[UHDMovies] Skipping episode from different season: Quality='${qualityText}'`);
              return; // Skip this episode as it's from a different season
            }

            const sizeMatch = qualityText.match(/\[([0-9.,]+[KMGT]B[^\]]*)\]/i);
            const size = sizeMatch ? sizeMatch[1] : 'Unknown';
            const cleanQuality = extractCleanQuality(qualityText);
            const rawQuality = qualityText.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, ' ').trim();

            log(`[UHDMovies] Found match via enhanced fallback (maxbutton): Quality='${qualityText}', Link='${link}'`);
            downloadLinks.push({ quality: cleanQualit
