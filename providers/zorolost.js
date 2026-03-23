// ZoroLost - WatchAnimeWorld India Provider for Nuvio
// NO async/await! Only .then() chains!

var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305'
var BASE = 'https://watchanimeworld.net'
var CDN = 'https://play.zephyrflick.top'
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'

function httpGet(url, headers) {
  return fetch(url, {
    headers: Object.assign({ 'User-Agent': UA }, headers || {})
  }).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return r.text()
  })
}

function httpPost(url, body, headers) {
  return fetch(url, {
    method: 'POST',
    headers: Object.assign({
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded'
    }, headers || {}),
    body: body
  }).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return r.json()
  })
}

function cleanTitle(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleDistance(a, b) {
  a = cleanTitle(a)
  b = cleanTitle(b)
  if (a === b) return 0
  if (a.includes(b) || b.includes(a)) return 1
  return 99
}

function searchSite(title, mediaType, year) {
  var url = BASE + '/?s=' + encodeURIComponent(title)
  return httpGet(url, { 'Referer': BASE + '/' })
    .then(function(html) {
      var results = []
      var containerMatch = html.match(/id="movies-a"([\s\S]*?)(?=<footer|id="footer|class="footer)/m)
      var searchHtml = containerMatch ? containerMatch[1] : html

      // Extract articles with title, url, type and year
      var articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/g
      var articleMatch
      while ((articleMatch = articleRegex.exec(searchHtml)) !== null) {
        var articleHtml = articleMatch[1]
        var linkMatch = articleHtml.match(/href="(https:\/\/watchanimeworld\.net\/(series|movies)\/([^\/\"]+)\/?)\"/)
        var titleMatch = articleHtml.match(/class="entry-title"[^>]*>([^<]+)</)
        var yearMatch = articleHtml.match(/class="year"[^>]*>(\d{4})</)

        if (linkMatch && titleMatch) {
          var slug = linkMatch[3]
          var type = linkMatch[2]
          var itemTitle = titleMatch[1].trim()
          var itemYear = yearMatch ? parseInt(yearMatch[1]) : null

          var exists = false
          for (var i = 0; i < results.length; i++) {
            if (results[i].slug === slug) { exists = true; break }
          }
          if (!exists && slug && slug !== 'page') {
            results.push({
              url: linkMatch[1],
              type: type,
              slug: slug,
              title: itemTitle,
              year: itemYear
            })
          }
        }
      }

      console.log('[ZoroLost] Raw results: ' + results.length + ' for: ' + title + ' (' + year + ')')

      // Filter by type first
      var filtered = results
      if (mediaType === 'movie') {
        var movies = results.filter(function(r) { return r.type === 'movies' })
        if (movies.length > 0) filtered = movies
      } else {
        var series = results.filter(function(r) { return r.type === 'series' })
        if (series.length > 0) filtered = series
      }

      // Sort by best match — year + title distance
      filtered.sort(function(a, b) {
        var distA = titleDistance(title, a.title)
        var distB = titleDistance(title, b.title)

        // Year match bonus
        var yearMatchA = year && a.year && Math.abs(a.year - year) <= 1 ? 0 : 10
        var yearMatchB = year && b.year && Math.abs(b.year - year) <= 1 ? 0 : 10

        return (distA + yearMatchA) - (distB + yearMatchB)
      })

      // Log top result
      if (filtered.length > 0) {
        console.log('[ZoroLost] Best match: ' + filtered[0].title + ' (' + filtered[0].year + ') dist=' + titleDistance(title, filtered[0].title))
      }

      return filtered
    })
}

function getEpisodeUrl(seriesUrl, season, episode) {
  return httpGet(seriesUrl, { 'Referer': BASE + '/' })
    .then(function(html) {
      var seasons = []
      var seasonRegex = /data-post="(\d+)"\s+data-season="(\d+)"/g
      var m
      while ((m = seasonRegex.exec(html)) !== null) {
        seasons.push({ post: m[1], season: parseInt(m[2]) })
      }
      if (seasons.length === 0) {
        return getEpisodeUrlFromHtml(html, season, episode)
      }
      var target = null
      for (var i = 0; i < seasons.length; i++) {
        if (seasons[i].season === parseInt(season)) { target = seasons[i]; break }
      }
      if (!target) return null
      var ajaxUrl = BASE + '/wp-admin/admin-ajax.php?action=action_select_season&season=' + season + '&post=' + target.post
      return httpGet(ajaxUrl, { 'Referer': seriesUrl })
        .then(function(epHtml) {
          return getEpisodeUrlFromHtml(epHtml, season, episode)
        })
    })
}

function getEpisodeUrlFromHtml(html, season, episode) {
  var epRegex = new RegExp('href="(https://watchanimeworld\\.net/episode/[^"]*' + season + 'x' + episode + '[^"]*)"')
  var epMatch = html.match(epRegex)
  if (epMatch) return epMatch[1]
  return null
}

function getStreamFromPage(pageUrl) {
  return httpGet(pageUrl, { 'Referer': BASE + '/' })
    .then(function(html) {
      var iframeMatch = html.match(/src="(https:\/\/play\.zephyrflick\.top\/video\/([a-f0-9]+))"/)
      if (!iframeMatch) {
        console.log('[ZoroLost] No player on: ' + pageUrl)
        return null
      }
      var hash = iframeMatch[2]
      console.log('[ZoroLost] Hash: ' + hash)
      return httpPost(
        CDN + '/player/index.php?data=' + hash + '&do=getVideo',
        'hash=' + hash + '&r=' + encodeURIComponent(BASE + '/'),
        {
          'Referer': BASE + '/',
          'Origin': CDN,
          'X-Requested-With': 'XMLHttpRequest'
        }
      ).then(function(data) {
        var m3u8 = data.videoSource || data.securedLink
        if (!m3u8) return null
        var contentHashMatch = m3u8.match(/\/hls\/([a-f0-9]+)\//)
        var contentHash = contentHashMatch ? contentHashMatch[1] : hash
        var cdnBase = m3u8.split('/cdn/hls/')[0]
        var subtitle = cdnBase + '/cdn/down/' + contentHash + '/Subtitle/subtitle_eng.srt'
        console.log('[ZoroLost] Stream found!')
        return { url: m3u8, subtitle: subtitle }
      })
    })
}

function getStreams(tmdbId, mediaType, season, episode) {
  return new Promise(function(resolve) {
    var tmdbUrl = mediaType === 'movie'
      ? 'https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + TMDB_KEY
      : 'https://api.themoviedb.org/3/tv/' + tmdbId + '?api_key=' + TMDB_KEY

    console.log('[ZoroLost] Start: ' + tmdbId + ' ' + mediaType + ' S' + season + 'E' + episode)

    fetch(tmdbUrl)
      .then(function(r) { return r.json() })
      .then(function(data) {
        var title = data.title || data.name
        if (!title) throw new Error('No title')
        var releaseDate = data.release_date || data.first_air_date || ''
        var year = releaseDate ? parseInt(releaseDate.split('-')[0]) : null
        console.log('[ZoroLost] Title: ' + title + ' Year: ' + year)
        return searchSite(title, mediaType, year)
      })
      .then(function(results) {
        if (!results || results.length === 0) { resolve([]); return null }
        var result = results[0]
        console.log('[ZoroLost] Using: ' + result.url)
        if (mediaType === 'movie') return getStreamFromPage(result.url)
        return getEpisodeUrl(result.url, season, episode)
          .then(function(epUrl) {
            if (!epUrl) return null
            return getStreamFromPage(epUrl)
          })
      })
      .then(function(streamData) {
        if (!streamData) { resolve([]); return }
        resolve([{
          name: '🗡️ ZoroLost',
          title: 'WatchAnimeWorld • Multi-Audio',
          url: streamData.url,
          quality: '720p',
          headers: {
            'Referer': CDN + '/',
            'Origin': CDN,
            'User-Agent': UA
          },
          subtitles: streamData.subtitle ? [{ url: streamData.subtitle, lang: 'en', name: 'English' }] : []
        }])
      })
      .catch(function(err) {
        console.error('[ZoroLost] Error: ' + err.message)
        resolve([])
      })
  })
}

module.exports = { getStreams }
