// xprime.js

const WORKING_HEADERS = {
  Referer: "https://xprime.tv/",
  Origin: "https://xprime.tv",
  "User-Agent": "Mozilla/5.0"
};

async function getStreams({ tmdbId, type, season, episode }) {
  try {
    // Get turnstile token
    const tokenRes = await fetch("https://enc-dec.app/api/enc-xprime");
    const tokenJson = await tokenRes.json();
    const token = tokenJson.result;

    let url = "";
    if (type === "movie") {
      url = `https://backend.xprime.tv/rage?id=${tmdbId}&turnstile=${token}`;
    } else if (type === "tv") {
      url = `https://backend.xprime.tv/rage?id=${tmdbId}&season=${season}&episode=${episode}&turnstile=${token}`;
    }

    const res = await fetch(url, { headers: WORKING_HEADERS });
    const data = await res.json();

    if (!data || !data.streams) return [];

    // Map streams to Nuvio format
    return data.streams.map(stream => ({
      provider: "xprime",
      name: `Xprime - ${stream.quality || "Stream"}`,
      title: stream.quality || "Stream",
      url: stream.url,
      headers: WORKING_HEADERS,
      type: "VIDEO"
    }));
  } catch (err) {
    console.error("Xprime error", err);
    return [];
  }
}

// Export for Node/Nuvio
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.XprimeScraperModule = { getStreams };
}
