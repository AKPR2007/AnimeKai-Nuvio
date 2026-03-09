const axios = require("axios");
const crypto = require("crypto");

const API = "https://api3.devcorp.me"; // base URL from OneTouchTV.kt

// AES key/IV from Decryption.kt
const keyHex = Buffer.from(
  "Njk2ZDM3MzI2MzY4NjE3MjUwNjE3MzczNzc2ZjcyNjQ2ZjY2NjQ0OTZlNjk3NDU2NjU2Mzc0NmY3MjUzNzQ2ZA==",
  "base64"
).toString();

const ivHex = Buffer.from(
  "Njk2ZDM3MzI2MzY4NjE3MjUwNjE3MzczNzc2ZjcyNjQ=",
  "base64"
).toString();

function hexToBytes(hex) {
  return Buffer.from(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
}

const key = hexToBytes(keyHex);
const iv = hexToBytes(ivHex);

function normalize(input) {
  return input.replace(/-\_\./g, "/").replace(/@/g, "+").replace(/\s+/g, "");
}

function decryptString(input) {
  try {
    const normalized = normalize(input);
    let base64 = normalized;
    const pad = base64.length % 4;
    if (pad !== 0) base64 += "=".repeat(4 - pad);
    const encrypted = Buffer.from(base64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    const json = JSON.parse(decrypted.toString());
    return json.result;
  } catch (e) {
    console.error("Decrypt error:", e);
    return null;
  }
}

// Parse sources & subtitles like OneTouchTVParser.kt
function parseSourcesAndTracks(data) {
  const sourcesList = [];
  const tracksList = [];

  if (!data) return { sourcesList, tracksList };

  const result = data.result || data;

  if (result.sources && Array.isArray(result.sources)) {
    for (const s of result.sources) {
      if (!s.url) continue;
      sourcesList.push({
        name: s.name || "Server",
        url: s.url,
        quality: s.quality || "Auto",
        headers: s.headers || { referer: API },
      });
    }
  }

  const tracksArray = result.track || result.tracks;
  if (tracksArray && Array.isArray(tracksArray)) {
    for (const t of tracksArray) {
      if (!t.file) continue;
      tracksList.push({
        file: t.file,
        name: t.name || "Subtitle",
      });
    }
  }

  return { sourcesList, tracksList };
}

async function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  try {
    // 1️⃣ Fetch TMDB title
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=b030404650f279792a8d3287232358e3`;
    const tmdbRes = await axios.get(tmdbUrl);
    const title = tmdbRes.data.title || tmdbRes.data.name || tmdbRes.data.original_title;

    // 2️⃣ Search OneTouchTV
    const searchUrl = `${API}/vod/search?page=1&keyword=${encodeURIComponent(title)}`;
    const searchRes = await axios.get(searchUrl, { headers: { referer: API } });
    const searchData = decryptString(searchRes.data);
    if (!searchData || searchData.length === 0) return [];

    let series = searchData.find(item => item.title.toLowerCase() === title.toLowerCase());
    if (!series) series = searchData[0];
    if (!series) return [];

    // 3️⃣ Get detail
    const detailUrl = `${API}/vod/${series.id}/detail`;
    const detailRes = await axios.get(detailUrl, { headers: { referer: API } });
    const detailData = decryptString(detailRes.data);
    if (!detailData || !detailData.episodes) return [];

    // 4️⃣ Find target episode
    let ep;
    if (mediaType === "movie") {
      ep = detailData.episodes[detailData.episodes.length - 1];
    } else {
      ep = detailData.episodes.find(e => parseInt(e.episode) === parseInt(episodeNum));
    }
    if (!ep) return [];

    // 5️⃣ Fetch episode sources
    const episodeUrl = `${API}/vod/${ep.identifier}/episode/${ep.playId}`;
    const epRes = await axios.get(episodeUrl, { headers: { referer: API } });
    const epData = decryptString(epRes.data);
    if (!epData) return [];

    const { sourcesList, tracksList } = parseSourcesAndTracks(epData);

    // 6️⃣ Map streams with subtitles
    const streams = sourcesList.map(s => ({
      name: s.name,
      title: series.title,
      url: s.url,
      quality: s.quality,
      headers: s.headers,
      provider: "OneTouchTV",
      subtitles: tracksList,
    }));

    return streams;
  } catch (e) {
    console.error("OneTouchTV Error:", e);
    return [];
  }
}

// ✅ Nuvio provider export
module.exports = {
  id: "onetouchtv",
  name: "OneTouchTV",
  type: "tv",
  supportedTypes: ["Movie", "TvSeries", "AsianDrama", "Anime"],
  hasMainPage: true,
  hasDownloadSupport: true,
  mainPageSections: ["Home", "Trending", "New"],
  getStreams
};
