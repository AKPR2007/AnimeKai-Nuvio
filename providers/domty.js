const PROVIDER_NAME = "Domty";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

async function request(url, referer) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9",
      ...(referer ? { Referer: referer } : {})
    }
  });

  if (!res.ok) throw new Error(res.status);
  return res.text();
}

async function getTitle(tmdb, type) {
  try {
    const r = await fetch(`https://api.themoviedb.org/3/${type}/${tmdb}?api_key=1`);
    const j = await r.json();
    return j.title || j.name || tmdb;
  } catch {
    return tmdb;
  }
}

function findStreams(html) {
  const out = [];
  const re = /(https?:\/\/[^"' ]+\.(m3u8|mp4)[^"' ]*)/gi;

  let m;
  while ((m = re.exec(html))) out.push(m[1]);

  return out;
}

function findIframes(html) {
  const frames = [];
  const re = /<iframe[^>]+src=["']([^"']+)["']/gi;

  let m;
  while ((m = re.exec(html))) {
    if (m[1].startsWith("http")) frames.push(m[1]);
  }

  return frames;
}

async function extractFromPage(url) {
  try {
    const html = await request(url);

    let streams = findStreams(html);
    if (streams.length) return streams;

    const frames = findIframes(html);

    for (const f of frames.slice(0, 4)) {
      try {
        const inner = await request(f, url);
        streams = streams.concat(findStreams(inner));
      } catch {}
    }

    return streams;
  } catch {
    return [];
  }
}

const SITES = [
  "https://mycima.cc",
  "https://wecima.movie",
  "https://akwam.to"
];

async function search(base, q) {
  try {
    const url = `${base}/?s=${encodeURIComponent(q)}`;
    const html = await request(url, base);

    const results = [];
    const re = /<a[^>]+href=["'](https?:\/\/[^"']+)["']/gi;

    let m;
    while ((m = re.exec(html))) {
      if (m[1].includes(base)) results.push(m[1]);
    }

    return results.slice(0, 3);
  } catch {
    return [];
  }
}

async function getStreams(tmdbId, type, season, episode) {
  console.log("[DOMTY] Start");

  const title = await getTitle(tmdbId, type);

  const query =
    type === "tv"
      ? `${title} season ${season || 1}`
      : title;

  const streams = [];

  for (const site of SITES) {
    const pages = await search(site, query);

    for (const p of pages) {
      const links = await extractFromPage(p);

      for (const l of links) {
        streams.push({
          name: "Domty",
          url: l,
          quality: "HD",
          headers: { Referer: p }
        });
      }
    }
  }

  return streams;
}

module.exports = {
  name: PROVIDER_NAME,
  getStreams
};
