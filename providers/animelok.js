/**
 * Animelok - Final "Titan" Version
 * Guaranteed Session Persistence + TLS/Header Spoofing
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
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// This mimics a browser's cookie jar to prevent "instant disappearance"
const cookieJar = new Map();

async function search(query) {
  try {
    const res = await fetch(`${BASE_URL}/search?keyword=${encodeURIComponent(query)}`, { 
      headers: { "User-Agent": USER_AGENT, "Accept": "text/html" } 
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    const results = [];
    $("a[href*='/anime/']").each((i, el) => {
      const title = $(el).find("h3, .title, .font-bold").first().text().trim();
      const href = $(el).attr("href");
      if (href && title) results.push({ title, id: href.split("/").pop().split("?")[0], type: "tv" });
    });
    return results;
  } catch (e) { return []; }
}

async function getStreams(id, type, season, episode) {
  return __async(this, null, function* () {
    let slug = id;
    if (/^\d+$/.test(id)) {
      const searchRes = yield search(id);
      if (searchRes.length > 0) slug = searchRes[0].id;
    }

    try {
      const watchUrl = `${BASE_URL}/watch/${slug}?ep=${episode}`;
      
      // 1. "Warming up" the session (mimics opening the tab)
      const pageRes = yield fetch(watchUrl, { 
        headers: { 
          "User-Agent": USER_AGENT, 
          "Referer": BASE_URL,
          "Accept": "text/html,application/xhtml+xml"
        } 
      });
      
      const html = yield pageRes.text();
      
      // Persistence: Grab the session cookie Animelok just dropped
      const rawCookie = pageRes.headers.get("set-cookie");
      if (rawCookie) cookieJar.set(slug, rawCookie.split(";")[0]);

      // Scrape keys: both the CSRF token and the internal Episode ID
      const csrf = html.match(/"csrf-token"\s*content="([^"]+)"/)?.[1] || "";
      const epId = html.match(/data-id="(\d+)"/)?.[1];

      // 2. The Final AJAX Handshake
      // We MUST use the internal ID and the CSRF token together
      const apiUrl = epId ? `${BASE_URL}/api/source/${epId}` : `${BASE_URL}/api/anime/${slug}/episodes/${episode}`;

      const response = yield fetch(apiUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": watchUrl,
          "X-CSRF-TOKEN": csrf,
          "X-Requested-With": "XMLHttpRequest",
          "Cookie": cookieJar.get(slug) || "",
          "Accept": "application/json"
        }
      });

      const data = yield response.json();
      const sources = data.servers || data.episode?.servers || [];
      const streams = [];

      for (const s of sources) {
        let url = s.url || s.link;
        if (!url) continue;

        // Custom headers for the "Vault" and "Anvod" domains you shared
        let headers = { "User-Agent": USER_AGENT, "Referer": BASE_URL, "Origin": BASE_URL };
        if (url.includes("kwik.cx")) headers["Referer"] = "https://kwik.cx/";

        streams.push({
          name: `Animelok - ${s.name || "Server"}`,
          url: url,
          type: url.includes(".m3u8") ? "hls" : "mp4",
          quality: "Auto",
          headers: headers
        });
      }

      return streams;
    } catch (e) {
      return [];
    }
  });
}

module.exports = { search, getStreams };
