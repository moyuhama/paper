import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignLevel} from '../dist/levels.js';
import {clone,evaluateLayout,evaluateRule,integrityErrors,walkabilityErrors} from '../dist/engine.js';
import {poseProbes,effectiveDirections} from '../dist/clue-quality.js';
import {describeStructure,structuralSimilarity} from '../dist/puzzle-diversity.js';
import {lessonsForLevel,completeLessons} from '../dist/tutorials.js';
import {FURNITURE_PROGRESSION} from '../dist/progression.js';
import {SHAPE_NAMES} from '../dist/shape-catalog.js';

test('每条选中的方位线索都有其他线索未能排除的、物理合法的摆法作为证据',()=>{
  for(const chapter of [12,20,30,33,42,80]){
    const level=createCampaignLevel(chapter),probes=poseProbes(level),directions=level.rules.filter(r=>r.type==='direction'),base={...level,rules:level.rules.filter(r=>r.type!=='direction')};
    assert.ok(probes.length>0);assert.equal(probes.length,level.clueQuality.testedAlternatives);
    for(const layout of probes){assert.deepEqual(integrityErrors(level,layout),[]);assert.deepEqual(walkabilityErrors(level,layout),[]);assert.equal(evaluateLayout(base,layout).complete,true);}
    for(const rule of directions){
      assert.ok(probes.some(layout=>!evaluateRule(level,layout,rule).ok&&directions.filter(other=>other!==rule).every(other=>evaluateRule(level,layout,other).ok)),chapter+':'+rule.id);
    }
    assert.ok(level.clueQuality.witnesses.every(item=>item.exclusive>0));
    assert.equal(evaluateLayout(level,level.reference).complete,true);
  }
});
test('不能排除合法摆法的方位条件不会为了凑数量留在任务里',()=>{
  const level=createCampaignLevel(12),universal={id:'vacuous',type:'direction',source:{kind:'fridge',roomId:'kitchen'},target:{kind:'missing'},direction:'N',forbidden:true};
  assert.deepEqual(effectiveDirections(level,[universal],{directionBudget:4,negativeBudget:2}).rules,[]);
});
test('相似度忽略家具和线索变化，整图旋转也不变成新户型',()=>{
  const level=createCampaignLevel(30),edited=clone(level);edited.rules=[];edited.reference.objects=[];edited.reference.edges={};edited.seed='different';
  assert.equal(structuralSimilarity(describeStructure(level),describeStructure(edited)),1);
  const first={outline:['0,0','1,0','0,1'],reference:{cells:{'0,0':'a','1,0':'a','0,1':'b'},objects:[],edges:{}},rules:[]};
  const rotated={outline:['1,0','1,1','0,0'],reference:{cells:{'1,0':'a','1,1':'a','0,0':'b'},objects:[],edges:{}},rules:[]};
  assert.equal(structuralSimilarity(describeStructure(first),describeStructure(rotated)),1);
  const scaledCells=Object.fromEntries(Object.entries(first.reference.cells).flatMap(([key,id])=>{const[x,y]=key.split(',').map(Number);return [[0,0],[1,0],[0,1],[1,1]].map(([dx,dy])=>[`${x*2+dx},${y*2+dy}`,id]);}));
  const scaled={...first,outline:Object.keys(scaledCells),reference:{...first.reference,cells:scaledCells}};
  assert.notEqual(describeStructure(first).shapeFingerprint,describeStructure(scaled).shapeFingerprint);
  assert.ok(structuralSimilarity(describeStructure(first),describeStructure(scaled))>.93,'仅放大同样的分区仍属于相似户型');
});
test('连续出题避开最近两题的结构族，新结构教学关仍按原进度出现',()=>{
  const recent=[];
  for(let chapter=30;chapter<=55;chapter++){
    const level=createCampaignLevel(chapter,{recentStructures:recent});
    if(![31,33,35,37].includes(chapter))assert.ok(!recent.slice(-2).some(item=>item.family===level.planning.shapeFamily),String(chapter));
    if(chapter===33)assert.equal(level.planning.shapeFamily,'diagonal');
    if(chapter===35)assert.equal(level.planning.shapeFamily,'courtyard');
    recent.push(describeStructure(level));
    assert.equal(evaluateLayout(level,level.reference).complete,true);
  }
});
test('所有家具和结构有专属教学，读过可收起，菜单仍可重开',()=>{
  for(const item of FURNITURE_PROGRESSION.filter(item=>item.chapter>1)){
    const level=createCampaignLevel(item.chapter),lessons=lessonsForLevel(level),lesson=lessons.find(l=>l.kind===item.kind);
    assert.ok(lesson,item.kind);assert.ok(lesson.text.length>15);
    const seen=completeLessons([],lessons);assert.deepEqual(lessonsForLevel(level,{seen}),[]);
    assert.equal(lessonsForLevel(level,{seen,includeSeen:true}).length,lessons.length);
  }
  for(const family of Object.keys(SHAPE_NAMES)){
    const level=createCampaignLevel(40,{family});assert.ok(lessonsForLevel(level).some(l=>l.id==='shape-v1:'+family),family);
  }
});
