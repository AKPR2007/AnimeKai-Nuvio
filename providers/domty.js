// Domty Arabic Provider (Fixed)

const PROVIDER_NAME = "Domty";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = "439c478a771f35c05022f9feabcca01c";

const SOURCES = [
  { name: "FaselHD", base: "https://www.faselhd.watch" },
  { name: "CimaNow", base: "https://cimanow.cc" },
  { name: "EgyBest", base: "https://wecima.movie" },
  { name}

function searchSite(name, base, query, mediaType) {

  var url = base + '/?s=' + encodeURIComponent(query);

  return httpGet(url, { Referer: base })
    .then(function(html) {

      var items = [];
      var re = /<article[^>]*>([\s\S]*?)<\/article>/gi;
      var m;

      while ((m = re.exec(html)) !== null) {

        var block = m[1];

        var titleM = block.match(/<h[23][^>]*>([^<]+)<\/h[23]>/i);
        var linkM = block.match(/href=["'](https?:\/\/[^"']+)["']/i);

        if (titleM && linkM) {

          items.push({
            name: name,
            base: base,
            title: titleM[1].trim(),
            url: linkM[1],
            isMovie: /film|movie/.test(linkM[1])
          });

        }
      }

      return items;

    }).catch(function() {
      return [];
    });
}

// ── Sources ───────────────────────────────────────────────────────────────────
var SOURCES = [
  { id: 'cimawbas', base: 'https://cimawbas.org' },
  { id: 'egybest', base: 'https://egybest.la' },
  { id: 'mycima', base: 'https://mycima.horse' },
  { id: 'flowind', base: 'https://flowind.net' },
  { id: 'aksv', base: 'https://ak.sv' },
  { id: 'fajer', base: 'https://fajer.show' },
  { id: 'x7k9f', base: 'https://x7k9f.sbs' },
  { id: 'asd', base: 'https://asd.pics' },
  { id: 'laroza', base: 'https://q.larozavideo.net' },
  { id: 'animezid', base: 'https://eg.animezid.cc' },
  { id: 'arabic-toons', base: 'https://arabic-toons.com' },
];

// ── Main ─────────────────────────────────────────────────────────────────────
function getStreams(tmdbId, mediaType, season, episode) {

  console.log('[Domty] getStreams:', tmdbId, mediaType);

  var query = mediaType === 'tv'
    ? tmdbId + ' s' + (season || 1) + 'e' + (episode || 1)
    : tmdbId;

  var promises = SOURCES.map(function(source) {

    return searchSite(source.id, source.base, query, mediaType)

      .then(function(results) {

        if (!results.length) return [];

        var match = results[0];

        for (var i = 0; i < results.length; i++) {

          if (mediaType === 'movie' && results[i].isMovie) {
            match = results[i];
            break;
          }

          if (mediaType !== 'movie' && !results[i].isMovie) {
            match = results[i];
            break;
          }

        }

        return fetchStreamsFromPage(source.id, match.url, source.base);

      })

      .catch(function() {
        return [];
      });

  });

  return Promise.all(promises).then(function(results) {

    var all = results.reduce(function(a, b) {
      return a.concat(b);
    }, []);

    var seen = {};

    return all.filter(function(s) {

      if (seen[s.url]) return false;

      seen[s.url] = true;
      return true;

    });

  });
   }
