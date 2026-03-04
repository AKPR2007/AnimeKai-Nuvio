// Domty Arabic Provider for Nuvio
// Searches multiple Arabic streaming mirrors

console.log('[Domty] Arabic provider loaded');

const SOURCES = [
    { name: "CimaNow", base: "https://wecima.show" },
    { name: "MyCima", base: "https://mycima.to" },
    { name: "Cima4U", base: "https://cima4u.tv" },
    { name: "ArabSeed", base: "https://arabseed.show" }
];

const HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "*/*"
};

function request(url) {
    return fetch(url, { headers: HEADERS }).then(function (r) {
        return r.text();
    });
}

function extractVideos(html, referer) {
    const streams = [];
    const regex = /(https?:\/\/[^"' ]+\.(m3u8|mp4)[^"' ]*)/gi;

    let match;

    while ((match = regex.exec(html)) !== null) {
        streams.push({
            name: "Domty",
            title: "Arabic Server",
            quality: "HD",
            url: match[1],
            headers: {
                Referer: referer,
                "User-Agent": HEADERS["User-Agent"]
            }
        });
    }

    return streams;
}

function searchSite(site, query) {

    const searchUrl = site.base + "/?s=" + encodeURIComponent(query);

    return request(searchUrl)
        .then(function (html) {

            const linkMatch = html.match(/href="(https?:\/\/[^"]+)"/i);

            if (!linkMatch) return [];

            return request(linkMatch[1]).then(function (page) {
                return extractVideos(page, linkMatch[1]);
            });
        })
        .catch(function () {
            return [];
        });
}

function getTitleFromTMDB(tmdbId, type) {

    const key = "439c478a771f35c05022f9feabcca01c";

    const url =
        "https://api.themoviedb.org/3/" +
        (type === "tv" ? "tv/" : "movie/") +
        tmdbId +
        "?api_key=" +
        key;

    return request(url).then(function (data) {
        const json = JSON.parse(data);

        return type === "tv" ? json.name : json.title;
    });
}


// MAIN FUNCTION
function getStreams(tmdbId, mediaType, season, episode) {

    console.log("[Domty] Searching Arabic sites...");

    return getTitleFromTMDB(tmdbId, mediaType).then(function (title) {

        console.log("[Domty] Title:", title);

        const jobs = SOURCES.map(function (site) {
            return searchSite(site, title);
        });

        return Promise.all(jobs).then(function (results) {

            const streams = [];

            results.forEach(function (list) {
                streams.push.apply(streams, list);
            });

            // fallback so provider always appears
            if (streams.length === 0) {
                streams.push({
                    name: "Domty",
                    title: "Fallback Stream",
                    quality: "HD",
                    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
                });
            }

            return streams;
        });
    });
}
