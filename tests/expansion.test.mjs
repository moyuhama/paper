import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignLevel,paletteForLevel,generateLevel} from '../dist/levels.js';
import {OBJECTS,evaluateLayout,validateLevel,clone,point,bounds,connected,edgeInfo,allEdges,placeBoundary,placeObject,integrityErrors,boundaryKind,edgeCells} from '../dist/engine.js';
import {FURNITURE_PROGRESSION} from '../dist/progression.js';
import {SHAPE_NAMES} from '../dist/expanded-plans.js';
import {generationQualityErrors} from '../dist/generation-quality.js';
import {levelFingerprint} from '../dist/generation-policy.js';
import {roomArea,cellArea} from '../dist/geometry.js';
import {furnitureSVG,objectIcon,cellSVG} from '../dist/drawing-assets.js';

test('21类家具全部有真实图形，新物件分批进入需求、参考解和可选物件',()=>{
  assert.equal(Object.keys(OBJECTS).length,21);
  for(const item of FURNITURE_PROGRESSION.filter(item=>item.chapter>=12)){
    const level=createCampaignLevel(item.chapter),palette=paletteForLevel(level);
    assert.ok(palette.objectKinds.includes(item.kind),item.kind);assert.ok(level.progression.newFurniture.includes(item.kind));
    assert.ok(level.reference.objects.some(o=>o.kind===item.kind));
    assert.ok(level.rules.some(r=>r.type==='objectCount'&&r.kind===item.kind));
    assert.ok(level.rules.some(r=>r.type==='direction'&&r.source.kind===item.kind));
    assert.match(furnitureSVG(item.kind,0,0),/<(?:rect|path|ellipse|circle)\b/);assert.match(objectIcon(item.kind),/viewBox=/);
    assert.equal(evaluateLayout(level,level.reference).complete,true);
    const missing=clone(level.reference);missing.objects=missing.objects.filter(o=>o.kind!==item.kind);assert.equal(evaluateLayout(level,missing).complete,false);
  }
});
test('第12至100关持续生成、阶段条件递进，单题不超过12类物件和60项要求',()=>{
  const seen=new Set();
  for(let chapter=12;chapter<=100;chapter++){
    const level=createCampaignLevel(chapter),palette=paletteForLevel(level);
    assert.ok(palette.objectKinds.length<=12);assert.ok(level.rules.length<=60);
    assert.deepEqual(validateLevel(level),[]);assert.deepEqual(generationQualityErrors(level),[]);
    assert.equal(evaluateLayout(level,level.reference).complete,true);
    assert.ok(!seen.has(level.generationFingerprint));seen.add(level.generationFingerprint);
    assert.equal(level.clueQuality.effectiveDirections,level.rules.filter(r=>r.type==='direction').length);
    assert.ok(level.clueQuality.witnesses.every(item=>item.exclusive>0));
    if(chapter>=42)assert.equal(level.difficulty.tier,5);
  }
});
test('所有结构族的多组种子均有通行和家具参考解，缺角房间不是矩形贴图',()=>{
  for(const family of Object.keys(SHAPE_NAMES))for(let i=0;i<8;i++){
    const level=generateLevel('shape-'+i,'complex',{chapter:40,family});
    assert.ok(connected(level.outline,level));assert.equal(evaluateLayout(level,level.reference).complete,true,family+':'+i);
    assert.deepEqual(generationQualityErrors(level),[]);
    if(family==='notched'){const own=Object.keys(level.reference.cells).filter(c=>level.reference.cells[c]==='living'),b=bounds(own);assert.ok(own.length<b.w*b.h);}
  }
});
test('柱位与管井不被当成外墙或额外入户口，不能开窗开门',()=>{
  for(const family of ['column','shaft']){
    const level=createCampaignLevel(40,{family}),layout=clone(level.reference),key=allEdges(level).find(k=>edgeInfo(level,layout,k).structural);
    assert.ok(key);assert.equal(edgeInfo(level,layout,key).outer,false);
    assert.ok(placeBoundary(level,layout,key,'window').error);assert.ok(placeBoundary(level,layout,key,'door').error);
    layout.edges[key]={kind:'door'};assert.equal(boundaryKind(level,layout,key),'door');assert.ok(integrityErrors(level,layout).length);
    const blocked=Object.keys(level.fixedAreas)[0],[x,y]=point(blocked);assert.ok(placeObject(level,layout,{id:'blocked',kind:'washer',x,y,rotation:0}).error);
  }
});
test('固定墙不能被改为开口，家具即使在同一房间也不能跨过它',()=>{
  const level=createCampaignLevel(40,{family:'wall'}),key=level.fixedWalls[0],cells=edgeCells(key),coords=cells.map(point);
  const x=Math.min(...coords.map(p=>p[0])),y=Math.min(...coords.map(p=>p[1])),rotation=coords[0][0]===coords[1][0]?90:0;
  assert.ok(placeBoundary(level,level.reference,key,'door').error);
  const result=placeObject(level,{...clone(level.reference),objects:[]},{id:'cross',kind:'sofa',x,y,rotation});assert.match(result.error,/固定墙/);
});
test('真正斜切角使用半格面积，家具不能侵入斜边，斜窗可按实际墙段编辑',()=>{
  const level=createCampaignLevel(33),layout=clone(level.reference),partial=Object.keys(level.geometry.cellPolygons)[0],[x,y]=point(partial);
  assert.equal(level.schemaVersion,2);assert.equal(cellArea(level,partial),.5);
  assert.ok(level.rules.some(r=>r.type==='area'&&!Number.isInteger(r.value)));
  assert.match(cellSVG(level,partial),/<path/);assert.ok(placeObject(level,layout,{id:'outside',kind:'washer',x,y,rotation:0}).error);
  const rule=level.rules.find(r=>r.type==='area'&&r.roomId==='living');assert.equal(roomArea(level,layout,'living'),rule.value);
  const edge=level.geometry.segments[0].key;assert.ok(placeBoundary(level,layout,edge,'window').layout);
  const bad=clone(level);bad.geometry.cellPolygons[partial]=[[x,y],[x+2,y],[x,y+1]];assert.ok(validateLevel(bad).length);
});
test('近期语义重复题会换候选，去掉标题和种子仍可识别同题',()=>{
  const first=createCampaignLevel(30),same=clone(first);same.title='其他名字';same.seed='其他种子';same.id='new-id';
  assert.equal(levelFingerprint(first),levelFingerprint(same));
  const next=createCampaignLevel(30,{avoidFingerprints:[first.generationFingerprint]});assert.notEqual(next.generationFingerprint,first.generationFingerprint);
  assert.equal(next.chapter,30);assert.ok(next.progression.newFurniture.includes('workbench'));
});

test('整图旋转并同步墙面条件仍被识别为同一题',()=>{
  const first={outline:['0,0','1,0','0,1'],reference:{cells:{'0,0':'a','1,0':'a','0,1':'b'},objects:[],edges:{'h:0:0':{kind:'window'}}},rules:[{id:'area',type:'area',roomId:'a',value:2},{id:'window',type:'boundaryCount',roomId:'a',kind:'window',side:'N',value:1}]};
  const rotated={outline:['1,0','1,1','0,0'],reference:{cells:{'1,0':'a','1,1':'a','0,0':'b'},objects:[],edges:{'v:2:0':{kind:'window'}}},rules:[{id:'area',type:'area',roomId:'a',value:2},{id:'window',type:'boundaryCount',roomId:'a',kind:'window',side:'E',value:1}]};
  assert.equal(levelFingerprint(first),levelFingerprint(rotated));
});
test('天井可以按关卡开窗，但不能变成第二个入户口',()=>{
  const level=createCampaignLevel(35),key=allEdges(level).find(k=>edgeInfo(level,level.reference,k).structural&&!level.fixedEdges[k]);
  assert.ok(key);assert.ok(placeBoundary(level,level.reference,key,'window').layout);assert.ok(placeBoundary(level,level.reference,key,'door').error);
  assert.equal(evaluateLayout(level,level.reference).complete,true);
});
