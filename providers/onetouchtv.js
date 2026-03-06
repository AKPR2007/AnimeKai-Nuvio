/**
 * onetouchtv provider
 */

const axios = require("axios");
const cheerio = require("cheerio-without-node-native");

const BASE = "https://onetouchtv.xyz";

const TMDB_API_KEY = "1b3113663c9004682ed61086cf967c44";
const TMDB_BASE = "https://api.themoviedb.org/3";

const HEADERS = {
 "User-Agent":
 "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
 "Referer": BASE
};

function formatTitle(title,season,episode){
 const s = String(season||1).padStart(2,"0");
 const e = String(episode||1).padStart(2,"0");

 return `OneTouchTV (1080p) [OneTouchTV]
📺 ${title} S${s}E${e}`;
}

async function getTMDBTitle(id,type){

 try{

  const endpoint = type==="tv" ? "tv" : "movie";

  const url=`${TMDB_BASE}/${endpoint}/${id}?api_key=${TMDB_API_KEY}`;

  const res = await axios.get(url);

  return res.data.name || res.data.title;

 }catch(e){

  console.log("[OneTouchTV] TMDB error");

  return null;

 }

}

async function search(title){

 const url=`${BASE}/?s=${encodeURIComponent(title)}`;

 const res=await axios.get(url,{headers:HEADERS});

 const $=cheerio.load(res.data);

 const results=[];

 $("article h2 a").each((i,el)=>{

  results.push({
   title:$(el).text().trim(),
   url:$(el).attr("href")
  });

 });

 return results;

}

async function findEpisode(seriesUrl,episode){

 const res=await axios.get(seriesUrl,{headers:HEADERS});

 const $=cheerio.load(res.data);

 let epLink=null;

 $("a").each((i,el)=>{

  const text=$(el).text();

  if(text.match(new RegExp(`Episode\\s*${episode}`,"i"))){

   epLink=$(el).attr("href");

  }

 });

 return epLink;

}

async function extractStream(url){

 const res=await axios.get(url,{headers:HEADERS});

 const html=res.data;

 const $=cheerio.load(html);

 const iframe=$("iframe").attr("src");

 if(!iframe) return null;

 const frame=await axios.get(iframe,{headers:HEADERS});

 const frameHtml=frame.data;

 const stream=frameHtml.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/);

 if(stream) return stream[0];

 return null;

}

async function getStreams(tmdbId,mediaType="tv",season=1,episode=1){

 try{

  const title=await getTMDBTitle(tmdbId,mediaType);

  if(!title){

   console.log("[OneTouchTV] no title");

   return [];

  }

  console.log("[OneTouchTV] searching:",title);

  const results=await search(title);

  if(!results.length){

   console.log("[OneTouchTV] no results");

   return [];

  }

  const match=results[0];

  const epPage=await findEpisode(match.url,episode);

  if(!epPage){

   console.log("[OneTouchTV] episode not found");

   return [];

  }

  const stream=await extractStream(epPage);

  if(!stream){

   console.log("[OneTouchTV] stream not found");

   return [];

  }

  return [

   {
    name:"OneTouchTV",
    title:formatTitle(title,season,episode),
    url:stream,
    quality:"1080p",
    type:"hls",
    headers:HEADERS,
    provider:"OneTouchTV"
   }

  ];

 }catch(e){

  console.log("[OneTouchTV error]",e.message);

  return [];

 }

}

module.exports={getStreams};
