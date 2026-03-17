const BASE = "https://animepahe.si";

const HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Referer": BASE,
    "Origin": BASE
};

// Search anime
async function searchAnime(title) {
    let res = await fetch(`${BASE}/api?m=search&q=${encodeURIComponent(title)}`);
    let json = await res.json();
    return json.data && json.data.length ? json.data[0] : null;
}

// Get episode list
async function getEpisode(session, episode) {
    let res = await fetch(`${BASE}/api?m=release&id=${session}&sort=episode_asc`);
    let json = await res.json();

    let ep = json.data.find(e => Number(e.episode) === Number(episode));
    return ep || null;
}

// Extract stream
async function getStreamPage(sessionEp) {
    let res = await fetch(`${BASE}/play/${sessionEp}`, { headers: HEADERS });
    let html = await res.text();

    let match = html.match(/https?:\/\/[^"]+\.m3u8[^"]*/);
    return match ? match[0] : null;
}

// MAIN ENTRY (Nuvio uses this)
async function getStreams(tmdbId, mediaType, season, episode, title) {
    try {
        let anime = await searchAnime(title);
        if (!anime) return [];

        let ep = await getEpisode(anime.session, episode);
        if (!ep) return [];

        let stream = await getStreamPage(ep.session);
        if (!stream) return [];

        return [{
            name: "AnimePahe",
            url: stream,
            type: "hls",
            headers: HEADERS
        }];

    } catch (e) {
        return [];
    }
}

// ✅ REQUIRED EXPORT (this is what you were missing)
if (typeof module !== "undefined") {
    module.exports = { getStreams };
}
