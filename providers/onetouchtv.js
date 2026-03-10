function getStreams(tmdbId, mediaType, seasonNum, episodeNum, title) {

    return new Promise(function(resolve) {

        let results = [];
        let searchUrl = "https://atishmkv3.bond/?s=" + encodeURIComponent(title);

        // STEP 1: search the site
        fetch(searchUrl)
        .then(function(res){ return res.text(); })

        .then(function(html){

            // find first movie result
            let match = html.match(/<a[^>]+href="(https:\/\/atishmkv3\.bond\/[^"]+)"[^>]*rel="bookmark"/i);

            if(!match){
                resolve([]);
                return null;
            }

            return fetch(match[1]);
        })

        // STEP 2: open movie page
        .then(function(res){
            if(!res) return null;
            return res.text();
        })

        .then(function(html){

            if(!html){
                resolve([]);
                return null;
            }

            // extract rpmhub iframe
            let iframe = html.match(/https:\/\/atishmkv\.rpmhub\.site\/#([a-z0-9]+)/i);

            if(!iframe){
                resolve([]);
                return null;
            }

            let streamId = iframe[1];

            // open rpmhub player
            return fetch("https://atishmkv.rpmhub.site/#" + streamId);
        })

        // STEP 3: open rpmhub page
        .then(function(res){
            if(!res) return null;
            return res.text();
        })

        .then(function(html){

            if(!html){
                resolve([]);
                return;
            }

            // extract master playlist
            let m3u8 = html.match(/https?:\/\/[^"]+master\.m3u8[^"]*/i);

            if(!m3u8){
                resolve([]);
                return;
            }

            results.push({
                url: m3u8[0],
                name: "AtishMKV",
                quality: "Auto",
                type: "hls"
            });
