
const cheerio = require("cheerio");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

async function makeRequest(url){
  return fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }});
}

// Extract download links from movie page
async function extractDownloadLinks(movieUrl, targetYear = null) {
  try {
    const response = await makeRequest(movieUrl);
    const html = await response.text();

    const links = [];
    const $ = cheerio.load(html);
    const movieTitle = $("h1").first().text().trim();

    $("a").each((index, element) => {
      const link = $(element).attr("href");
      if (!link) return;

      const lower = link.toLowerCase();

      if (
        lower.includes("drive") ||
        lower.includes("gdtot") ||
        lower.includes("hubcloud") ||
        lower.includes("pixeldrain") ||
        lower.includes("tech.") ||
        lower.includes("video-seed") ||
        lower.includes("video-leech") ||
        lower.includes("/goto/") ||
        lower.includes("/download/")
      ) {
        if (links.some(item => item.url === link)) return;

        let quality = "Unknown";
        let size = "Unknown";

        const blockText = $(element).closest("p, li, div").text();

        const sizeMatch = blockText.match(/\b([0-9.]+\s?(GB|MB))\b/i);
        if (sizeMatch) size = sizeMatch[1];

        const qualityMatch = blockText.match(/\b(2160p|1080p|720p|480p|4K)\b/i);
        if (qualityMatch) quality = qualityMatch[1];

        if (quality === "Unknown") {
          const prev = $(element).closest("p, div, li").prev();
          if (prev.length) {
            const prevText = prev.text();
            const q = prevText.match(/\b(2160p|1080p|720p|480p|4K)\b/i);
            if (q) quality = q[1];
          }
        }

        links.push({
          title: movieTitle,
          url: link.startsWith("http") ? link : new URL(link, movieUrl).href,
          quality,
          size
        });
      }
    });

    return links;

  } catch (error) {
    console.error("Extraction failed:", error.message);
    return [];
  }
}

// Main function Nuvio calls
async function getStreams(movie) {
  try {
    const results = await extractDownloadLinks(movie.url, movie.year);

    return results.map(link => ({
      name: "UHDMovies",
      title: `${link.quality} ${link.size}`,
      url: link.url,
      isDirect: false
    }));

  } catch (e) {
    console.error("getStreams error:", e);
    return [];
  }
}

module.exports = { getStreams };
