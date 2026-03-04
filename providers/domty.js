// ───────────────── Headers ─────────────────
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

// ───────────────── HTTP ─────────────────
async function request(url, referer) {
  try {
    const res = await fetch(url, {
      headers: {
        ...HEADERS,
        Referer: referer || url,
      },
    });

    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

// ───────────────── Stream Extraction ─────────────────
function extractStreams(html) {
  const links = new Set();

  const patterns = [
    /(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/gi,
    /(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/gi,
    /file\s*:\s*["']([^"']+)["']/gi,
    /source\s*src=["']([^"']+)["']/gi,
    /data-url=["']([^"']+)["']/gi,
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(html))) {
      links.add(m[1]);
    }
  }

  return [...links];
}

// ───────────────── JWPlayer ─────────────────
function extractJWPlayer(html) {
  const links = [];

  const block = html.match(/sources\s*:\s*(.*?)/s);
  if (!block) return links;

  const re = /file\s*:\s*["']([^"']+)["']/g;
  let m;

  while ((m = re.exec(block[
