var DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Accept-Language': 'en-US,en;q=0.9'
};

function httpGet(url, headers) {
  return fetch(url, { headers: Object.assign({}, DEFAULT_HEADERS, headers || {}) })
    .then(r => r.text());
}

// get title from tmdb
function getTitle(tmdbId, mediaType) {
  var type = mediaType === "movie" ? "movie" : "tv";
  var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=44c4c1f0a1d7b6f0a4c3a1e8e6e1c111";

  return fetch(url).then(r => r.json()).then(j => {
    return j.title || j.name;
  });
}

function extractSources(html, referer) {
  var out = [];
  var re = /(https?:\/\/[^"' ]+\.(m3u8|mp4)[^"' ]*)/g;
  var m;

  while ((m = re.exec(html)) !== null) {
    out.push({
      name: "Domty",
      url: m[1],
      quality: "HD",
      headers: { Referer: referer }
    });
  }

  return out;
}

function search(base, query) {
  return httpGet(base + "/?s=" + encodeURIComponent(query)).then(html => {

    var m = html.match(/<a href="(https?:\/\/[^"]+)"[^>]*class="[^"]*title/i);
    if (!m) return null;

    return m[1];
  });
}

function getStreams(tmdbId, mediaType, season, episode) {

  return getTitle(tmdbId, mediaType).then(title => {

    var sites = [
      "https://egybest.la",
      "https://mycima.horse",
      "https://cimawbas.org"
    ];

    var jobs = sites.map(site =>
      search(site, title).then(link => {
        if (!link) return [];
        return httpGet(link).then(html => extractSources(html, link));
      }).catch(() => [])
    );

    return Promise.all(jobs).then(r => r.flat());
  });
}

module.exports = { getStreams };
