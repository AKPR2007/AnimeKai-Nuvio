/**
 * OneTouchTV provider
 */

const axios = require("axios");
const cheerio = require("cheerio-without-node-native");

const BASE = "https://onetouchtv.xyz";

const HEADERS = {
 "User-Agent":
 "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
 "Referer": BASE
};

function formatTitle(title,season,episode){
 const s = String(season||1).padStart(2,"0");
 const e = String(episode||1).padStart(2,"0");

 return `OneTouchTV (1080p)
📺 ${title} S${s}E${e}`;
}

async function search(title){

 const url = `${BASE}/?s=${encodeURIComponent(title)}`;

 const res = await axios.get(url,{headers:HEADERS});

 const $ = cheerio.load(res.data);

 const results=[];

 $("article a").each((i,el)=>{

  const link=$(el).attr("href");

  if(link && link.includes(BASE)){

   results.push(link);

  }

 });

 return [...new Set(results)];
}

async function findEpisode(seriesUrl,episode){

 const res = await axios.get(seriesUrl,{headers:HEADERS});

 const $ = cheerio.load(res.data);

 let ep=null;

 $("a").each((i,el)=>{

  const text=$(el).text();

  if(text.includes(`Episode ${episode}`)){

   ep=$(el).attr("href");

  }

 });

 return ep;
}

async function extractStream(page){

 const res = await axios.get(page,{headers:HEADERS});

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

  const title = typeof tmdbId==="string" ? tmdbId : "";

  if(!title) return [];

  const results = await search(title);

  if(!results.length) return [];

  const seriesPage = results[0];

  const episodePage = await findEpisode(seriesPage,episode);

  if(!episodePage) return [];

  const stream = await extractStream(episodePage);

  if(!stream) return [];

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

module.exports = { getStreams };
