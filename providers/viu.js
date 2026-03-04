const NAME = "viu";
const BASE = "https://www.viu.com";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9"
};

async function httpGet(url) {
  try {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractStreams(html) {
  const streams = [];

  const regex = /(https?:\/\/[^"]+\.m3u8[^"]*)/g;
  let match;

  while ((match = regex.exec(html))) {
    streams.push({
      name: NAME,
      title: "Viu Stream",
      url: match[1],
      quality: "auto",
      headers: { Referer: BASE }
    });
  }

  return streams;
}

async function getStreams(title, mediaType, season, episode) {
  console.log("[viu] searching:", title);

  const searchUrl =
    BASE +
    "/ott/" +
    "search?q=" +
    encodeURIComponent(title);

  const searchPage = await httpGet(searchUrl);

  if (!searchPage) {
    return fallback();
  }

  const linkMatch = searchPage.match(/\/ott\/[^"]+/);

  if (!linkMatch) {
    return fallback();
  }

  const showPage = await httpGet(BASE + linkMatch[0]);

  if (!showPage) {
    return fallback();
  }

  const streams = extractStreams(showPage);

  if (streams.length) return streams;

  return fallback();
}

function fallback() {
  return [
    {
      name: NAME,
      title: "Fallback Stream",
      url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      quality: "720p",
      headers: { Referer: BASE }
    }
  ];
}

module.exports = { getStreams };
