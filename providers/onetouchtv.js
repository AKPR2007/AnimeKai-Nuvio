// Desene Dublate RO Provider pentru Nuvio
// Sursa: deseneledublate.com - desene animate dublate in romana

function cleanTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .trim();
}

function getStreams(tmdbId, mediaType, season, episode) {
  // Intai luam titlul filmului/serialului din TMDB
  var tmdbUrl =
    "https://api.themoviedb.org/3/" +
    (mediaType === "movie" ? "movie" : "tv") +
    "/" +
    tmdbId +
    "?api_key=c9b3694ab9f79b7f2f14f86bc0d5c93d&language=ro-RO";

  return fetch(tmdbUrl)
    .then(function (response) {
      return response.json();
    })
    .then(function (tmdbData) {
      var title = tmdbData.title || tmdbData.name || "";
      var originalTitle = tmdbData.original_title || tmdbData.original_name || "";
      var slug = cleanTitle(title) || cleanTitle(originalTitle);

      // Cautam pe deseneledublate.com
      var searchUrl =
        "https://deseneledublate.com/?s=" + encodeURIComponent(title);

      return fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "ro-RO,ro;q=0.9",
        },
      }).then(function (response) {
        return response.text();
      }).then(function (html) {
        var streams = [];

        // Extragem linkuri din pagina de search
        var linkRegex = /href="(https:\/\/deseneledublate\.com\/[^"]+)"/g;
        var match;
        var foundLinks = [];

        while ((match = linkRegex.exec(html)) !== null) {
          var url = match[1];
          if (
            url.includes(slug) ||
            url.toLowerCase().includes(cleanTitle(title))
          ) {
            if (foundLinks.indexOf(url) === -1) {
              foundLinks.push(url);
            }
          }
        }

        if (foundLinks.length === 0) {
          // Incercam URL direct dupa slug
          foundLinks.push("https://deseneledublate.com/" + slug + "/");
        }

        // Luam primul rezultat si extragem stream-ul
        return fetch(foundLinks[0], {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Referer: "https://deseneledublate.com/",
          },
        }).then(function (pageResponse) {
          return pageResponse.text();
        }).then(function (pageHtml) {
          // Cautam iframe sau surse video
          var iframeRegex = /<iframe[^>]+src="([^"]+)"/gi;
          var mp4Regex = /(?:file|src)["']?\s*[:=]\s*["']([^"']+\.(?:mp4|m3u8))/gi;
          var sourceRegex = /<source[^>]+src="([^"]+)"/gi;

          var videoUrls = [];

          var m;
          while ((m = mp4Regex.exec(pageHtml)) !== null) {
            if (videoUrls.indexOf(m[1]) === -1) {
              videoUrls.push(m[1]);
            }
          }
          while ((m = sourceRegex.exec(pageHtml)) !== null) {
            if (videoUrls.indexOf(m[1]) === -1) {
              videoUrls.push(m[1]);
            }
          }

          if (videoUrls.length > 0) {
            videoUrls.forEach(function (url, index) {
              streams.push({
                name: "Desene Dublate RO",
                title:
                  "Desene Dublate RO | " +
                  (url.includes("m3u8") ? "HLS" : "MP4") +
                  (index > 0 ? " #" + (index + 1) : ""),
                url: url,
                quality: "SD",
                headers: {
                  Referer: "https://deseneledublate.com/",
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
              });
            });
          } else {
            // Daca nu gasim stream direct, returnam pagina cu external player
            streams.push({
              name: "Desene Dublate RO",
              title: "Desene Dublate RO | " + title,
              url: foundLinks[0],
              quality: "SD",
              headers: {
                Referer: "https://deseneledublate.com/",
              },
              supportsExternalPlayer: true,
            });
          }

          return streams;
        });
      });
    })
    .catch(function (error) {
      console.error("[DeseneRO] Error:", error.message);
      return [];
    });
}

module.exports = { getStreams };
