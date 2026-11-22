import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCampaignLevel,createOpeningLevel} from '../dist/levels.js';
import {clone,evaluateLayout,validateLevel} from '../dist/engine.js';
import {generationQualityErrors} from '../dist/generation-quality.js';
import {furnitureIntroducedAt} from '../dist/progression.js';
import {SHAPE_INTRODUCTIONS} from '../dist/shape-catalog.js';
import {variationKey} from '../dist/variation-seed.js';
import {createCommissionGenerator} from '../dist/generation-client.js';
import {rankFallbackEntries} from '../dist/puzzle-diversity.js';
const index=JSON.parse(readFileSync(new URL('../dist/data/fallback-index.json',import.meta.url)));
const fetcher=async url=>({ok:true,json:async()=>JSON.parse(readFileSync(new URL('../dist/data/'+(url.pathname.endsWith('fallback-index.json')?'fallback-index.json':'levels/'+url.pathname.split('/').at(-1)),import.meta.url)))});
test('轮次键稳定且有界，无键保持原随机流，前11题教学布局保持',()=>{
  assert.equal(variationKey(null),'');assert.equal(variationKey({}), '');assert.equal(variationKey(''),'');assert.match(variationKey('中文轮次'),/^[0-9a-f]{16}$/);
  assert.notEqual(variationKey('A'),variationKey('B'));assert.equal(variationKey('x'.repeat(128)+'a'),variationKey('x'.repeat(128)+'b'));
  assert.equal(createOpeningLevel().chapter,1);
  for(const chapter of [2,7,11]){const a=createCampaignLevel(chapter),b=createCampaignLevel(chapter,{variationSeed:'new-run'});assert.equal(a.generationFingerprint,b.generationFingerprint);}
  const old=JSON.parse(readFileSync(new URL('../dist/data/levels/80.json',import.meta.url)));assert.equal(createCampaignLevel(80).generationFingerprint,old.generationFingerprint);
});
test('不同轮次不是仅改标题，同参数可复现；旧快照不重生成',()=>{
  for(const chapter of [12,38,46,50,62,64,66,80]){
    const options={variationSeed:'playtest-A',budgetMs:5000},a=createCampaignLevel(chapter,options),again=createCampaignLevel(chapter,options),b=createCampaignLevel(chapter,{...options,variationSeed:'playtest-B'});
    assert.equal(a.generationFingerprint,again.generationFingerprint);assert.deepEqual(a.reference,again.reference);assert.deepEqual(a.rules,again.rules);
    assert.notEqual(a.generationFingerprint,b.generationFingerprint,String(chapter));assert.notDeepEqual(a.reference,b.reference);
    assert.equal(a.generation.variationKey,variationKey('playtest-A'));assert.equal(evaluateLayout(a,a.reference).complete,true);assert.deepEqual(generationQualityErrors(a),[]);
  }
  const old=JSON.parse(readFileSync(new URL('../dist/data/levels/62.json',import.meta.url))),saved=clone(old);createCampaignLevel(62,{variationSeed:'different'});assert.deepEqual(old,saved);assert.equal(evaluateLayout(old,old.reference).complete,true);
});
test('变体仍按阶段引入家具和结构，不因换轮次丢掉教学内容',()=>{
  for(const chapter of [13,15,17,21,23,25,27,31,33,35,37,48,50,52,54,56,58,60,62,64,66]){
    const level=createCampaignLevel(chapter,{variationSeed:'coverage-C',budgetMs:5000});assert.deepEqual(validateLevel(level),[]);assert.equal(evaluateLayout(level,level.reference).complete,true);
    for(const kind of furnitureIntroducedAt(chapter)){assert.ok(level.reference.objects.some(o=>o.kind===kind));assert.ok(level.rules.some(r=>r.type==='objectCount'&&r.kind===kind));assert.ok(level.progression.newFurniture.includes(kind));}
    if(SHAPE_INTRODUCTIONS[chapter])assert.equal(level.planning.shapeFamily,SHAPE_INTRODUCTIONS[chapter]);assert.ok(level.rules.length<=60);
  }
});
test('轮次传入Worker，忽略轮次的旧Worker结果不被当作新变体接收',async()=>{
  let request;class Worker{postMessage(data){request=data;queueMicrotask(()=>this.onmessage({data:{level:createCampaignLevel(data.chapter,{variationSeed:data.variationSeed})}}));}terminate(){}}
  const level=await createCommissionGenerator({WorkerClass:Worker,fetcher})(62,{variationSeed:'worker-run'});assert.equal(request.variationSeed,'worker-run');assert.equal(level.generation.variationKey,variationKey('worker-run'));
  class OldWorker{postMessage(data){queueMicrotask(()=>this.onmessage({data:{level:createCampaignLevel(data.chapter)}}));}terminate(){}}
  const rescued=await createCommissionGenerator({WorkerClass:OldWorker,fetcher})(62,{variationSeed:'worker-run'});assert.equal(rescued.generation.source,'verified-fallback');assert.ok(rescued.reference.objects.some(o=>o.kind==='piano'));
});
test('后期无Worker回退按轮次排序，仍优先避开近期结构族和指纹',async()=>{
  const pool=index.entries.filter(e=>e.chapter>=67),recent=[{family:'column'}];
  const a=rankFallbackEntries(pool,recent,{variationKey:variationKey('A'),chapter:100}),b=rankFallbackEntries(pool,recent,{variationKey:variationKey('B'),chapter:100});
  assert.notDeepEqual(a.map(e=>e.file),b.map(e=>e.file));assert.notEqual(a[0].family,'column');assert.deepEqual(a,rankFallbackEntries(pool,recent,{variationKey:variationKey('A'),chapter:100}));
  const generate=createCommissionGenerator({WorkerClass:null,fetcher}),first=await generate(100,{variationSeed:'A'}),next=await generate(101,{variationSeed:'A',avoidFingerprints:[first.generationFingerprint]});assert.notEqual(first.generationFingerprint,next.generationFingerprint);
});
test('单份回退快照下载失败可以尝试下一份，三次失败有界退出',async()=>{
  let failures=0;const generate=createCommissionGenerator({WorkerClass:null,fetcher:async url=>{if(!url.pathname.endsWith('fallback-index.json')&&failures++===0)return {ok:false};return fetcher(url);}});
  const level=await generate(100,{variationSeed:'network'});assert.equal(level.generation.source,'verified-fallback');assert.ok(failures>=2);assert.equal(evaluateLayout(level,level.reference).complete,true);
  let requests=0;const unavailable=createCommissionGenerator({WorkerClass:null,fetcher:async url=>url.pathname.endsWith('fallback-index.json')?fetcher(url):(requests++,{ok:false})});
  await assert.rejects(unavailable(100),/不可用/);assert.equal(requests,3);
});
