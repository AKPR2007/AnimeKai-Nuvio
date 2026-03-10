// Nuvio Local Scraper Template: atishmkv3 -> HubCloud -> Direct Link
// IMPORTANT: async/await is NOT supported in Nuvio. Use standard Promises.

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    return new Promise((resolve, reject) => {
        let movieTitle = "example-movie"; // You would pull this from TMDB in a real scenario
        let searchUrl = `https://atishmkv3.bond/?s=${movieTitle}`;

        // 1. Search the main site
        fetch(searchUrl)
            .then(response => response.text())
            .then(html => {
                // 2. Find the movie page link
                let moviePageMatch = html.match(/href="(https:\/\/atishmkv3\.bond\/[^"]+)"/);
                if (!moviePageMatch) return resolve([]);
                
                return fetch(moviePageMatch[1]); 
            })
            .then(response => response ? response.text() : null)
            .then(html => {
                if (!html) return resolve([]);

                // 3. Find the HubCloud link on the movie page
                let hubcloudMatch = html.match(/(https:\/\/[a-zA-Z0-9-]+\.hubcloud\.[a-zA-Z]+\/[^"'\s]+)/);
                
                if (!hubcloudMatch) return resolve([]);
                let hubcloudUrl = hubcloudMatch[1];

                // 4. Fetch the HubCloud page
                return fetch(hubcloudUrl); 
            })
            .then(response => response ? response.text() : null)
            .then(html => {
                if (!html) return resolve([]);

                // 5. Extract the final video link
                let finalStreamMatch = html.match(/href="(https:\/\/[^"]+\.(?:mkv|mp4|m3u8)[^"]*
