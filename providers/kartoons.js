function getStreams(tmdbId, mediaType, seasonNum, episodeNum, title) {

    return new Promise(function(resolve) {

        let streams = [];
        let searchTitle = title || "Ben 10";

        let searchUrl = "https://kartoons.me/?s=" + encodeURIComponent(searchTitle);

        // STEP 1: SEARCH
        fetch(searchUrl)
        .then(function(res){ return res.text(); })
        .then(function(html){

            let postMatch = html.match(/class="post-title[^"]*">\s*<a href="([^"]+)"/i);

            if(!postMatch) {
                resolve([]);
                return;
            }

            let postUrl = postMatch[1];

            // STEP 2: OPEN SHOW PAGE
            return fetch(postUrl);

        })
        .then(function(res){
            if(!res) return null;
            return res.text();
        })
        .then(function(html){

            if(!html){
                resolve([]);
                return;
            }

            // STEP 3: FIND PLAYER IFRAME
            let iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/i);

            if(!iframeMatch){
                resolve([]);
                return;
            }

            let iframeUrl = iframeMatch[1];

            // STEP 4: RETURN STREAM
            streams.push({
                name: "Kartoons",
                description: "Cartoon Stream",
                url: iframeUrl,
                behaviorHints: {
                    notWebReady: false
                }
            });

            resolve(streams);

        })
        .catch(function(){
            resolve([]);
        });

    });

}

module.exports = { getStreams };
