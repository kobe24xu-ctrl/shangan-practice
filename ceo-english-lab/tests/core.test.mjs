import test from 'node:test';
import assert from 'node:assert/strict';
import {timecode,parseClock,splitSentences,parseTranscript,dictationScore,normalize,safeYoutubeId,escapeHTML,exportJSON,validBackup,scheduleReview,isReviewDue,quizletTSV,exportSRT} from '../core.mjs';
import {EPISODES,categories} from '../data.mjs';
import {WARMUPS} from '../warmups.mjs';
test('all chapters have valid YouTube IDs and original warmup packs',()=>{
  assert.equal(EPISODES.length,10);assert.equal(categories.length,6);
  for(const ep of EPISODES){assert.ok(safeYoutubeId(ep.videoId));assert.equal(ep.end-ep.start,600);assert.equal(WARMUPS[ep.id].length,4);for(const x of WARMUPS[ep.id])assert.ok(x.en&&x.zh&&x.tip);}
});
test('timecodes',()=>{assert.equal(timecode(71),'01:11');assert.equal(parseClock('01:02:03,500'),3723.5);assert.equal(parseClock('01:12.100'),72.1);assert.ok(Number.isNaN(parseClock('garbage')));});
test('parse full-video SRT with absolute timestamps',()=>{
 const raw=`1\n00:02:22,000 --> 00:02:26,200\nWe should examine the evidence.\n\n2\n00:02:30,000 --> 00:02:34,000\nThe impact may be limited.\n`;
 const v=parseTranscript(raw,{start:142,end:742,timebase:'absolute'});
 assert.equal(v.length,2);assert.equal(v[0].start,142);assert.equal(v[0].text,'We should examine the evidence.');
});
test('parse relative VTT with cue metadata and text markup',()=>{
 const v=parseTranscript('WEBVTT\n\n00:00:01.000 --> 00:00:04.200 align:start position:0%\n<b>Let us</b> begin.\n\n',{start:300,end:900,timebase:'relative'});
 assert.equal(v.length,1);assert.equal(v[0].start,301);assert.equal(v[0].text,'Let us begin.');
});
test('parse JSON cues and TSV',()=>{
 const j=parseTranscript(JSON.stringify([{start:4,end:8,text:'Reasonable evidence matters.'}]),{start:100,end:700,timebase:'relative'});
 assert.equal(j[0].start,104);
 const t=parseTranscript('0\t3\tA small change.\n3\t6\tA bigger effect.',{start:100,end:700,timebase:'relative'});
 assert.equal(t.length,2);assert.equal(t[1].text,'A bigger effect.');
});
test('untimed original paragraphs are approximate, no fake precision',()=>{
 const v=parseTranscript('A good question matters. The answer takes some time.',{start:50,end:650});
 assert.equal(v.length,2);assert.ok(v.every(x=>x.estimated));assert.equal(v[0].start,50);assert.equal(v[1].end,650);
});
test('dictation scores and escaping',()=>{
 assert.equal(dictationScore('The real challenge is to adapt.','The real challenge is to adapt.').score,100);
 const d=dictationScore('The challenge adapt','The real challenge is to adapt.');assert.ok(d.score<100);assert.ok(d.missing.includes('real'));
 assert.equal(escapeHTML('<script>'), '&lt;script&gt;');assert.equal(normalize('A, B!'), 'a b');
});
test('SM2-inspired scheduler intervals and due checks',()=>{
 const now=Date.parse('2026-11-19T10:00:00Z');
 const again=scheduleReview({},'again',now);assert.equal(again.reviews,1);assert.equal(again.streak,0);assert.equal(new Date(again.dueAt).getTime()-now,600000);
 const good=scheduleReview({},'good',now);assert.equal(good.intervalDays,1);assert.equal(good.streak,1);
 const next=scheduleReview(good,'good',now+86400000);assert.equal(next.intervalDays,2);
 const easy=scheduleReview({},'easy',now);assert.equal(easy.intervalDays,4);
 const hard=scheduleReview({},'hard',now);assert.ok(hard.intervalDays>.3);
 assert.equal(isReviewDue(good,now),false);assert.equal(isReviewDue(good,now+86400001),true);
 assert.equal(isReviewDue(undefined,now),true);
});
test('Quizlet TSV strips tabs/newlines and deduplicates terms',()=>{
 const t=quizletTSV([{term:'value proposition',cn:'价值主张'},{term:'Value proposition',cn:'重复'},{term:'critical\tthinking',cn:'批判\n思考'}]);
 assert.equal(t.split('\n').length,2);assert.ok(t.includes('value proposition\t价值主张'));assert.ok(t.includes('critical thinking\t批判 思考'));
});
test('SRT exporter produces clipped relative times',()=>{
 const s=exportSRT([{start:142,end:145.5,text:'Original authorized sentence.'}],142);
 assert.ok(s.includes('00:00:00,000 --> 00:00:03,500'));assert.ok(s.includes('Original authorized sentence.'));
});
test('v1 backup envelope preserves compatibility with v2 keys',()=>{
 const raw=exportJSON({saved:[],reviews:{'sinek-ai:0':scheduleReview({},'good')}});const parsed=JSON.parse(raw);
 assert.ok(validBackup(parsed));assert.ok(parsed.data.reviews['sinek-ai:0']);assert.equal(validBackup({app:'xxx'}),false);
});