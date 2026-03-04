var BASE = "https://cima4u.tv";

var DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": BASE
};

function http(url) {
  return fetch(url, { headers: DEFAULT_HEADERS }).then(r => r.text());
}

function getTitle(id, type) {

  var url =
    "https://api.themoviedb.org/3/" +
    (type === "movie" ? "movie/" : "tv/") +
    id +
    "?api_key=44c4c1f0a1d7b6f0a4c3a1e8e6e1c111";

  return fetch(url)
    .then(r => r.json())
    .then(j => j.title || j.name);
}

function extract(html, referer) {

  var out = [];
  var re = /(https?:\/\/[^"' ]+\.(m3u8|mp4)[^"' ]*)/g;
  var m;

  while ((m = re.exec(html))) {
    out.push({
      name: "CIMA4U",
      url: m[1],
      quality: "HD",
      headers: { Referer: referer }
    });
  }

  return out;
}

function getStreams(tmdbId, mediaType, season, episode) {

  return getTitle(tmdbId, mediaType).then(function(title) {

    var search = BASE + "/?s=" + encodeURIComponent(title);

    return http(search).then(function(html) {

      var match = html.match(/<a href="(https?:\/\/[^"]+)"/i);
      if (!match) return [];

      var moviePage = match[1];

      return http(moviePage).then(function(page) {

        var streams = extract(page, moviePage);

        var iframe = page.match(/<iframe[^>]+src="([^"]+)"/i);

        if (!streams.length && iframe) {

          return http(iframe[1]).then(function(iframeHtml) {
            return extract(iframeHtml, iframe[1]);
          });

        }

        return streams;
      });
    });
  });
}

module.exports = { getStreams };
