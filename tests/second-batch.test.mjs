import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {OBJECTS} from '../dist/catalog.js';import {createCampaignLevel,paletteForLevel} from '../dist/levels.js';
import {clone,objectRoom,point,bounds,footprint,frontCells,placeObject,evaluateRule,evaluateLayout,validateLevel,sharedEdges} from '../dist/engine.js';
import {generationQualityErrors} from '../dist/generation-quality.js';import {lessonsForLevel,completeLessons} from '../dist/tutorials.js';import {levelFingerprint} from '../dist/generation-policy.js';import {furnitureSVG} from '../dist/drawing-assets.js';
const content=Object.entries(OBJECTS).filter(([,def])=>def.chapter>=50);
const snapshots=JSON.parse(readFileSync(new URL('../dist/data/fallback-index.json',import.meta.url),'utf8')).entries.map(entry=>JSON.parse(readFileSync(new URL('../dist/data/'+entry.file,import.meta.url),'utf8')));

test('第二批余下9类进入解锁、需求、实际房间、参考解、方位、图形和教学',()=>{
  assert.equal(Object.keys(OBJECTS).length,31);assert.equal(content.length,9);
  const rooms={cornerDesk:'study',bar:'dining',vanity:'master',entryBench:'entry',utilityCabinet:'laundry',dryingRack:'laundry',piano:'music',treadmill:'gym',gameTable:'game'};
  for(const [kind,def]of content){const level=createCampaignLevel(def.chapter),objects=level.reference.objects.filter(o=>o.kind===kind);
    assert.ok(objects.length,kind);assert.ok(objects.every(o=>objectRoom(level.reference,o)===rooms[kind]));assert.ok(level.progression.newFurniture.includes(kind));assert.ok(paletteForLevel(level).objectKinds.includes(kind));
    assert.ok(level.rules.some(r=>r.type==='direction'&&r.source.kind===kind),kind);assert.ok(lessonsForLevel(level).some(l=>l.kind===kind));assert.match(furnitureSVG(kind,0,0),/<(?:path|rect|circle|ellipse)\b/);
    for(const angle of [0,90,180,270])assert.equal(new Set(footprint({...objects[0],rotation:angle})).size,def.shape?.length||def.w*def.h);
    assert.deepEqual(validateLevel(level),[]);assert.deepEqual(generationQualityErrors(level),[]);assert.equal(evaluateLayout(level,level.reference).complete,true);
    const missing=clone(level.reference);missing.objects=missing.objects.filter(o=>o.kind!==kind);assert.equal(evaluateLayout(level,missing).complete,false);
  }
});
test('新前向家具实际预留使用区，每条都能因物件阻挡而失败，不只是显示图标',()=>{
  for(const [kind,def]of content.filter(([,d])=>d.front)){
    const level=createCampaignLevel(def.chapter),rule=level.rules.find(r=>r.type==='useSpace'&&r.source.kind===kind);assert.ok(rule,kind);
    const object=level.reference.objects.find(o=>o.kind===kind),[x,y]=point(frontCells(object)[0]);
    const blocked=placeObject(level,level.reference,{id:'blocked-'+kind,kind:'chair',x,y,rotation:0});assert.ok(blocked.layout,kind);assert.equal(evaluateRule(level,blocked.layout,rule).ok,false,kind);
  }
});
test('替代组合不永久累加；第12关起已验题维持12类与60项上限并保留前向规则',()=>{
  const alternatives=[['table','bar','dining'],['desk','cornerDesk','study'],['bedsideTable','vanity','master'],['shoeCabinet','entryBench','entry'],['utilityCabinet','dryingRack','laundry']];
  for(const level of snapshots){assert.ok(paletteForLevel(level).objectKinds.length<=12);if(level.chapter>=12)assert.ok(level.rules.length<=60);
    for(const[a,b,room]of alternatives)assert.ok(!(level.reference.objects.some(o=>o.kind===a&&objectRoom(level.reference,o)===room)&&level.reference.objects.some(o=>o.kind===b&&objectRoom(level.reference,o)===room)),level.chapter+':'+a+'/'+b);
    for(const object of level.reference.objects.filter(o=>OBJECTS[o.kind].pack==='second'&&OBJECTS[o.kind].front))assert.ok(level.rules.some(r=>r.type==='useSpace'&&r.source.kind===object.kind&&r.source.roomId===objectRoom(level.reference,object)),level.chapter+':'+object.kind);
  }
});
test('新增家具会在后续普通组合里再次出现，跳过引入阶段的旧进度也能首次见到教学',()=>{
  for(const [kind,def]of content)assert.ok(snapshots.some(level=>level.chapter>def.chapter&&level.reference.objects.some(o=>o.kind===kind)),kind);
  const advanced=snapshots.find(level=>level.chapter>66&&level.reference.objects.some(o=>OBJECTS[o.kind].chapter>=50));assert.ok(advanced);assert.deepEqual(advanced.progression.newFurniture,[]);
  const lessons=lessonsForLevel(advanced);for(const kind of new Set(advanced.reference.objects.filter(o=>OBJECTS[o.kind].pack==='second').map(o=>o.kind)))assert.ok(lessons.some(l=>l.kind===kind),kind);
  assert.deepEqual(lessonsForLevel(advanced,{seen:completeLessons([],lessons)}),[]);
});
test('琴房和健身房不能当穿行通路，真实用途检查覆盖新房间',()=>{
  for(const [chapter,room]of [[62,'music'],[64,'gym']]){const level=createCampaignLevel(chapter),next=clone(level),edge=sharedEdges(level,level.reference,room,'master')[0];assert.ok(edge);next.reference.edges[edge]={kind:'door'};assert.ok(generationQualityErrors(next).some(error=>error.includes(room)&&error.includes('穿行')));}
});
test('转角书桌缺口不是碰撞占地，但属于明确要求的工作使用区',()=>{
  const level=createCampaignLevel(50),object=level.reference.objects.find(o=>o.kind==='cornerDesk'),cells=new Set(footprint(object)),b=bounds([...cells]);let gap;
  for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++)if(!cells.has(`${x},${y}`))gap={x,y};assert.ok(gap);assert.equal(cells.size,3);
  const placed=placeObject(level,level.reference,{id:'corner-gap',kind:'chair',...gap,rotation:0});assert.ok(placed.layout);assert.equal(evaluateRule(level,placed.layout,level.rules.find(r=>r.type==='useSpace'&&r.source.kind==='cornerDesk')).ok,false);
});
test('旧0.7第62题不会被追加入钢琴/琴房或新使用区，快照和指纹兼容',()=>{
  const level=JSON.parse(readFileSync(new URL('./fixtures/legacy-0.7-62.json',import.meta.url),'utf8'));assert.deepEqual(validateLevel(level),[]);assert.equal(evaluateLayout(level,level.reference).complete,true);assert.equal(levelFingerprint(level),level.generationFingerprint);assert.ok(!level.reference.objects.some(o=>OBJECTS[o.kind].chapter>=50));
});
