import {EPISODES,categories} from './data.mjs';
import {timecode,parseTranscript,dictationScore,escapeHTML,exportJSON,validBackup,safeYoutubeId} from './core.mjs';

const $=(sel,root=document)=>root.querySelector(sel);
const $$=(sel,root=document)=>Array.from(root.querySelectorAll(sel));
const icons={
 dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 headphones:'<path d="M3 14v-3a9 9 0 0 1 18 0v3"/><path d="M5 14h2v7H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2Zm12 0h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2v-7Z"/>',
 bookmark:'<path d="M5 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v18l-7-4-7 4z"/>',
 'bar-chart':'<path d="M3 3v18h18M7 15v-5m5 5V6m5 9V3"/>',
 upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 17v4h16v-4"/>',
 archive:'<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v13h14V8m-9 5h4"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 'arrow-right':'<path d="M5 12h14m-6-6 6 6-6 6"/>',
 'arrow-left':'<path d="M19 12H5m6 6-6-6 6-6"/>',
 'play-circle':'<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4V8"/>',
 play:'<path d="m8 5 12 7-12 7V5z"/>',pause:'<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
 'skip-back':'<path d="M12 5 5 12l7 7V5Zm8 0-7 7 7 7V5Z"/>','skip-forward':'<path d="m12 5 7 7-7 7V5ZM4 5l7 7-7 7V5Z"/>',
 external:'<path d="M14 3h7v7M10 14 21 3M21 13v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
 layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5"/>',
 shield:'<path d="m12 22 8-4V6l-8-4-8 4v12l8 4Z"/><path d="m9 12 2 2 4-4"/>',
 info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
 pen:'<path d="m4 20 5-1 12-12-4-4L5 15l-1 5ZM14 6l4 4"/>',
 mic:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',
 music:'<path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="18" cy="16" rx="3" ry="2"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
 'upload-cloud':'<path d="M19 18a4 4 0 0 0 .1-8A7 7 0 0 0 5 11a4 4 0 0 0 0 7h3m4 3V11m-4 4 4-4 4 4"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 headphones2:'<path d="M3 14v-3a9 9 0 0 1 18 0v3M5 14v7h3v-7H5Zm11 0v7h3v-7h-3Z"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 lock:'<rect x="5" y="11" width="14" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
 repeat:'<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
 edit:'<path d="M12 20h9M4 16l11-11 4 4L8 20H4v-4Z"/>',
 volume:'<path d="M3 9v6h4l5 4V5L7 9H3Zm13-1a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14"/>',
 stop:'<rect x="5" y="5" width="14" height="14" rx="1"/>',
 trash:'<path d="M4 7h16M10 3h4M6 7l1 14h10l1-14M10 11v6m4-6v6"/>',
 award:'<circle cx="12" cy="8" r="5"/><path d="m8 12-2 10 6-3 6 3-2-10"/>',
 flame:'<path d="M12 22c4 0 7-3 7-7 0-3-2-5-4-8-1 3-2 3-3 4-1-4-2-5-3-8-1 4-4 7-4 12 0 4 3 7 7 7Z"/>',
 book:'<path d="M3 4a2 2 0 0 1 2-2h13v18H5a2 2 0 0 0-2 2V4Zm0 16a2 2 0 0 1 2-2h16"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 sound:'<path d="M4 10v4m4-8v12m4-16v20m4-14v8m4-6v4"/>'
};
const svg=(name)=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.info}</svg>`;
const replaceIcons=(root=document)=>$$('[data-icon]',root).forEach(e=>{e.innerHTML=svg(e.dataset.icon);});
const storageKey='ceo-english-lab:v1';
const defaultState=()=>({progress:{},saved:[],history:[],transcripts:{},customWords:[],lastEpisode:'sinek-ai'});
const readState=()=>{try{let raw=JSON.parse(localStorage.getItem(storageKey));if(!raw||typeof raw!=='object')return defaultState();return {...defaultState(),...raw,progress:raw.progress&&typeof raw.progress==='object'?raw.progress:{},saved:Array.isArray(raw.saved)?raw.saved:[],history:Array.isArray(raw.history)?raw.history:[],transcripts:raw.transcripts&&typeof raw.transcripts==='object'?raw.transcripts:{},customWords:Array.isArray(raw.customWords)?raw.customWords:[]};}catch{return defaultState();}};
let state=readState(),ep=EPISODES.find(e=>e.id===state.lastEpisode)||EPISODES[0],view='overview',category='全部',vocabFilter='all',practiceTab='blind',chosenCue=0,loopCueId=null,oneCueId=null,editCueId=null,dictationResult=null;
let player=null,ytWaiting=false,ytPlayerReady=false,pendingPlay=false,playerEpisodeId=null,localAudioURL=null,playingLocal=false,tickAt=Date.now(),persistAt=Date.now(),lastPaint=-1;
let recorder=null,micStream=null,recordTimer=null,recordStarted=0,recordParts=[],recordCurrent=null,recordUrls=[];
let toastTimeout=null;

const getP=(id)=>{state.progress[id]??={heard:[],total:0,last:0};return state.progress[id]};
const completion=(id)=>Math.min(100,Math.round((new Set(getP(id).heard||[]).size/600)*100));
const totalMinutes=()=>Math.round(Object.values(state.progress).reduce((s,p)=>s+(Number(p.total)||0),0)/60);
const finished=()=>EPISODES.filter(e=>completion(e.id)>=90).length;
const persist=()=>{try{localStorage.setItem(storageKey,JSON.stringify(state));return true;}catch(err){notify('本机存储空间不足，建议在「备份与迁移」导出数据。');return false;}};
const saveHistory=(type,details={})=>{state.history=[{type,epId:ep.id,at:new Date().toISOString(),...details},...state.history].slice(0,300);persist();};
const notify=(message)=>{const t=$('#toast');t.textContent=message;t.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>t.classList.remove('visible'),3500);};
const ytUrl=(episode=ep)=>`https://www.youtube.com/watch?v=${episode.videoId}&t=${episode.start}s`;
const sourceOpen=()=>window.open(ytUrl(),'_blank','noopener,noreferrer');
const cueList=()=>state.transcripts[ep.id]||[];
const allVocab=()=>[...EPISODES.flatMap(e=>e.vocab.map((v,i)=>({...v,key:`${e.id}:${i}`,episodeId:e.id,source:e.guest}))),...state.customWords.map(v=>({...v,tag:'PERSONAL',source:'我的添加',episodeId:null}))];
const isSaved=(key)=>state.saved.includes(key);
const bookmarkButton=(key)=>`<button class="bookmark-btn ${isSaved(key)?'is-saved':''}" data-bookmark="${escapeHTML(key)}" aria-label="${isSaved(key)?'取消收藏':'收藏单词'}" title="收藏/取消收藏">${svg('bookmark')}</button>`;
const addBookmark=(key)=>{if(isSaved(key))state.saved=state.saved.filter(x=>x!==key);else state.saved.push(key);persist();renderVocab();renderSide();renderOverview();notify(isSaved(key)?'已收藏到个人词库':'已取消收藏');};
const readableDate=(d)=>{try{return new Date(d).toLocaleDateString('zh-CN',{month:'short',day:'numeric'});}catch{return '—';}};

function lessonCard(e){const pct=completion(e.id);return `<article class="lesson-card"><button class="card-thumb" data-episode="${e.id}" aria-label="开始学习 ${escapeHTML(e.title)}" style="padding:0;border:0;display:block;width:100%"><img loading="lazy" src="https://i.ytimg.com/vi/${e.videoId}/hqdefault.jpg" alt="原频道视频封面：${escapeHTML(e.guest)}"><span class="card-top-tag">${e.category}</span><span class="card-time">${timecode(e.start)} — ${timecode(e.end)}</span><span class="card-play">${svg('play')}</span></button><div class="card-body"><div class="card-eyebrow">${escapeHTML(e.focus)}</div><h3>${escapeHTML(e.title)}</h3><p class="card-subtitle">${escapeHTML(e.subtitle)}</p><div class="card-bottom"><span class="guest-name">${escapeHTML(e.guest)}</span><span class="level-pill">${escapeHTML(e.level)}</span></div><div class="card-progress"><span style="width:${pct}%"></span></div></div></article>`;}

function renderOverview(){const pick=EPISODES.find(e=>e.id==='sinek-ai');$('#heroTitle').textContent=pick.title;$('#heroDesc').textContent=pick.description;$('#heroGuest').textContent=pick.guest.toUpperCase();$('#heroMeta').textContent=`${pick.category.toUpperCase()} · 10 MIN`;
$('#currentDate').textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}).toUpperCase();
const stat=[['headphones','听力时长',`${totalMinutes()} min`,''],['check','完成课程',`${finished()} / ${EPISODES.length}`,'mint'],['bookmark','收藏单词',`${state.saved.length}`,'peach'],['pen','听写次数',`${state.history.filter(h=>h.type==='dictation').length}`,'blue']];
$('#statsStrip').innerHTML=stat.map(([ico,label,value,c])=>`<div class="stat-cell"><div class="stat-icon ${c}">${svg(ico)}</div><div><strong>${value}</strong><small>${label}</small></div></div>`).join('');
$('#featuredGrid').innerHTML=[EPISODES[8],EPISODES[2],EPISODES[6]].map(lessonCard).join('');}
function renderLibrary(){const term=$('#lessonSearch').value.trim().toLowerCase();const filtered=EPISODES.filter(e=>(category==='全部'||e.category===category)&&[e.title,e.subtitle,e.guest,e.focus,e.description,...e.vocab.map(v=>v.term)].join(' ').toLowerCase().includes(term));$('#categoryFilters').innerHTML=categories.map(c=>`<button class="filter-btn ${category===c?'active':''}" data-category="${c}">${c}${c!=='全部'?` <span style="opacity:.6;font-size:9px">${EPISODES.filter(e=>e.category===c).length}</span>`:''}</button>`).join('');$('#resultsNote').textContent=`共 ${filtered.length} 段精选内容 · 每段 10 分钟 · 原频道嵌入播放`;
$('#libraryGrid').innerHTML=filtered.length?filtered.map(lessonCard).join(''):`<div class="empty-state">${svg('search')}<h3>未找到匹配内容</h3><p>试试其他关键词或切换话题。</p></div>`;}
function renderSide(){if(view!=='practice')return;$('#sideDescription').textContent=ep.description;$('#sideGuest').textContent=ep.guest;$('#sideChapter').textContent=ep.chapter;$('#sideFocus').textContent=ep.focus;
$('#sideVocab').innerHTML=ep.vocab.map((v,i)=>{const key=`${ep.id}:${i}`;return `<div class="vocab-small"><div><strong>${escapeHTML(v.term)}</strong><small>${escapeHTML(v.cn)} · ${escapeHTML(v.tag)}</small></div>${bookmarkButton(key)}</div>`;}).join('');
$('#sideExpressions').innerHTML=ep.phrases.map(p=>`<div class="expression-item"><strong>${escapeHTML(p.en)}</strong><p>${escapeHTML(p.cn)}</p><small>${escapeHTML(p.tip)}</small></div>`).join('');}
function renderVocab(){const q=$('#vocabSearch').value.trim().toLowerCase();const all=allVocab();let selection=all.filter(v=>(vocabFilter==='all'||(vocabFilter==='saved'&&isSaved(v.key))||(vocabFilter==='mine'&&v.tag==='PERSONAL'))&&`${v.term} ${v.cn}`.toLowerCase().includes(q));selection.sort((a,b)=>Number(isSaved(b.key))-Number(isSaved(a.key)));
$('#vocabSummary').innerHTML=`<div><strong>${state.saved.length}</strong><p>词语已收藏 · ${all.length} 个词条可浏览</p></div><div class="summary-symbol">${svg('bookmark')}</div>`;
$('#vocabList').innerHTML=selection.length?selection.map(v=>`<article class="vocab-card"><div><h3>${escapeHTML(v.term)}</h3><p>${escapeHTML(v.cn)}</p><div class="word-tags"><span class="tag-small ${v.tag==='PERSONAL'?'mine':''}">${escapeHTML(v.tag)}</span><span class="tag-small">${escapeHTML(v.source)}</span></div>${v.sample?`<p class="example">${escapeHTML(v.sample)}</p>`:''}</div><div>${bookmarkButton(v.key)}${v.tag==='PERSONAL'?`<button class="bookmark-btn" aria-label="删除该词汇" title="删除" data-delete-word="${escapeHTML(v.key)}">${svg('trash')}</button>`:''}</div></article>`).join(''):`<div class="empty-state">${svg('bookmark')}<h3>还没有符合条件的词汇</h3><p>在视频课程中收藏高频表达，或者添加自己的词组。</p></div>`;
$$('[data-vfilter]').forEach(b=>b.classList.toggle('active',b.dataset.vfilter===vocabFilter));}
function renderProgress(){const attempts=state.history.filter(h=>h.type==='dictation');const avg=attempts.length?Math.round(attempts.reduce((a,h)=>a+(Number(h.score)||0),0)/attempts.length):0;
const boxes=[['headphones',`${totalMinutes()} min`,'累计学习时长'],['check',`${finished()} / ${EPISODES.length}`,'完成的10分钟片段'],['bookmark',String(state.saved.length),'已收藏词语'],['award',attempts.length?`${avg}%`:'—','听写平均词汇匹配率']];
$('#progressStats').innerHTML=boxes.map(([i,v,label])=>`<div class="progress-stat">${svg(i)}<div class="big">${v}</div><small>${label}</small></div>`).join('');
$('#progressLessons').innerHTML=EPISODES.map(e=>`<div class="progress-lesson"><div><strong>${escapeHTML(e.title)}</strong><small>${escapeHTML(e.guest)} · ${e.category}</small></div><div class="bar"><span style="width:${completion(e.id)}%"></span></div><span class="percent">${completion(e.id)}%</span></div>`).join('');
const types={dictation:'听写',shadowing:'录音跟读',intensive:'逐句精听'};
$('#progressHistory').innerHTML=state.history.length?state.history.slice(0,20).map(h=>`<div class="history-item"><div><strong>${types[h.type]||'学习'} · ${escapeHTML(EPISODES.find(e=>e.id===h.epId)?.guest||'课程')}</strong><small>${readableDate(h.at)} · ${escapeHTML(EPISODES.find(e=>e.id===h.epId)?.title||'')}</small></div><span class="result">${h.type==='dictation'?`${Math.round(h.score||0)}% match`:h.type==='shadowing'?'录音保存':'句子练习'}</span></div>`).join(''):`<div class="empty-state">${svg('bar-chart')}<h3>练习从今天开始</h3><p>完成第一次听写或跟读后，记录会自动出现在这里。</p></div>`;}

function changeView(next){if(!['overview','library','practice','vocab','progress'].includes(next))next='overview';if(view==='practice'&&next!=='practice')pauseMedia();view=next;$$('.view').forEach(e=>e.classList.toggle('active',e.id===`view-${next}`));$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===next));$('#breadcrumbView').textContent=({overview:'Overview',library:'Library',practice:'Practice',vocab:'Vocabulary',progress:'My Progress'})[next];$('#sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'instant'});if(next==='overview')renderOverview();if(next==='library')renderLibrary();if(next==='practice')renderPractice();if(next==='vocab')renderVocab();if(next==='progress')renderProgress();try{history.replaceState(null,'',`#${next}`);}catch{}}
function openEpisode(id){const found=EPISODES.find(e=>e.id===id);if(!found)return;endRecording();pauseMedia();removeAudio(false);ep=found;state.lastEpisode=id;persist();practiceTab='blind';chosenCue=0;loopCueId=null;oneCueId=null;editCueId=null;dictationResult=null;lastPaint=-1;changeView('practice');mountYoutube();}

function renderPractice(){const pct=completion(ep.id);$('#practiceKicker').textContent=`${ep.category} · ${ep.level} · 10-MIN FOCUS`;$('#practiceTitle').textContent=ep.title;$('#practiceSubtitle').textContent=ep.subtitle;$('#completionPill').textContent=`${pct}% completed`;
$('#transcriptStatus').textContent=cueList().length?`${cueList().length} 句已导入`:'未导入逐字稿';$('#transcriptStatus').classList.toggle('ready',cueList().length>0);
$$('#practiceTabs button').forEach(b=>{b.classList.toggle('active',b.dataset.tab===practiceTab);b.setAttribute('aria-selected',b.dataset.tab===practiceTab?'true':'false');});renderPracticeContent();renderSide();paintPlayer();}
function changeTab(tab){if(!['blind','intensive','dictation','shadowing'].includes(tab))return;endRecording();practiceTab=tab;oneCueId=null;loopCueId=null;dictationResult=null;editCueId=null;renderPractice();}
function emptyCue(){return `<div class="prompt-empty">${svg('upload-cloud')}<strong>先导入与本视频对应的授权字幕</strong><p>支持 SRT、VTT、带时间戳的 TXT/TSV、JSON 或逐字稿。导入后可逐句精听、自动听写评分与跟读。</p><button class="inline-btn" data-open-import>${svg('upload')} 导入授权字幕</button></div>`;}
function renderPracticeContent(){const cues=cueList();let html='';
if(practiceTab==='blind'){html=`<div class="blind-illustration"><div class="wave">${[22,41,60,30,65,45,24,55,40,61,29,42,25].map((h,i)=>`<span style="--h:${h}px;--d:${i*.07}s"></span>`).join('')}</div><div class="lock-chip">${svg('lock')} 练习稿已隐藏</div></div><h3>先听懂观点，再寻找每一个词。</h3><p>点击上方播放，试着回答：嘉宾在解释什么？给出了什么证据？论证如何展开？</p><div class="helper-actions"><button class="inline-btn" data-start-listening>${svg('play')} 开始盲听</button><button class="inline-btn secondary" data-switch="intensive">进入逐句精听 ${svg('arrow-right')}</button></div><p class="muted-note" style="margin-top:15px">隐藏的是本站练习稿。YouTube 视频内的字幕请在播放器中关闭；真正的纯音频模式可在播放器下方导入你有权使用的音频文件。</p>`;}
if(practiceTab==='intensive'){html=cues.length?`<div class="dictation-target"><span>点击句子时间跳转，${svg('repeat')} 可循环一句。</span><button class="inline-btn secondary" data-open-import>${svg('upload')} 更换字幕</button></div><div class="cue-list">${cues.map((c,i)=>`<div class="cue-row" data-cue="${i}"><button class="cue-time" data-cue-play="${i}" aria-label="播放句子 ${i+1}">${timecode(c.start-ep.start)}</button><div>${editCueId===c.id?`<textarea class="cue-edit" data-edit-input="${i}" rows="2">${escapeHTML(c.text)}</textarea><div class="cue-edit-actions"><button data-save-cue="${i}">保存</button><button data-cancel-edit>取消</button></div>`:`<div class="cue-text" data-cue-play="${i}">${highlightVocab(escapeHTML(c.text))}</div>${c.estimated?'<small style="color:#ba9f68">时间为估算值</small>':''}`}</div><div class="cue-actions"><button data-cue-loop="${i}" class="${loopCueId===c.id?'selected':''}" aria-label="循环此句" title="循环此句">${svg('repeat')}</button><button data-cue-edit="${i}" aria-label="编辑句子" title="编辑句子">${svg('edit')}</button></div></div>`).join('')}</div>`:emptyCue();}
if(practiceTab==='dictation'){if(!cues.length)html=emptyCue();else{const c=cues[Math.min(chosenCue,cues.length-1)];html=`<div class="dictation-target"><span>选择句子，然后先听后写</span><select id="dictationCue" aria-label="听写句子">${cues.map((x,i)=>`<option value="${i}" ${i===chosenCue?'selected':''}>第 ${i+1} 句 · ${timecode(x.start-ep.start)} (${Math.round(x.end-x.start)}s)</option>`).join('')}</select></div><div class="helper-actions" style="margin:0 0 13px"><button class="inline-btn" data-cue-once="${chosenCue}">${svg('volume')} 播放当前句</button><button class="inline-btn secondary" data-repeat-cue="${chosenCue}">${svg('repeat')} 再听一次</button></div><textarea id="dictationAnswer" class="dictation-answer" rows="4" spellcheck="false" placeholder="Type exactly what you hear. 不用担心标点和大小写。"></textarea><div class="helper-actions"><button class="button button-dark" id="submitDictation">检查我的听写 ${svg('check')}</button><button class="inline-btn secondary" id="nextDictation">下一句 ${svg('arrow-right')}</button></div>${dictationResult?`<div class="check-result"><span class="grade">${dictationResult.score}%</span> <span>词汇匹配率（非语音识别评分）</span><div class="reference">${escapeHTML(c.text)}</div><p class="diff">${dictationResult.missing.length?`遗漏：${escapeHTML(dictationResult.missing.join(' · '))}`:'无遗漏'}${dictationResult.extra.length?`　多写：${escapeHTML(dictationResult.extra.join(' · '))}`:''}</p></div>`:''}`;}}
if(practiceTab==='shadowing'){if(!cues.length)html=emptyCue();else{const c=cues[Math.min(chosenCue,cues.length-1)];html=`<div class="shadow-select"><span style="font-size:11px;color:#8a94a3">选择跟读句</span><select id="shadowCue" aria-label="选择跟读句子">${cues.map((x,i)=>`<option value="${i}" ${i===chosenCue?'selected':''}>第 ${i+1} 句 · ${timecode(x.start-ep.start)}</option>`).join('')}</select></div><div class="recording-guide"><strong>${escapeHTML(c.text)}</strong><p style="margin:9px 0 0">先听原声，模仿重音、节奏与停顿。录音后回听对照。本版本不使用 AI 语音打分。</p></div><div class="recording-buttons"><button class="inline-btn" data-cue-once="${chosenCue}">${svg('volume')} 听原声</button><button class="record-btn ${recorder?.state==='recording'?'recording':''}" id="recordToggle">${svg(recorder?.state==='recording'?'stop':'mic')}${recorder?.state==='recording'?'停止录音':'开始跟读录音'}</button><span class="record-time" id="recordClock">${recorder?.state==='recording'?'00:00':''}</span></div><audio id="latestRecording" class="recording-audio" controls hidden></audio><div class="recordings-list" id="recordingsList"></div><p class="muted-note" style="margin:15px 0 0">录音需要 HTTPS 和麦克风授权；仅在本机浏览器的 IndexedDB 保存。</p>`;}}
$('#practiceContent').innerHTML=html;if(practiceTab==='shadowing'&&cues.length)renderRecordings();if(practiceTab==='intensive')highlightActiveCue();}
function highlightVocab(html){let text=html;for(const v of ep.vocab){const w=v.term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');try{text=text.replace(new RegExp(`\\b(${w})\\b`,'gi'),'<mark>$1</mark>');}catch{}}return text;}

function mountYoutube(){if(!safeYoutubeId(ep.videoId))return;const requested=ep.id;ytPlayerReady=false;playerEpisodeId=requested;pendingPlay=false;$('#playerFallback').hidden=true;
if(player?.destroy){try{player.destroy();}catch{}}player=null;if(!$('#ytHost')){const fresh=document.createElement('div');fresh.id='ytHost';fresh.className='yt-host';$('.player-stage').prepend(fresh);}$('#ytHost').innerHTML=`<div class="youtube-placeholder"><span class="spinner"></span><span>正在加载官方嵌入播放器…</span></div>`;
if(window.YT?.Player){createYT(requested);return;}
if(!ytWaiting){ytWaiting=true;window.onYouTubeIframeAPIReady=()=>{ytWaiting=false;createYT(playerEpisodeId);};let s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.onerror=()=>{$('#playerFallback').hidden=false;ytWaiting=false;};document.head.appendChild(s);}}
function createYT(requested){if(view!=='practice'||requested!==ep.id||!window.YT?.Player)return;const episode=ep;
try{player=new window.YT.Player('ytHost',{videoId:episode.videoId,host:'https://www.youtube-nocookie.com',playerVars:{playsinline:1,controls:1,rel:0,cc_load_policy:0,start:episode.start,end:episode.end,enablejsapi:1,origin:location.origin==='null'?undefined:location.origin},events:{onReady:()=>{if(episode.id!==ep.id)return;ytPlayerReady=true;const p=getP(ep.id);try{player.seekTo(ep.start+Math.min(599,Math.max(0,p.last||0)),true);}catch{}if(pendingPlay){pendingPlay=false;player.playVideo();}notify('播放器已就绪。');},onError:()=>{$('#playerFallback').hidden=false;ytPlayerReady=false;},onStateChange:ev=>{if(ev.data===0&&episode.id===ep.id){pauseMedia();}}}});}catch{$('#playerFallback').hidden=false;}}
function getPos(){if(playingLocal){const a=$('#studyAudio');return ep.start+(Number(a.currentTime)||0);}try{if(ytPlayerReady&&typeof player?.getCurrentTime==='function')return Number(player.getCurrentTime())||ep.start;}catch{}return ep.start+Math.max(0,getP(ep.id).last||0);}
function isMediaPlaying(){if(playingLocal)return !$('#studyAudio').paused;try{return ytPlayerReady&&player?.getPlayerState()===window.YT.PlayerState.PLAYING;}catch{return false;}}
function pauseMedia(){try{player?.pauseVideo?.();}catch{}$('#studyAudio').pause();}
function mediaPlay(){if(playingLocal){const a=$('#studyAudio');a.play().catch(()=>notify('当前浏览器阻止了音频播放，请点击播放器中的播放键。'));return;}if(!ytPlayerReady){pendingPlay=true;if(!player)mountYoutube();notify('正在准备 YouTube 播放器，也可点击右上角打开原视频。');return;}try{player.playVideo();}catch{sourceOpen();}}
function mediaSeek(t){const clamped=Math.max(ep.start,Math.min(ep.end-.1,Number(t)||ep.start));const p=getP(ep.id);p.last=clamped-ep.start;if(playingLocal){$('#studyAudio').currentTime=Math.max(0,Math.min($('#studyAudio').duration||600,clamped-ep.start));}else{try{if(ytPlayerReady)player.seekTo(clamped,true);}catch{}}paintPlayer();}
function playbackRate(value){const rate=Number(value)||1;$('#studyAudio').playbackRate=rate;try{player?.setPlaybackRate?.(rate);}catch{}}
function toggleMedia(){if(isMediaPlaying())pauseMedia();else mediaPlay();paintPlayer();}
function playCue(index,repeat=false){const cues=cueList();const cue=cues[index];if(!cue)return;chosenCue=index;oneCueId=repeat?null:cue.id;loopCueId=repeat?cue.id:null;mediaSeek(cue.start);mediaPlay();if(practiceTab==='intensive')renderPracticeContent();}
function tick(){if(view!=='practice')return;const now=Date.now(),pos=getPos();const playing=isMediaPlaying();if(playing){const p=getP(ep.id);const rel=Math.min(599,Math.max(0,Math.floor(pos-ep.start)));if(!p.heard.includes(rel))p.heard.push(rel);p.total=(Number(p.total)||0)+Math.max(0,Math.min(.75,(now-tickAt)/1000));p.last=Math.max(0,Math.min(600,pos-ep.start));if(pos>=ep.end-.2){pauseMedia();p.last=600;loopCueId=null;oneCueId=null;notify('本段播放结束。可以进入精听或跟读。');}
const current=cueList().find(c=>c.id===loopCueId||c.id===oneCueId);if(current&&pos>=current.end-.13){if(loopCueId){mediaSeek(current.start);mediaPlay();}else{pauseMedia();oneCueId=null;}}
if(now-persistAt>2400){persist();persistAt=now;} }
tickAt=now;if(Math.abs(pos-lastPaint)>=.8||!playing){paintPlayer();lastPaint=pos;}}
function paintPlayer(){if(view!=='practice')return;const pos=getPos();const elapsed=Math.max(0,Math.min(600,pos-ep.start));$('#seekSlider').value=String(Math.round(elapsed));$('#playerTime').textContent=`${timecode(elapsed)} / 10:00`;$('#togglePlay').innerHTML=svg(isMediaPlaying()?'pause':'play');$('#completionPill').textContent=`${completion(ep.id)}% completed`;highlightActiveCue();}
function highlightActiveCue(){if(practiceTab!=='intensive')return;const pos=getPos();$$('.cue-row').forEach(el=>{const c=cueList()[Number(el.dataset.cue)];el.classList.toggle('active',c&&c.start<=pos&&pos<c.end);});}
function removeAudio(announce=true){pauseMedia();playingLocal=false;if(localAudioURL){URL.revokeObjectURL(localAudioURL);localAudioURL=null;}$('#studyAudio').removeAttribute('src');$('#studyAudio').load();$('#audioFile').value='';$('#removeAudio').hidden=true;if(announce)notify('已切回 YouTube 原视频模式。');}
function importAudio(file){if(!file||!file.type.startsWith('audio/')){notify('请选择有效的音频文件。');return;}pauseMedia();if(localAudioURL)URL.revokeObjectURL(localAudioURL);localAudioURL=URL.createObjectURL(file);const audio=$('#studyAudio');audio.src=localAudioURL;audio.currentTime=0;audio.load();playingLocal=true;$('#removeAudio').hidden=false;playbackRate($('#playSpeed').value);notify('已切换到授权本地音频。默认按10分钟片段起点对齐。');}

function openImport(){const select=$('#transcriptEpisode');select.innerHTML=EPISODES.map(e=>`<option value="${e.id}" ${e.id===ep.id?'selected':''}>${e.category} · ${escapeHTML(e.guest)} · ${escapeHTML(e.title)}</option>`).join('');$('#transcriptFile').value='';$('#transcriptPaste').value='';$('#uploadTitle').textContent='选择文件（SRT、VTT、TXT、JSON、TSV）';$('#importError').textContent='';$('#timebase').value='auto';$('#importDialog').showModal();}
async function importTranscript(){const target=EPISODES.find(e=>e.id===$('#transcriptEpisode').value),file=$('#transcriptFile').files?.[0];if(!target)return;const raw=$('#transcriptPaste').value.trim()||(file?await file.text():'');if(!raw.trim()){$('#importError').textContent='请先选择文件或粘贴字幕内容。';return;}if(raw.length>900_000){$('#importError').textContent='字幕文本过大，请导入不超过 900 KB 的文件。';return;}
const cues=parseTranscript(raw,{start:target.start,end:target.end,timebase:$('#timebase').value});if(!cues.length){$('#importError').textContent='没能匹配到片段内字幕。请检查时间基准或时间码格式。';return;}
state.transcripts[target.id]=cues;persist();$('#importDialog').close();notify(`已导入 ${cues.length} 句字幕，保存在当前浏览器。`);if(target.id!==ep.id){openEpisode(target.id);}else if(view==='practice')renderPractice();}

const dbName='ceo-english-lab-recordings';let dbPromise=null;
function openDB(){if(!('indexedDB'in window))return Promise.reject(new Error('no indexedDB'));if(dbPromise)return dbPromise;dbPromise=new Promise((resolve,reject)=>{let req=indexedDB.open(dbName,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('recordings')){const store=db.createObjectStore('recordings',{keyPath:'id'});store.createIndex('episodeId','episodeId');}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});return dbPromise;}
async function dbAdd(record){const db=await openDB();return new Promise((resolve,reject)=>{let tx=db.transaction('recordings','readwrite');tx.objectStore('recordings').put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
async function dbGetByEpisode(id){const db=await openDB();return new Promise((resolve,reject)=>{const req=db.transaction('recordings').objectStore('recordings').index('episodeId').getAll(id);req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}
async function dbRemove(id){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('recordings','readwrite');tx.objectStore('recordings').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
async function beginRecording(){if(recorder?.state==='recording'){endRecording();return;}if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){notify('此浏览器不支持录音。请使用最新版 Safari / Chrome 的 HTTPS 页面。');return;}
try{micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});const types=['audio/webm;codecs=opus','audio/mp4','audio/webm'];const mime=types.find(x=>MediaRecorder.isTypeSupported(x));recorder=mime?new MediaRecorder(micStream,{mimeType:mime}):new MediaRecorder(micStream);recordParts=[];recordStarted=Date.now();const thisEp=ep.id,thisCue=cueList()[chosenCue]?.id||null;
recorder.ondataavailable=e=>{if(e.data.size)recordParts.push(e.data);};recorder.onstop=async()=>{try{const blob=new Blob(recordParts,{type:recorder.mimeType||'audio/webm'});if(blob.size>0){await dbAdd({id:`rec-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,episodeId:thisEp,cueId:thisCue,createdAt:new Date().toISOString(),blob});if(ep.id===thisEp&&view==='practice')await renderRecordings();saveHistory('shadowing',{epId:thisEp,cueId:thisCue});notify('录音已保存在此设备。');}}catch{notify('录音保存失败，请检查浏览器存储权限。');}finally{micStream?.getTracks().forEach(t=>t.stop());micStream=null;}};
recorder.start();$('#recordToggle').innerHTML=`${svg('stop')} 停止录音`;$('#recordToggle').classList.add('recording');recordTimer=setInterval(()=>{const t=$('#recordClock');if(t)t.textContent=timecode((Date.now()-recordStarted)/1000);if(Date.now()-recordStarted>61000)endRecording();},300);notify('开始录音，请跟读原句。最长60秒。');}catch(e){micStream?.getTracks().forEach(t=>t.stop());notify(e?.name==='NotAllowedError'?'麦克风权限被拒绝，请在浏览器设置中允许访问。':'麦克风暂时不可用，请检查设备权限。');}}
function endRecording(){if(recordTimer)clearInterval(recordTimer);recordTimer=null;if(recorder?.state==='recording'){try{recorder.stop();}catch{}}const btn=$('#recordToggle');if(btn){btn.innerHTML=`${svg('mic')} 开始跟读录音`;btn.classList.remove('recording');}}
async function renderRecordings(){for(const u of recordUrls)URL.revokeObjectURL(u);recordUrls=[];const root=$('#recordingsList');if(!root)return;try{const records=(await dbGetByEpisode(ep.id)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,10);if(!$('#recordingsList'))return;root.innerHTML=records.map(r=>{const url=URL.createObjectURL(r.blob);recordUrls.push(url);return `<div class="recorded-item"><span>${readableDate(r.createdAt)} · ${escapeHTML(r.cueId||'语音')}</span><audio controls preload="none" src="${url}"></audio><button class="bookmark-btn" aria-label="删除录音" data-delete-rec="${escapeHTML(r.id)}">${svg('trash')}</button></div>`;}).join('');if(!records.length)root.innerHTML='<p class="muted-note">暂无录音记录。录下第一句后就会出现在这里。</p>';}catch{root.innerHTML='<p class="muted-note">此浏览器不支持保存录音，但仍可尝试录制并回听。</p>';}}

function createBackup(){const blob=new Blob([exportJSON(state)],{type:'application/json;charset=utf-8'});downloadBlob(blob,`ceo-english-lab-backup-${new Date().toISOString().slice(0,10)}.json`);notify('已导出学习备份（不含录音文件）。');}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
async function restoreBackup(file){if(!file)return;try{if(file.size>8*1024*1024)throw Error('备份文件超过 8 MB');const obj=JSON.parse(await file.text());if(!validBackup(obj))throw Error('这不是 CEO English Lab v1 备份');const d=obj.data;state={...state,progress:{...state.progress,...(d.progress||{})},saved:[...new Set([...state.saved,...(Array.isArray(d.saved)?d.saved:[])])],history:[...state.history,...(Array.isArray(d.history)?d.history:[])].sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,300),transcripts:{...state.transcripts,...(d.transcripts||{})},customWords:[...state.customWords,...(Array.isArray(d.customWords)?d.customWords:[])],lastEpisode:state.lastEpisode};persist();$('#backupDialog').close();renderOverview();renderVocab();renderProgress();renderPractice();notify('备份已成功导入。不同设备间需手动迁移。');}catch(e){notify(`导入失败：${e.message||'文件格式有误'}`);}}

function bindEvents(){
$$('[data-icon]').forEach(e=>e.innerHTML=svg(e.dataset.icon));$('#libraryCount').textContent=String(EPISODES.length);
$$('.nav-item').forEach(b=>b.addEventListener('click',()=>changeView(b.dataset.view)));$('#menuToggle').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
$('#heroStart').addEventListener('click',()=>openEpisode('sinek-ai'));$('#seeAll').addEventListener('click',()=>changeView('library'));
$('#categoryFilters').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b){category=b.dataset.category;renderLibrary();}});
$('#lessonSearch').addEventListener('input',renderLibrary);
$('#featuredGrid').addEventListener('click',selectCard);$('#libraryGrid').addEventListener('click',selectCard);
$('#backLibrary').addEventListener('click',()=>changeView('library'));$('#openSource').addEventListener('click',sourceOpen);$('#fallbackOpen').addEventListener('click',sourceOpen);
$('#togglePlay').addEventListener('click',toggleMedia);$('#seekBack').addEventListener('click',()=>mediaSeek(getPos()-5));$('#seekForward').addEventListener('click',()=>mediaSeek(getPos()+5));$('#seekSlider').addEventListener('input',e=>mediaSeek(ep.start+Number(e.target.value)));$('#playSpeed').addEventListener('change',e=>playbackRate(e.target.value));$('#audioFile').addEventListener('change',e=>importAudio(e.target.files[0]));$('#removeAudio').addEventListener('click',()=>removeAudio());
$('#practiceTabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)changeTab(b.dataset.tab);});
$('#practiceContent').addEventListener('click',async e=>{const b=e.target.closest('button,[data-cue-play]');if(!b)return;
if(b.hasAttribute('data-open-import')){openImport();return;}if(b.hasAttribute('data-start-listening')){mediaSeek(ep.start);mediaPlay();return;}if(b.dataset.switch){changeTab(b.dataset.switch);return;}
if(b.hasAttribute('data-cue-play')){const idx=Number(b.dataset.cuePlay);playCue(idx,false);return;}
if(b.hasAttribute('data-cue-loop')){const idx=Number(b.dataset.cueLoop),cue=cueList()[idx];if(cue&&loopCueId===cue.id){loopCueId=null;oneCueId=null;renderPracticeContent();}else playCue(idx,true);return;}
if(b.hasAttribute('data-cue-edit')){editCueId=cueList()[Number(b.dataset.cueEdit)]?.id;renderPracticeContent();return;}
if(b.hasAttribute('data-cancel-edit')){editCueId=null;renderPracticeContent();return;}
if(b.hasAttribute('data-save-cue')){const i=Number(b.dataset.saveCue),t=$(`[data-edit-input="${i}"]`)?.value.trim();if(t&&t.length<1500){state.transcripts[ep.id][i].text=t;persist();editCueId=null;renderPracticeContent();notify('句子已更新。');}return;}
if(b.hasAttribute('data-cue-once')){playCue(Number(b.dataset.cueOnce),false);return;}if(b.hasAttribute('data-repeat-cue')){playCue(Number(b.dataset.repeatCue),false);return;}
if(b.id==='submitDictation'){const answer=$('#dictationAnswer')?.value.trim(),reference=cueList()[chosenCue]?.text;if(!answer){notify('请先输入听到的内容。');return;}dictationResult=dictationScore(answer,reference);saveHistory('dictation',{score:dictationResult.score,cueId:cueList()[chosenCue]?.id});const keep=answer;renderPracticeContent();$('#dictationAnswer').value=keep;return;}
if(b.id==='nextDictation'){chosenCue=(chosenCue+1)%cueList().length;dictationResult=null;renderPracticeContent();return;}
if(b.id==='recordToggle'){beginRecording();return;}
if(b.hasAttribute('data-delete-rec')){if(confirm('删除此条本机录音？')){await dbRemove(b.dataset.deleteRec);renderRecordings();notify('已删除录音。');}return;}
});
$('#practiceContent').addEventListener('change',e=>{if(e.target.id==='dictationCue'||e.target.id==='shadowCue'){chosenCue=Number(e.target.value);dictationResult=null;renderPracticeContent();}});
$('#sideVocab').addEventListener('click',e=>{const b=e.target.closest('[data-bookmark]');if(b)addBookmark(b.dataset.bookmark);});
$('#vocabList').addEventListener('click',e=>{const b=e.target.closest('[data-bookmark],[data-delete-word]');if(!b)return;if(b.dataset.bookmark){addBookmark(b.dataset.bookmark);return;}const key=b.dataset.deleteWord;if(confirm('永久删除此个人词汇？')){state.customWords=state.customWords.filter(v=>v.key!==key);state.saved=state.saved.filter(v=>v!==key);persist();renderVocab();}});
$('#vocabFilter').addEventListener('click',e=>{const b=e.target.closest('[data-vfilter]');if(b){vocabFilter=b.dataset.vfilter;renderVocab();}});$('#vocabSearch').addEventListener('input',renderVocab);
$('#newWord').addEventListener('click',()=>$('#wordDialog').showModal());$('#closeWord').addEventListener('click',()=>$('#wordDialog').close());$('#cancelWord').addEventListener('click',()=>$('#wordDialog').close());
$('#wordForm').addEventListener('submit',e=>{e.preventDefault();const term=$('#wordEnglish').value.trim(),cn=$('#wordChinese').value.trim(),sample=$('#wordExample').value.trim();if(!term||!cn)return;const key=`mine:${Date.now()}:${Math.random().toString(36).slice(2,7)}`;state.customWords.push({term,cn,sample,key});state.saved.push(key);persist();$('#wordForm').reset();$('#wordDialog').close();renderVocab();notify('个人词汇已添加并收藏。');});
$('#navImport').addEventListener('click',openImport);$('#cancelImport').addEventListener('click',()=>$('#importDialog').close());$('#saveTranscript').addEventListener('click',importTranscript);$('#transcriptFile').addEventListener('change',e=>$('#uploadTitle').textContent=e.target.files?.[0]?.name||'选择文件');
$('#navBackup').addEventListener('click',()=>$('#backupDialog').showModal());$('#closeBackup').addEventListener('click',()=>$('#backupDialog').close());$('#downloadBackup').addEventListener('click',createBackup);$('#progressExport').addEventListener('click',createBackup);$('#backupFile').addEventListener('change',e=>restoreBackup(e.target.files?.[0]));
$('#studyAudio').addEventListener('ended',()=>{notify('片段音频播放结束。');paintPlayer();});
window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(next&&next!==view)changeView(next);});
window.addEventListener('beforeunload',()=>{persist();endRecording();});
setInterval(tick,350);
}
function selectCard(e){const b=e.target.closest('[data-episode]');if(b)openEpisode(b.dataset.episode);}
function boot(){bindEvents();renderOverview();renderLibrary();changeView(['overview','library','vocab','progress'].includes(location.hash.slice(1))?location.hash.slice(1):'overview');}
boot();