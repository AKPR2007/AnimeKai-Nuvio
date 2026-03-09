/**
 * AtishMKV Provider for Nuvio
 */

const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://atishmkv3.bond";

module.exports = {
  name: "AtishMKV",
  version: "1.0.0",
  description: "Streams from AtishMKV",

  async search(query) {
    try {
      const res = await axios.get(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
      const $ = cheerio.load(res.data);

      const results = [];

      $("article").each((i, el) => {
        const title = $(el).find("h2.entry-title a").text().trim();
        const link = $(el).find("h2.entry-title a").attr("href");
        const image = $(el).find("img").attr("src");

        if (title && link) {
          results.push({
            title: title,
            url: link,
            image: image || null
          });
        }
      });

      return results;
    } catch (err) {
      console.error("Search error:", err);
      return [];
    }
  },

  async getStreams(url) {
    try {
      const res = await axios.get(url);
      const html = res.data;

      const streams = [];

      const regex = /https?:\/\/[0-9.]+\/v4\/.*?master\.m3u8[^\s'"]*/g;
      const matches = html.match(regex);

      if (matches) {
        matches.forEach((stream) => {
          streams.push({
            name: "AtishMKV",
            url: stream,
            type: "hls"
          });
        });
      }

      return streams;

    } catch (err) {
      console.error("Stream extraction error:", err);
      return [];
    }
  }
};
