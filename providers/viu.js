const fetch = globalThis.fetch || require("node-fetch");
const NAME = "viu";

async function getTMDB(title, mediaType) {
  const url =
    "https://www.themoviedb.org/search?query=" +
    encodeURIComponent(title);

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const html = await res.text();

  let match;

  if (mediaType === "tv") {
    match = html.match(/\/tv\/(\d+)/);
  } else {
    match = html.match(/\/movie\/(\d+)/);
  }

  if (!match) {
    const any = html.match(/\/(tv|movie)\/(\d+)/);
    if (any) match = [any[0], any[2]];
  }

  if (!match) return null;

  return match[1];
}

async function getStreams(title, mediaType, season, episode) {
  console.log("[viu] title:", title);

  try {
    const tmdb = await getTMDB(title, mediaType);

    if (!tmdb) {
      console.log("[viu] tmdb not found");
      return [];
    }

    console.log("[viu] tmdb:", tmdb);

    const s = season || 1;
    const e = episode || 1;

    const streams = [];

    const providers = [
      {
        name: "VidSrc",
        movie: `https://vidsrc.to/embed/movie/${tmdb}`,
        tv: `https://vidsrc.to/embed/tv/${tmdb}/${s}/${e}`,
        referer: "https://vidsrc.to/"
      },
      {
        name: "VidSrc.me",
        movie: `https://vidsrc.me/embed/movie/${tmdb}`,
        tv: `https://vidsrc.me/embed/tv/${tmdb}/${s}/${e}`,
        referer: "https://vidsrc.me/"
      },
      {
        name: "2Embed",
        movie: `https://www.2embed.cc/embed/${tmdb}`,
        tv: `https://www.2embed.cc/embedtv/${tmdb}&s=${s}&e=${e}`,
        referer: "https://www.2embed.cc/"
      },
      {
        name: "MultiEmbed",
        movie: `https://multiembed.mov/?video_id=${tmdb}&tmdb=1`,
        tv: `https://multiembed.mov/?video_id=${tmdb}&tmdb=1&s=${s}&e=${e}`,
        referer: "https://multiembed.mov/"
      },
      {
        name: "SuperEmbed",
        movie: `https://multiembed.mov/directstream.php?video_id=${tmdb}&tmdb=1`,
        tv: `https://multiembed.mov/directstream.php?video_id=${tmdb}&tmdb=1&s=${s}&e=${e}`,
        referer: "https://multiembed.mov/"
      }
    ];

    for (const p of providers) {
      streams.push({
        name: NAME,
        title: p.name,
        url: mediaType === "movie" ? p.movie : p.tv,
        quality: "auto",
        headers: {
          Referer: p.referer,
          "User-Agent": "Mozilla/5.0"
        }
      });
    }

    return streams;
  } catch (err) {
    console.log("[viu] error:", err.message);
    return [];
  }
}

module.exports = { getStreams };
