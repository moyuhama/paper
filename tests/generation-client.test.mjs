import {describeStructure} from '../dist/puzzle-diversity.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCommissionGenerator} from '../dist/generation-client.js';
import {evaluateLayout,validateLevel} from '../dist/engine.js';
import {createCampaignLevel} from '../dist/levels.js';
const index=JSON.parse(readFileSync(new URL('../dist/data/fallback-index.json',import.meta.url),'utf8'));
const levels=new Map(index.entries.map(entry=>[entry.file,JSON.parse(readFileSync(new URL('../dist/data/'+entry.file,import.meta.url),'utf8'))]));
const bank={levels:[...levels.values()]};
const fetcher=async url=>({ok:true,json:async()=>url.pathname.endsWith('fallback-index.json')?index:levels.get('levels/'+url.pathname.split('/').at(-1))});

test('已验题库全部通过同一判定，首次新家具与新户型有匹配的回退题',()=>{
  for(const level of bank.levels){assert.deepEqual(validateLevel(level),[]);assert.equal(evaluateLayout(level,level.reference).complete,true);}
  assert.ok(bank.levels.some(l=>l.chapter===33&&l.geometry?.version===2));
});
test('Worker成功返回后终止，不下载回退题库',async()=>{
  let terminated=0;const level=createCampaignLevel(12);
  class Worker{postMessage(){queueMicrotask(()=>this.onmessage({data:{level}}));}terminate(){terminated++;}}
  const generate=createCommissionGenerator({WorkerClass:Worker,fetcher:async()=>{throw new Error('不应调用');}});
  assert.equal((await generate(12)).id,level.id);assert.equal(terminated,1);
});
test('Worker超时或不可用回退已验题，并保留新物件和斜边引入',async()=>{
  let terminated=0;class HungWorker{postMessage(){}terminate(){terminated++;}}
  const generate=createCommissionGenerator({WorkerClass:HungWorker,timeoutMs:5,fetcher});
  const level=await generate(24);assert.ok(level.reference.objects.some(o=>o.kind==='basin'));assert.equal(level.generation.source,'verified-fallback');assert.equal(terminated,1);
  const noWorker=createCommissionGenerator({WorkerClass:null,fetcher});
  const diagonal=await noWorker(33);assert.equal(diagonal.geometry.version,2);assert.equal(diagonal.chapter,33);
});
test('无效Worker结果不会进入游戏，回退也避免近期重复',async()=>{
  class BadWorker{postMessage(){queueMicrotask(()=>this.onmessage({data:{level:{}}}));}terminate(){}}
  const generate=createCommissionGenerator({WorkerClass:BadWorker,fetcher});
  const first=await generate(100),next=await generate(101,{avoidFingerprints:[first.generationFingerprint]});
  assert.notEqual(first.generationFingerprint,next.generationFingerprint);assert.equal(next.title,'第101份委托');assert.equal(evaluateLayout(next,next.reference).complete,true);
});
test('内容下载失败会报告失败，不返回坏题或丢掉新家具',async()=>{
  const generate=createCommissionGenerator({WorkerClass:null,fetcher:async()=>({ok:false})});
  await assert.rejects(generate(12),/不可用/);
});

test('旧阶段不依赖Worker也可继续，不能误把legacy结构排除出回退库',async()=>{
  const generate=createCommissionGenerator({WorkerClass:null,fetcher});
  const level=await generate(2);assert.equal(level.chapter,2);assert.deepEqual(level.reference.objects.map(o=>o.kind),['bed']);
  const advanced=await generate(80);assert.equal(advanced.difficulty.tier,5);
});

test('回退只请求小索引和单个快照，不下载完整题库',async()=>{
  const requested=[];const generate=createCommissionGenerator({WorkerClass:null,fetcher:async url=>{requested.push(url.pathname);return fetcher(url);}});
  await generate(12);assert.equal(requested.length,2);assert.match(requested[0],/fallback-index\.json$/);assert.match(requested[1],/levels\/12\.json$/);
  const largest=Math.max(...[...levels.values()].map(l=>Buffer.byteLength(JSON.stringify(l))));assert.ok(largest<25000);assert.ok(Buffer.byteLength(JSON.stringify(index))<20000);
});

test('无Worker的后期回退也优先选不同结构，近期信息传给Worker',async()=>{
  const fallback=createCommissionGenerator({WorkerClass:null,fetcher});
  const first=await fallback(100),recentStructures=[describeStructure(first)];
  const next=await fallback(101,{recentStructures,avoidFingerprints:[first.generationFingerprint]});
  assert.notEqual(next.planning.shapeFamily,first.planning.shapeFamily);
  let request;class Worker{postMessage(data){request=data;queueMicrotask(()=>this.onmessage({data:{level:next}}));}terminate(){}}
  const generate=createCommissionGenerator({WorkerClass:Worker,fetcher});
  await generate(101,{recentStructures});assert.deepEqual(request.recentStructures,recentStructures);
});

test('新机制引入关的回退保留多件、量词、正面和距离，不接受缺机制的Worker题',async()=>{
  const generate=createCommissionGenerator({WorkerClass:null,fetcher});
  for(const chapter of [38,40,42,44]){
    const level=await generate(chapter);assert.ok(level.rules.some(r=>r.type==='objectCount'&&r.value>1));
    if(chapter===40)assert.ok(level.rules.some(r=>r.quantifier==='any'));
    if(chapter>=42)assert.ok(level.rules.some(r=>r.type==='useSpace'));
    if(chapter>=44)assert.ok(level.rules.some(r=>r.type==='distance'));
    assert.ok(level.progression.newMechanics.length);
  }
  const old=createCampaignLevel(37);old.chapter=44;
  class WrongWorker{postMessage(){queueMicrotask(()=>this.onmessage({data:{level:old}}));}terminate(){}}
  const rescued=await createCommissionGenerator({WorkerClass:WrongWorker,fetcher})(44);
  assert.equal(rescued.generation.source,'verified-fallback');assert.ok(rescued.rules.some(r=>r.type==='distance'));
});
