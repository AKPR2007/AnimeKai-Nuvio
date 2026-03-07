const fetch = require('node-fetch');
const CryptoJS = require('crypto-js');

const PROVIDER_NAME = "OneTouchTV";
const API_BASE = "https://api.onetouchtv.me"; // real API
const HEX_KEY = "4f6e65546f7563685465564b6579"; // Cloudstream key

/**
 * AES decrypt function
 */
function decryptAES(data) {
    try {
        const key = CryptoJS.enc.Hex.parse(HEX_KEY);
        const decrypted = CryptoJS.AES.decrypt(data, key, {
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7
        });
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        console.error("Decrypt error:", e);
        return null;
    }
}

/**
 * Fetch TMDB title for correct search
 */
async function fetchTMDBTitle(tmdbId, mediaType) {
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=b030404650f279792a8d3287232358e3`;
    const res = await fetch(url);
    const json = await res.json();
    return {
        title: json.title || json.name || json.original_title,
        year: (json.release_date || json.first_air_date || "").substring(0, 4)
    };
}

/**
 * Fetch episode ID from API
 */
async function fetchEpisodeId(title, seasonNum, episodeNum, mediaType) {
    const searchUrl = `${API_BASE}/v1/search?q=${encodeURIComponent(title)}`;
    const res = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0" }
    });
    const data = await res.json();
    if (!data || !data.results) return null;

    // Find exact match or fallback
    let matched = data.results.find(x => x.title.toLowerCase() === title.toLowerCase());
    if (!matched) matched = data.results[0];
    if (!matched) return null;

    if (mediaType === "movie") return matched.id;

    // TV episode
    const detailRes = await fetch(`${API_BASE}/v1/tv/${matched.id}`);
    const detail = await detailRes.json();
    const episode = detail.episodes.find(ep => parseInt(ep.number) === parseInt(episodeNum));
    return episode ? episode.id : null;
}

/**
 * Main function to get streams
 */
async function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    try {
        const { title } = await fetchTMDBTitle(tmdbId, mediaType);

        const episodeId = await fetchEpisodeId(title, seasonNum, episodeNum, mediaType);
        if (!episodeId) return [];

        // Fetch encrypted API
        const apiUrl = `${API_BASE}/v1/source?id=${episodeId}`;
        const res = await fetch(apiUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://onetouchtv.me/",
                "Origin": "https://onetouchtv.me"
            }
        });
        const json = await res.json();

        if (!json.data) return [];

        const decrypted = decryptAES(json.data);
        if (!decrypted) return [];

        const sources = JSON.parse(decrypted);

        const streams = [];
        if (sources.sources && Array.isArray(sources.sources)) {
            sources.sources.forEach(s => {
                if (!s.file) return;

                streams.push({
                    name: "OneTouchTV",
                    title: s.title || "Server",
                    url: s.file,
                    quality: s.label || "HD",
                    headers: { Referer: "https://onetouchtv.me/" },
                    provider: "onetouchtv"
                });
            });
        }

        return streams;

    } catch (e) {
        console.error("OneTouchTV Error:", e);
        return [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
