import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createCampaignLevel,paletteForLevel,hintRoom} from '../dist/levels.js';
import {clone,footprint,placeObject,rotateObject,selectedObjects,evaluateRule,evaluateLayout,validateLevel,frontCells,objectDistanceSquared,objectClosestPoints,inDirection,eraseRect} from '../dist/engine.js';
import {configureInstances,placementIdentity,assignFurnitureTag} from '../dist/instances.js';
import {levelFingerprint} from '../dist/generation-policy.js';import {instanceBadgeSVG,spatialRuleSVG} from '../dist/rule-visuals.js';import {renderPlan} from '../dist/plan-view.js';import {lessonsForLevel} from '../dist/tutorials.js';

test('指定标记进入实际条件，交换A/B不移动家具但会改变判定，内部ID保持',()=>{
  const level=createCampaignLevel(46),a=level.reference.objects.find(o=>o.tag==='A'),b=level.reference.objects.find(o=>o.tag==='B');
  assert.deepEqual(level.progression.newMechanics,['named']);assert.ok(level.rules.some(r=>r.type==='instances'));assert.ok(level.rules.some(r=>r.source?.tag||r.target?.tag));
  const swapped=assignFurnitureTag(level,level.reference,a.id,'B').layout;
  assert.equal(swapped.objects.find(o=>o.id===a.id).tag,'B');assert.equal(swapped.objects.find(o=>o.id===b.id).tag,'A');
  for(const original of level.reference.objects){const next=swapped.objects.find(o=>o.id===original.id);assert.equal(next.x,original.x);assert.equal(next.y,original.y);assert.equal(next.rotation,original.rotation);}
  assert.equal(evaluateLayout(level,swapped).complete,false);assert.equal(evaluateLayout(level,level.reference).complete,true);
  assert.notEqual(levelFingerprint(level),levelFingerprint({...level,reference:swapped}));
  assert.deepEqual(selectedObjects(swapped,{kind:a.kind,tag:'A'}).map(o=>o.id),[b.id]);
});
test('新放家具自动分配A/B，允许不标记，禁止重复抢占；移动/转向/存档/补画保留标记',()=>{
  const level=createCampaignLevel(46),reference=level.reference,marked=reference.objects.filter(o=>o.tag),layout=clone(reference);layout.objects=layout.objects.filter(o=>!o.tag);
  for(const original of marked){const object={...original,id:'user-'+original.tag};delete object.tag;const identity=placementIdentity(level,layout,object);assert.equal(identity.object.tag,original.tag);layout.objects.push(identity.object);}
  assert.equal(evaluateLayout(level,layout).complete,true);
  const extra={...marked[0],id:'extra'};delete extra.tag;assert.equal(placementIdentity(level,layout,extra,'A').error?.length>0,true);assert.equal(placementIdentity(level,layout,extra,'').object.tag,undefined);
  const turned=rotateObject(level,layout,'user-A',2).layout;assert.equal(turned.objects.find(o=>o.id==='user-A').tag,'A');assert.equal(JSON.parse(JSON.stringify(turned)).objects.find(o=>o.id==='user-A').tag,'A');
  const missing=clone(reference);missing.objects=missing.objects.filter(o=>o.tag!=='B');const repaired=hintRoom(level,missing,marked[0].kind==='singleBed'?'guest':level.instanceSlots[0].roomId).layout;assert.ok(repaired.objects.some(o=>o.tag==='B'));
});
test('缺标记、错误标记、重复标记、错误引用和非列表定义不能蒙混通过',()=>{
  const level=createCampaignLevel(46),rule=level.rules.find(r=>r.type==='instances'),missing=clone(level.reference);delete missing.objects.find(o=>o.tag==='A').tag;assert.equal(evaluateRule(level,missing,rule).ok,false);
  const duplicate=clone(level.reference);duplicate.objects.find(o=>o.tag==='B').tag='A';assert.equal(evaluateLayout(level,duplicate).complete,false);
  const bad=clone(level);bad.rules.push({id:'badTag',type:'direction',source:{kind:level.instanceSlots[0].kind,tag:'Z'},target:{kind:'window'},direction:'N',value:1});assert.ok(validateLevel(bad).length);
  for(const value of [{},[null],[{tag:'<x>',kind:'sofa',roomId:'living'}]])assert.ok(validateLevel({...level,instanceSlots:value}).length);
  const unknown=clone(level.reference.objects.find(o=>o.tag));unknown.id='unknown';unknown.tag='Z';assert.ok(placeObject(level,level.reference,unknown).error);
});
test('L形沙发四格真实占地，四次旋转闭合；缺口允许其他家具，实占格不能重叠',()=>{
  const object={id:'l',kind:'sectional',x:0,y:0,rotation:0};assert.deepEqual(footprint(object),['0,0','1,0','2,0','0,1']);
  for(const rotation of [0,90,180,270])assert.equal(new Set(footprint({...object,rotation})).size,4);
  assert.deepEqual(footprint({...object,rotation:90}),['0,0','1,0','1,1','1,2']);
  const cells={};for(let y=0;y<5;y++)for(let x=0;x<5;x++)cells[`${x},${y}`]='living';
  const level={outline:Object.keys(cells),rooms:[{id:'living'}],fixedEdges:{},rules:[]},layout={cells,edges:{},objects:[object]};
  assert.ok(placeObject(level,layout,{id:'gap',kind:'chair',x:2,y:1,rotation:0}).layout);assert.ok(placeObject(level,layout,{id:'overlap',kind:'chair',x:0,y:1,rotation:0}).error);
  assert.equal(eraseRect(level,layout,{x:2,y:1,w:1,h:1},'object').objects.length,1);
  let current=layout;for(let i=0;i<4;i++)current=rotateObject(level,current,'l').layout;assert.deepEqual(footprint(current.objects[0]),footprint(object));
});
test('L形缺口的距离不能按外框算零，距离线端点与真实占地一致',()=>{
  const l={id:'l',kind:'sectional',x:0,y:0,rotation:0},chair={id:'c',kind:'chair',x:2,y:2,rotation:0};
  assert.equal(objectDistanceSquared(l,chair),1);const pair=objectClosestPoints(l,chair);assert.equal((pair.a[0]-pair.b[0])**2+(pair.a[1]-pair.b[1])**2,1);
  assert.equal(objectDistanceSquared(l,{...chair,x:2,y:1}),0);
  assert.deepEqual(frontCells(l),['0,2','1,1','2,1']);
  assert.equal(inDirection(footprint(l),['2,1'],'S'),true);assert.equal(inDirection(footprint(l),['1,2'],'E'),false);
});
test('新物件第48关进入需求/参考解/铅笔/教学，标记与真实形状在历史和范围里一致',()=>{
  const level=createCampaignLevel(48),before=createCampaignLevel(47);assert.ok(!paletteForLevel(before).objectKinds.includes('sectional'));assert.ok(paletteForLevel(level).objectKinds.includes('sectional'));assert.ok(level.reference.objects.some(o=>o.kind==='sectional'));
  assert.ok(lessonsForLevel(level).some(l=>l.kind==='sectional'));assert.equal(evaluateLayout(level,level.reference).complete,true);
  const named=createCampaignLevel(49),object=named.reference.objects.find(o=>o.tag==='A');assert.match(instanceBadgeSVG(object),/A/);assert.match(renderPlan(named,named.reference),/instance-badge/);
  const direction=named.rules.find(r=>r.source?.tag);assert.deepEqual(selectedObjects(named.reference,direction.source).map(o=>o.tag),[direction.source.tag]);
  assert.match(spatialRuleSVG(named,named.reference,named.rules.find(r=>r.type==='instances')),/instance-overlay/);
});
test('旧0.6快照继续通关，不自动增加L形家具或标记要求',()=>{
  const level=JSON.parse(readFileSync(new URL('./fixtures/legacy-0.6-46.json',import.meta.url),'utf8'));
  assert.deepEqual(validateLevel(level),[]);assert.equal(evaluateLayout(level,level.reference).complete,true);assert.equal(level.instanceSlots,undefined);assert.ok(!level.rules.some(r=>r.type==='instances'));assert.equal(levelFingerprint(level),level.generationFingerprint);
});
