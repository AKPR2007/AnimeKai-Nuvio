const cheerio = require("cheerio-without-node-native")

const MIRRORS = [
  "https://uhdmovies.email",
  "https://uhdmovies.fyi",
  "https://uhdmovies.zip"
]

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

async function request(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA }
  })

  if (!res.ok) throw new Error("HTTP " + res.status)

  return await res.text()
}

async function getDomain() {
  for (const d of MIRRORS) {
    try {
      const r = await fetch(d, { headers: { "User-Agent": UA } })
      if (r.ok) return d
    } catch {}
  }

  return MIRRORS[0]
}

function extractQuality(text) {
  if (!text) return "HD"

  text = text.toLowerCase()

  if (text.includes("2160") || text.includes("4k")) return "4K"
  if (text.includes("1080")) return "1080p"
  if (text.includes("720")) return "720p"

  return "HD"
}

module.exports = {

  id: "uhdmovies",
  name: "UHDMovies",

  async search(query) {

    const domain = await getDomain()

    const url = `${domain}/?s=${encodeURIComponent(query)}`

    const html = await request(url)

    const $ = cheerio.load(html)

    const results = []

    $("article, .post, .blog-item").each((i, el) => {

      const link = $(el).find("a[href*='download']").attr("href")

      if (!link) return

      const title =
        $(el).find("h2,h3,h1").first().text().trim() ||
        $(el).find("a").first().attr("title")

      if (!title) return

      results.push({
        title,
        url: link.startsWith("http") ? link : domain + link
      })
    })

    return results
  },

  async scrape(result) {

    const html = await request(result.url)

    const $ = cheerio.load(html)

    const links = []

    $("a").each((i, el) => {

      const href = $(el).attr("href")
      if (!href) return

      if (
        href.includes("driveleech") ||
        href.includes("tech.") ||
        href.includes("video-seed") ||
        href.includes("video-leech")
      ) {
        const text = $(el).parent().text()

        links.push({
          name: "UHDMovies",
          title: extractQuality(text),
          url: href
        })
      }
    })

    return links
  }
}
