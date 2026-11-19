from playwright.sync_api import sync_playwright
from pathlib import Path
import json
ROOT=Path('/mnt/data/ceo-english-lab')
OUT=ROOT/'test-artifacts';OUT.mkdir(exist_ok=True)
markup=(ROOT/'index.html').read_text()
styles=(ROOT/'styles.css').read_text()
source='\n'.join((ROOT/name).read_text().replace('export function ','function ').replace('export const ','const ') for name in ['core.mjs','data.mjs','warmups.mjs'])
source+='\n'+'\n'.join(line for line in (ROOT/'app.mjs').read_text().splitlines() if not line.startswith('import '))
markup=markup.replace('<link rel="stylesheet" href="styles.css?v=2.1">',f'<style>{styles}</style>')
markup=markup.replace('<script type="module" src="app.mjs?v=2.1"></script>',f'<script>(function(){{\n{source}\n}})();</script>')
YT_MOCK="""
window.YT={PlayerState:{PLAYING:1,PAUSED:2,ENDED:0},Player:class {
 constructor(id,opts){this.opts=opts;this.state=2;this.pos=opts.playerVars.start;document.getElementById(id).innerHTML='<div style="background:#161f35;height:100%;display:grid;place-items:center;color:#eee">YouTube player test stub</div>';setTimeout(()=>opts.events.onReady?.(),0);}
 seekTo(t){this.pos=t;}
 getCurrentTime(){return this.pos;}
 playVideo(){this.state=1;}
 pauseVideo(){this.state=2;}
 getPlayerState(){return this.state;}
 setPlaybackRate(v){this.rate=v;}
 destroy(){this.state=2;}
}};
"""
STORAGE_MOCK="""() => {
  const db={};
  Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>db[k]||null,setItem:(k,v)=>db[k]=String(v),removeItem:k=>delete db[k],clear:()=>Object.keys(db).forEach(k=>delete db[k])}});
}"""

def load(page,hash=None,storage=None):
 page.evaluate(STORAGE_MOCK)
 page.evaluate(YT_MOCK)
 if storage:
  page.evaluate('(s)=>localStorage.setItem("ceo-english-lab:v1",s)',storage)
 if hash:
  page.evaluate('(h)=>location.hash=h',hash)
 page.set_content(markup,wait_until='domcontentloaded')

results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 ctx=browser.new_context(viewport={'width':1440,'height':940},accept_downloads=True)
 page=ctx.new_page();errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 load(page)
 page.wait_for_selector('#featuredGrid .lesson-card')
 assert page.locator('#featuredGrid .lesson-card').count()==3
 assert page.locator('#libraryCount').inner_text()=='10'
 results.append('Homepage and 10-lesson catalog render')
 page.screenshot(path=str(OUT/'overview-v2-desktop.png'),full_page=True)
 # The module bundle is evaluated in-memory because sandbox policy blocks localhost/file navigation.
 page.locator('#heroStart').click()
 assert 'Human Skills in the Age of AI' in page.locator('#practiceTitle').inner_text()
 assert 'practice/sinek-ai' in page.url
 results.append('Episode deep-link created and YouTube player initialized')
 page.locator('[data-tab="warmup"]').click()
 assert '原创练习内容' in page.locator('.warmup-disclaimer').inner_text()
 page.locator('#warmupAnswer').fill('Technology can amplify human abilities without replacing human judgment.')
 page.locator('#checkWarmup').click()
 assert page.locator('.check-result .grade').inner_text()=='100%'
 page.locator('#nextWarmup').click()
 assert 'EXERCISE 2 / 4' in page.locator('.warmup-count').inner_text()
 results.append('Original 40-sentence warmup: input, scoring and next-sentence flow')
 page.screenshot(path=str(OUT/'warmup-v2-desktop.png'),full_page=True)
 page.locator('#navImport').click()
 page.locator('#timebase').select_option('relative')
 page.locator('#transcriptPaste').fill('1\n00:00:01,000 --> 00:00:03,000\nTechnology changes the way we work.\n\n2\n00:00:04,000 --> 00:00:08,000\nPeople need critical thinking.\n')
 assert '匹配到 2 条字幕' in page.locator('#transcriptPreview').inner_text()
 page.locator('#saveTranscript').click()
 page.locator('[data-tab="intensive"]').click()
 assert page.locator('.cue-row').count()==2
 assert page.locator('#transcriptStatus').inner_text()=='2 句已导入'
 with page.expect_download() as dl:
  page.locator('#exportTranscript').click()
 download=dl.value
 assert download.suggested_filename.endswith('.srt')
 download.save_as(OUT/'exported-transcript.srt')
 assert '00:00:01,000' in (OUT/'exported-transcript.srt').read_text()
 results.append('Authorized SRT import preview, sentence list and SRT export')
 page.locator('[data-tab="dictation"]').click()
 page.locator('#dictationAnswer').fill('Technology changes the way we work.')
 page.locator('#submitDictation').click()
 assert page.locator('.check-result .grade').inner_text()=='100%'
 results.append('Imported-transcript dictation grades accurately')
 page.locator('[data-view="vocab"]').click()
 page.locator('#vocabList [data-bookmark]').first.click()
 assert page.locator('#reviewCount').inner_text()=='1'
 with page.expect_download() as dl2:
  page.locator('#exportQuizlet').click()
 d2=dl2.value;assert d2.suggested_filename.endswith('.tsv');d2.save_as(OUT/'quizlet.tsv')
 assert '\t' in (OUT/'quizlet.tsv').read_text(encoding='utf-8-sig')
 results.append('Bookmark and Quizlet TSV export')
 page.locator('#reviewLaunch').click()
 assert page.locator('.review-main-term').count()==1
 page.locator('#revealReview').click()
 assert page.locator('.review-rating button').count()==4
 page.locator('[data-review-rating="good"]').click()
 assert page.locator('#reviewCount').inner_text()=='0'
 assert '今日词汇已复习完毕' in page.locator('#reviewCard').inner_text()
 results.append('Daily spaced repetition queues and records ratings')
 page.locator('[data-view="progress"]').click()
 assert '原创热身听写' in page.locator('#progressHistory').inner_text()
 assert '单词复习' in page.locator('#progressHistory').inner_text()
 state=page.evaluate('localStorage.getItem("ceo-english-lab:v1")')
 assert 'reviews' in state
 page2=ctx.new_page();page2.on('pageerror',lambda e: errors.append('reload: '+str(e)))
 load(page2,'#practice/sinek-ai',state)
 assert page2.locator('#practiceTitle').inner_text()=='Human Skills in the Age of AI'
 assert page2.locator('#transcriptStatus').inner_text()=='2 句已导入'
 assert page2.locator('#reviewCount').inner_text()=='0'
 results.append('Deep-link cold start restores lesson, transcript and spaced-review state')
 page2.screenshot(path=str(OUT/'practice-v2-desktop.png'),full_page=True)
 for name,vp in [('ipad',{'width':820,'height':1180}),('mobile',{'width':390,'height':844})]:
  responsive=ctx.new_page();responsive.set_viewport_size(vp)
  responsive.on('pageerror',lambda e: errors.append(name+': '+str(e)))
  load(responsive,'#practice/hinton-ai',state)
  responsive.locator('[data-tab="warmup"]').click()
  responsive.screenshot(path=str(OUT/f'warmup-v2-{name}.png'),full_page=True)
  width=responsive.evaluate('Math.round(document.documentElement.scrollWidth)')
  assert width<=vp['width']+1,f'{name} horizontal overflow: {width}>{vp["width"]}'
  assert responsive.locator('#warmupAnswer').is_visible()
  if name=='mobile':
   responsive.locator('#menuToggle').click()
   assert 'open' in responsive.locator('#sidebar').get_attribute('class')
  results.append(f'{name} {vp["width"]}x{vp["height"]} responsive UI fits and supports practice')
  responsive.close()
 assert not errors, f'Uncaught JavaScript errors: {errors}'
 results.append('No uncaught JavaScript exceptions')
 browser.close()
print(json.dumps({'passed':len(results),'cases':results,'errors':errors},ensure_ascii=False,indent=2))