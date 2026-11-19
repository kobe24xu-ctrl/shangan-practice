/** Pure, testable helpers. They never download media or subtitles. */
export const timecode=(seconds)=>{const s=Math.max(0,Math.floor(Number(seconds)||0));return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map((n,i)=>i===0?String(n).padStart(2,'0'):String(n).padStart(2,'0')).join(':').replace(/^00:/,'');};
export function parseClock(value){
  if(typeof value==='number')return Number.isFinite(value)?value:NaN;
  const clean=String(value??'').trim().replace(',','.');
  if(!/^\d+(?::\d{1,2}){0,2}(?:\.\d{1,3})?$/.test(clean))return NaN;
  const parts=clean.split(':').map(Number);let sum=0;for(const part of parts)sum=sum*60+part;return sum;
}
export function splitSentences(txt){return String(txt).replace(/\r/g,'').replace(/\s+/g,' ').trim().match(/[^.!?。！？]+[.!?。！？]?/g)?.map(x=>x.trim()).filter(Boolean)||[];}
export function parseTranscript(input,{start=0,end=600,timebase='auto'}={}){
  const raw=String(input??'').replace(/^\uFEFF/,'').trim();if(!raw)return [];
  let cues=[];
  // JSON array: [{start, end, text}], or {cues:[...]}
  if(/^[\[{]/.test(raw)){try{const data=JSON.parse(raw);let arr=Array.isArray(data)?data:data.cues;if(Array.isArray(arr)){cues=arr.map(o=>({start:typeof o.start==='number'?o.start:parseClock(o.start),end:typeof o.end==='number'?o.end:parseClock(o.end),text:String(o.text??'').replace(/<[^>]+>/g,'').trim()}));}}catch{}}
  if(!cues.length){
    const normalized=raw.replace(/\r\n?/g,'\n').replace(/^WEBVTT[^\n]*\n/,'').replace(/^NOTE[^\n]*(?:\n(?!\n)[^\n]*)*/gm,'');
    const lines=normalized.split('\n');
    const timeReg=/(\d+(?::\d{1,2}){1,2}[.,]\d{1,3}|\d+:\d{1,2})\s*-->\s*(\d+(?::\d{1,2}){1,2}[.,]\d{1,3}|\d+:\d{1,2})/;
    for(let i=0;i<lines.length;i++){
      const m=lines[i].match(timeReg);if(!m)continue;
      const a=parseClock(m[1]),b=parseClock(m[2]);let text=[];
      for(let j=i+1;j<lines.length&&lines[j].trim()&&!lines[j].match(timeReg);j++){if(!/^\d+$/.test(lines[j].trim()))text.push(lines[j].trim());}
      if(text.length)cues.push({start:a,end:b,text:text.join(' ').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')});
    }
    // Supports tab-separated start\tend\ttext
    if(!cues.length){for(const line of lines){const m=line.match(/^\s*(\d+(?::\d{1,2}){0,2}(?:[.,]\d+)?)\s*\t\s*(\d+(?::\d{1,2}){0,2}(?:[.,]\d+)?)\s*\t\s*(.+)$/);if(m)cues.push({start:parseClock(m[1]),end:parseClock(m[2]),text:m[3]});}}
    // Untimed TXT: synthetic equal weighted durations, transparent approximation.
    if(!cues.length){const sentences=splitSentences(raw.replace(/\n/g,' '));const units=sentences.map(s=>Math.max(3,s.split(/\s+/).length));const total=units.reduce((a,b)=>a+b,0)||1;let t=start;for(let i=0;i<sentences.length;i++){const finish=i===sentences.length-1?end:t+(end-start)*(units[i]/total);cues.push({start:t,end:finish,text:sentences[i],estimated:true});t=finish;}}
  }
  const maxTime=Math.max(0,...cues.map(c=>c.end));
  const relative=!cues.some(c=>c.estimated)&&(timebase==='relative'||(timebase==='auto'&&start>=60&&maxTime<=Math.max(630,(end-start)+15)));
  return cues.map((c,i)=>({id:`cue-${i+1}`,start:c.start+(relative?start:0),end:c.end+(relative?start:0),text:c.text,estimated:!!c.estimated}))
    .filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>c.start&&c.text&&c.end>start&&c.start<end)
    .map(c=>({...c,start:Math.max(start,c.start),end:Math.min(end,c.end)}))
    .sort((a,b)=>a.start-b.start).slice(0,1500);
}
export const normalize=(s)=>String(s??'').toLowerCase().replace(/[‘’']/g,'').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
export function dictationScore(actual,expected){
  const a=normalize(actual).split(' ').filter(Boolean),b=normalize(expected).split(' ').filter(Boolean);
  if(!b.length)return {score:0,missing:[],extra:a};
  const dp=Array.from({length:a.length+1},()=>new Array(b.length+1).fill(0));
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]+1:Math.max(dp[i-1][j],dp[i][j-1]);
  let i=a.length,j=b.length;const missing=[],extra=[];
  while(i&&j){if(a[i-1]===b[j-1]){i--;j--;}else if(dp[i-1][j]>=dp[i][j-1]){extra.unshift(a[--i]);}else{missing.unshift(b[--j]);}}
  while(i)extra.unshift(a[--i]);while(j)missing.unshift(b[--j]);
  return {score:Math.round(100*(2*dp[a.length][b.length]/(a.length+b.length||1))),missing,extra};
}
export function safeYoutubeId(id){return /^[a-zA-Z0-9_-]{11}$/.test(String(id));}
export function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));}
export function exportJSON(data){return JSON.stringify({app:'CEO English Lab',version:1,exportedAt:new Date().toISOString(),data},null,2);}
export function validBackup(obj){return obj?.app==='CEO English Lab'&&obj?.version===1&&obj.data&&typeof obj.data==='object'&&!Array.isArray(obj.data);}