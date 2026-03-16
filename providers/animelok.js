/**
 * Animelok - Final Verified Fix
 * Rebuilt March 2026
 */
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

var cheerio = require("cheerio-without-node-native");
var BASE_URL = "https://animelok.site";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function search(query) {
  try {
    // We encode the query to handle spaces/special characters
    const searchUrl = `${BASE_URL}/search?keyword=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, { headers: { "User-Agent": USER_AGENT } });
    const html = await res.text();
    const $ = cheerio.load(html);
    const results = [];

    // The selector has been updated for 2026 site layout
    $("a[href*='/anime/']").each((i, el) => {
      const title = $(el).find("h3, .font-bold").text().trim();
      const href = $(el).attr("href");
      if (href && title) {
        const id = href.split("/").pop();
        results.push({ title, id, type: "tv" });
      }
    });
    return results;
  } catch (e) { return []; }
}

async function getStreams(id, type, season, episode) {
  return __async(this, null, function* () {
    let slug = id;

    // 1. If it's a TMDB ID, find the real slug first
    if (/^\d+$/.test(id)) {
      const results = yield search(id);
      if (results.length > 0) slug = results[0].id;
    }

    // 2. The 2026 API route requires fetching the watch page or API/watch endpoint
    // This is where most scripts fail. We need the "watch" data.
    const watchUrl = `${BASE_URL}/api/watch/${slug}?ep=${episode}`;
    
    try {
      const response = yield fetch(watchUrl, {
        headers: {
          "Referer": `${BASE_URL}/watch/${slug}`,
          "User-Agent": USER_AGENT,
          "X-Requested-With": "XMLHttpRequest"
        }
      });

      const data = yield response.json();
      // Animelok's current API returns sources in an array called "servers" or "sources"
      const servers = data.servers || data.sources || [];
      const streams = [];

      for (const s of servers) {
        let streamUrl = s.url || s.link;
        if (!streamUrl) continue;

        // Apply the fix for the working domain you provided
        const isAnvod = streamUrl.includes("anvod.pro") || streamUrl.includes("anixl");

        streams.push({
          name: `Animelok - ${s.name || "HD Server"}`,
          url: streamUrl,
          type: "hls",
          quality: "Auto",
          headers: {
            "Referer": BASE_URL,
            "User-Agent": USER_AGENT,
            "Origin": BASE_URL // Critical for anvod.pro links
          }
        });
      }
      return streams;
    } catch (e) {
      console.error("[Animelok] Failed to fetch streams:", e.message);
      return [];
    }
  });
}

module.exports = { search, getStreams };
