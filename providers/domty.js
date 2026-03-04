// ───────── Headers ─────────
const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

// ───────── HTTP ─────────
async function httpGet(url, extraHeaders = {}) {
  try {
    const res = await fetch(url, {
      headers: { ...DEFAULT_HEADERS, ...extraHeaders },
    });

    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

// ───────── Stream patterns ─────────
function extractStreams(html) {
  const links = new Set();

  const patterns = [
    /(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/gi,
    /(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/gi,
    /file\s*:\s*["']([^"']+)["']/gi,
    /source\s*src=["']([^"']+)["']/gi,
    /data-url=["']([^"']+)["']/gi,
    /data-hls=["']([^"']+)["']/gi,
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(html))) links.add(m[1]);
  }

  return [...links];
}

// ───────── Iframes ─────────
function extractIframes(html) {
  const frames = [];
  const re = /<iframe[^>]+src=["']([^"']+)["']/gi;

  let m;

  while ((m = re.exec(html))) {
    let src = m[1];

    if (src.startsWith("//")) src = "https:" + src;

    if (src.startsWith("http")) frames.push(src);
  }

  return frames;
}

// ───────── Quality ─────────
function getQuality(url) {
  if (/2160|4k/i.test(url)) return "4K";
  if (/1080/.test(url)) return "1080p";
  if (/720/.test(url)) return "720p";
  if (/480/.test(url)) return "480p";
  return "HD";
}

// ───────── Stream object ─────────
function makeStream(name, url, referer) {
  return {
    name,
    url,
    quality: getQuality(url),
    headers: {
      Referer: referer,
      "User-Agent": DEFAULT_HEADERS["User-Agent"],
    },
  };
}

// ───────── Extract from page ─────────
async function fetchStreamsFromPage(name, pageUrl, base) {
  const html = await httpGet(pageUrl, { Referer: base });
  if (!html) return [];

  const streams = [];

  for (const u of extractStreams(html))
    streams.push(makeStream(name, u, pageUrl));

  if (streams.length) return streams;

  const iframes = extractIframes(html).slice(0, 3);

  const results = await Promise.all(
    iframes.map(async (frame) => {
      const ih = await httpGet(frame, { Referer: pageUrl });

      return extractStreams(ih).map((u) =>
        makeStream(name, u, frame)
      );
    })
  );

  return results.flat();
}

// ───────── Search ─────────
async function searchSite(name, base, query) {
  const urls = [
    `${base}/?s=${encodeURIComponent(query)}`,
    `${base}/search/${encodeURIComponent(query)}`,
    `${base}/?story=${encodeURIComponent(query)}`,
  ];

  for (const url of urls) {
    const html = await httpGet(url, { Referer: base });
    if (!html) continue;

    const results = [];

    const re =
      /<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>(.*?)<\/a>/gi;

    let m;

    while ((m = re.exec(html))) {
      const link = m[1];

      if (!link.startsWith(base)) continue;

      const title = m[2].replace(/<[^>]+>/g, "").trim();

      if (title.length < 2) continue;

      results.push({
        name,
        base,
        title,
        url: link,
      });
    }

    if (results.length) return results;
  }

  return [];
}

// ───────── Sources ─────────
const SOURCES = [
  { id: "cimawbas", base: "https://cimawbas.org" },
  { id: "egybest", base: "https://egybest.la" },
  { id: "mycima", base: "https://mycima.horse" },
  { id: "flowind", base: "https://flowind.net" },
  { id: "fajer", base: "https://fajer.show" },
];

// ───────── Main ─────────
async function getStreams(tmdbId, mediaType, season, episode, title) {
  if (!title) title = String(tmdbId);

  let query = title;

  if (mediaType === "tv")
    query = `${title} season ${season || 1}`;

  const promises = SOURCES.map(async (source) => {
    const results = await searchSite(source.id, source.base, query);

    if (!results.length) return [];

    const match = results[0];

    return fetchStreamsFromPage(
      source.id,
      match.url,
      source.base
    );
  });

  const results = await Promise.all(promises);

  const all = results.flat();

  const seen = new Set();

  return all.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

// ───────── Nuvio export fix ─────────
exports.name = "DomTy";
exports.getStreams = getStreams;
