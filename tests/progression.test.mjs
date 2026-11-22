import test from 'node:test';
import assert from 'node:assert/strict';
import {OBJECTS,evaluateLayout,validateLevel,footprint} from '../dist/engine.js';
import {createCampaignLevel,paletteForLevel} from '../dist/levels.js';
import {FURNITURE_PROGRESSION,unlockedFurnitureAt} from '../dist/progression.js';
import {furnitureSVG} from '../dist/drawing-assets.js';

test('家具目录的每一种都必须有解锁配置和图形，不能再次遗漏浴缸',()=>{
  const kinds=FURNITURE_PROGRESSION.map(item=>item.kind);
  assert.equal(new Set(kinds).size,kinds.length);
  assert.deepEqual([...kinds].sort(),Object.keys(OBJECTS).sort());
  for(const kind of kinds){assert.match(furnitureSVG(kind,0,0),/<(?:rect|path|ellipse|circle)\b/);}
});

test('第3至11关新增家具进入实际需求和参考解，早期条件不引用未解锁家具',()=>{
  let previous=new Set(paletteForLevel(createCampaignLevel(2)).objectKinds);
  for(let chapter=3;chapter<=11;chapter++){
    const level=createCampaignLevel(chapter),palette=paletteForLevel(level),allowed=new Set(unlockedFurnitureAt(chapter));
    for(const kind of previous)assert.ok(palette.objectKinds.includes(kind),`第${chapter}关保留${kind}`);
    assert.ok(palette.objectKinds.length>previous.size,`第${chapter}关增加家具种类`);
    for(const rule of level.rules){
      if(rule.type==='objectCount')assert.ok(allowed.has(rule.kind));
      for(const selector of [rule.source,rule.target])if(selector&&OBJECTS[selector.kind])assert.ok(allowed.has(selector.kind));
    }
    for(const kind of level.progression.newFurniture){
      assert.ok(palette.objectKinds.includes(kind));
      assert.ok(level.rules.some(r=>r.type==='objectCount'&&r.kind===kind&&r.value>0));
      assert.ok(level.reference.objects.some(o=>o.kind===kind));
    }
    assert.deepEqual(validateLevel(level),[]);assert.equal(evaluateLayout(level,level.reference).complete,true);
    previous=new Set(palette.objectKinds);
  }
});

test('第11关浴缸参与方位约束与审核，移除浴缸不能通关',()=>{
  const before=createCampaignLevel(10),level=createCampaignLevel(11);
  assert.ok(!paletteForLevel(before).objectKinds.includes('bathtub'));
  assert.deepEqual(level.progression.newFurniture,['bathtub']);
  assert.ok(level.rules.some(r=>r.type==='direction'&&r.source.kind==='bathtub'));
  const layout=structuredClone(level.reference);layout.objects=layout.objects.filter(o=>o.kind!=='bathtub');
  assert.equal(evaluateLayout(level,layout).complete,false);
  const bathtub=level.reference.objects.find(o=>o.kind==='bathtub');
  for(const rotation of [0,90,180,270])assert.equal(footprint({...bathtub,rotation}).length,2);
});
