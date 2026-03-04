const provider = {
  name: "Domty Arabic",
  domains: ["vidsrc.me", "vidsrc.to"],
  async search(query) {
    return [
      {
        title: query,
        year: "",
        type: "movie",
        id: query
      }
    ];
  },

  async sources(ctx) {
    try {
      const title = ctx.title || ctx.id;
      const imdb = ctx.imdb || "";

      let url;

      if (imdb) {
        url = `https://vidsrc.to/embed/movie/${imdb}`;
      } else {
        const q = encodeURIComponent(title);
        url = `https://vidsrc.to/embed/movie?title=${q}`;
      }

      const res = await fetch(url);
      const html = await res.text();

      const sources = [];

      const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g) || [];
      const mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/g) || [];

      for (const link of m3u8) {
        sources.push({
          url: link,
          quality: "Auto",
          isM3U8: true
        });
      }

      for (const link of mp4) {
        sources.push({
          url: link,
          quality: "HD",
          isM3U8: false
        });
      }

      return {
        sources,
        subtitles: []
      };

    } catch (e) {
      return { sources: [], subtitles: [] };
    }
  }
};

export default provider;
