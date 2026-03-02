const cheerio = require('cheerio');
const fetch = require('node-fetch');

// Request helper
async function makeRequest(url) {
  return fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'text/html',
      'Referer': 'https://uhdmovies.loan/'
    }
  });
}

// Extract quality text
function extractCleanQuality(text) {
  const match = text.match(/\b(2160p|4K|1080p|720p|480p|HD|UHD)\b/i);
  return match ? match[1] : 'Unknown Quality';
}

// Extract download links from movie page
async function extractDownloadLinks(movieUrl) {
  try {
    console.log(`[UHDMovies] Opening: ${movieUrl}`);

    const response = await makeRequest(movieUrl);
    const html = await response.text();

    const $ = cheerio.load(html);
    const links = [];

    const movieTitle = $('h1').first().text().trim();

    $('a').each((index, element) => {
      const link = $(element).attr('href');
      if (!link) return;

      if (
        link.includes('drive') ||
        link.includes('gdtot') ||
        link.includes('hubcloud') ||
        link.includes('pixeldrain') ||
        link.includes('tech') ||
        link.includes('download') ||
        link.includes('video-seed') ||
        link.includes('video-leech')
      ) {

        if (!links.some(item => item.url === link)) {

          const parentText = $(element).closest('p, div, li').text();

          let size = 'Unknown';
          const sizeMatch = parentText.match(/\b([0-9.]+\s?(GB|MB))\b/i);
          if (sizeMatch) size = sizeMatch[1];

          const quality = extractCleanQuality(parentText);

          links.push({
            title: movieTitle,
            url: link,
            quality: quality,
            size: size
          });

        }
      }
    });

    console.log(`[UHDMovies] Found ${links.length} links`);
    return links;

  } catch (err) {
    console.error('[UHDMovies] Error:', err.message);
    return [];
  }
}


// Test run
(async () => {

  const url = 'https://uhdmovies.loan/';

  const results = await extractDownloadLinks(url);

  console.log(results);

})();


module.exports = { extractDownloadLinks };
