const axios = require("axios");

const PROVIDER_NAME = "OneTouchTV";

async function getStreams(tmdbId, mediaType, season, episode) {
  try {

    let title;

    if (mediaType === "movie") {
      title = `tmdb-${tmdbId}`;
    } else {
      title = `tmdb-${tmdbId}-s${season}e${episode}`;
    }

    const playerUrl =
      `https://s1.devcorp.me/player/player.html?title=${title}`;

    const res = await axios.get(playerUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://s1.devcorp.me/"
      }
    });

    const html = res.data;

    const match = html.match(/file=\[(.*?)\]/);

    if (!match) return [];

    const json = JSON.parse(`[${match[1]}]`);

    const streams = [];

    json.forEach((server) => {
      if (!server.file) return;

      streams.push({
        url: server.file,
        quality: server.title || "HD",
        type: "hls",
        headers: {
          Referer: "https://s1.devcorp.me/"
        }
      });
    });

    return streams;

  } catch (e) {
    return [];
  }
}

module.exports = {
  name: PROVIDER_NAME,
  getStreams
};
