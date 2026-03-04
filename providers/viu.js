import fetch from "node-fetch";

const PROVIDER_NAME = "Viu";

async function extractStream(embedUrl) {
  const res = await fetch(embedUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://vidsrc.to/"
    }
  });

  const html = await res.text();

  const m3u8 =
    html.match(/file:\s*"(https:[^"]+\.m3u8[^"]*)"/) ||
    html.match(/"(https:[^"]+\.m3u8[^"]*)"/);

  if (!m3u8) return null;

  return m3u8[1];
}

async function streams(ctx) {
  const { type, tmdbId, season, episode } = ctx;

  let embed;

  if (type === "movie") {
    embed = `https://vidsrc.to/embed/movie/${tmdbId}`;
  } else {
    embed = `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`;
  }

  try {
    const stream = await extractStream(embed);

    if (!stream) return [];

    return [
      {
        name: PROVIDER_NAME,
        title: "VidSrc HLS",
        url: stream,
        quality: "auto",
        headers: {
          Referer: "https://vidsrc.to/",
          "User-Agent": "Mozilla/5.0"
        }
      }
    ];
  } catch (err) {
    console.log("[viu] extract error:", err.message);
    return [];
  }
}

export default {
  name: "viu",
  displayName: "Viu",
  async streams(ctx) {
    console.log("[viu] getStreams", ctx.title);
    return await streams(ctx);
  }
};
