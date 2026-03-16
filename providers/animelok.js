/**
 * Animelok - Multi-Provider Ultra Fix
 * Support for: Kwik, Anvod, Netmag, Watching.onl
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
    const res = await fetch(`${BASE_URL}/search?keyword=${encodeURIComponent(query)}`, { headers: { "User-Agent": USER_AGENT } });
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
      const results = yield search(id);
      if (results.length > 0) slug = results[0].id;
    }

    try {
      // We target the internal API that feeds these specific CDNs
      const apiUrl = `${BASE_URL}/api/anime/${slug}/episodes/${episode}`;
      const response = yield fetch(apiUrl, {
        headers: {
          "Referer": `${BASE_URL}/watch/${slug}?ep=${episode}`,
          "User-Agent": USER_AGENT,
          "X-Requested-With": "XMLHttpRequest"
        }
      });

      const data = yield response.json();
      const servers = data.episode?.servers || data.servers || [];
      const streams = [];

      for (const s of servers) {
        let url = s.url || s.link;
        if (!url) continue;

        let name = s.name || "Provider";
        let headers = { "User-Agent": USER_AGENT, "Referer": BASE_URL };

        // DOMAIN SPECIFIC FIXES based on your findings
        if (url.includes("kwik.cx")) {
          name = "Kwik (Fast)";
          headers["Referer"] = "https://kwik.cx/";
        } else if (url.includes("anvod") || url.includes("anixl")) {
          name = "Anvod (HLS)";
          headers["Origin"] = BASE_URL;
        } else if (url.includes("netmagcdn")) {
          name = "Netmag (Direct)";
        } else if (url.includes("watching.onl")) {
          name = "Watching (Cloud)";
        }

        streams.push({
          name: `Animelok - ${name}`,
          url: url,
          type: url.includes(".m3u8") ? "hls" : "mp4",
          quality: "Auto",
          headers: headers
        });
      }

      return streams;
    } catch (e) {
      console.error("[Animelok] Script Error:", e.message);
      return [];
    }
  });
}

module.exports = { search, getStreams };
