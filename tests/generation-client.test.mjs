import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCommissionGenerator} from '../dist/generation-client.js';
import {evaluateLayout,validateLevel} from '../dist/engine.js';
import {createCampaignLevel} from '../dist/levels.js';
const bank=JSON.parse(readFileSync(new URL('../dist/data/fallback-levels.json',import.meta.url),'utf8'));
const fetcher=async()=>({ok:true,json:async()=>bank});

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
