function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {

    return new Promise(function(resolve) {

        try {

            let streams = [];

            fetch("https://kartoons.me/player?episodeId=68b67032787cbee165d744fe")
            .then(function(res){ return res.text(); })
            .then(function(html){

                if(!html){
                    resolve([]);
                    return;
                }

                let regex = /https:\/\/v\d+\.m3u8\w+\.workers\.dev\/playlist\/[A-Za-z0-9_\-]+/g;
                let matches = html.match(regex);

                if(matches){

                    for(let i=0;i<matches.length;i++){

                        streams.push({
                            name: "Kartoons " + (i+1),
                            description: "Stream",
                            url: matches[i],
                            behaviorHints: {
                                notWebReady: false
                            }
                        });

                    }

                }

                resolve(streams);

            })
            .catch(function(){
                resolve([]);
            });

        } catch(e) {

            resolve([]);

        }

    });

}

module.exports = { getStreams };
