/**
 * onetouchtv provider
 */

var axios = require("axios");
var cheerio = require("cheerio-without-node-native");

const BASE = "https://onetouchtv.xyz";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  Referer: BASE
};

function formatTitle(title, quality, season, episode) {
  const s = String(season || 1).padStart(2, "0");
  const e = String(episode || 1).padStart(2, "0");
  const ep = season ? ` S${s}E${e}` : "";

  return `OneTouchTV (${quality})
📺 ${title}${ep}`;
}

async function search(title) {
  try {
    const url = `${BASE}/?s=${encodeURIComponent(title)}`;

    const res = await axios.get(url, { headers: HEADERS });

    const $ = cheerio.load(res.data);

    const results = [];

    $("article a").each((i, el) => {
      const link = $(el).attr("href");

      if (link && link.includes(BASE)) {
        results.push(link);
      }
    });

    return [...new Set(results)];
  } catch (e) {
    return [];
  }
}

async function extractFromHtml(html) {
  const streams = [];

  // direct m3u8
  const direct = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  if (direct) streams.push(...direct);

  // mp4 fallback
  const mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/g);
  if (mp4) streams.push(...mp4);

  return [...new Set(streams)];
}

async function extractStream(pageUrl) {
  try {
    const res = await axios.get(pageUrl, { headers: HEADERS });

    const html = res.data;

    const streams = await extractFromHtml(html);

    if (streams.length) return streams;

    const $ = cheerio.load(html);

    // check iframe players
    const iframes = [];

    $("iframe").each((i, el) => {
      const src = $(el).attr("src");
      if (src) iframes.push(src);
    });

    for (const iframe of iframes) {
      try {
        const frame = await axios.get(iframe, { headers: HEADERS });

        const frameStreams = await extractFromHtml(frame.data);

        if (frameStreams.length) return frameStreams;
      } catch (e) {}
    }

    return [];
  } catch (e) {
    return [];
  }
}

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    const title = typeof tmdbId === "string" ? tmdbId : "Stream";

    const results = await search(title);

    if (!results.length) return [];

    const page = results[0];

    const links = await extractStream(page);

    if (!links.length) return [];

    const streams = [];

    links.forEach((link) => {
      streams.push({
        name: "OneTouchTV",
        title: formatTitle(title, "1080p", season, episode),
        url: link,
        quality: "1080p",
        type: link.includes(".m3u8") ? "hls" : "mp4",
        headers: HEADERS,
        provider: "OneTouchTV"
      });
    });

    return streams;
  } catch (e) {
    console.log("[OneTouchTV] error", e.message);
    return [];
  }
}

module.exports = { getStreams };
