import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignLevel,paletteForLevel,hintRoom} from '../dist/levels.js';
import {clone,cellKey,frontCells,frontDirection,evaluateRule,evaluateLayout,validateLevel,placeObject,rotateObject,objectDistanceSquared,selectedObjects,useSpaceResults} from '../dist/engine.js';
import {lessonsForLevel,completeLessons} from '../dist/tutorials.js';
import {levelFingerprint} from '../dist/generation-policy.js';
import {frontAnnotationSVG,spatialRuleSVG,usagePreviewSVG} from '../dist/rule-visuals.js';
import {renderPlan} from '../dist/plan-view.js';
function fixture(){
  const cells={};for(let y=0;y<6;y++)for(let x=0;x<8;x++)cells[cellKey(x,y)]='living';
  const level={schemaVersion:1,rulesVersion:'prototype-1',rooms:[{id:'living',name:'客厅',color:'#edc8c3'}],outline:Object.keys(cells),fixedEdges:{},rules:[{id:'coverage',type:'coverage',text:'完整规划'}]};
  const layout={cells,edges:{'h:0:6':{kind:'door'}},objects:[{id:'a',kind:'sofa',x:1,y:1,rotation:0},{id:'b',kind:'sofa',x:4,y:3,rotation:0}]};
  level.reference=clone(layout);return {level,layout};
}
test('多件同类逐件判定all与any、缺少来源不真空成立，指定ID选择不会误取第一件',()=>{
  const {level,layout}=fixture();layout.objects.push({id:'target',kind:'chair',x:1,y:4,rotation:0});
  const rule={id:'d',type:'direction',source:{kind:'sofa',roomId:'living'},target:{kind:'chair'},direction:'S',value:1};
  assert.equal(evaluateRule(level,layout,{...rule,quantifier:'all'}).ok,false);
  assert.equal(evaluateRule(level,layout,{...rule,quantifier:'any'}).ok,true);
  assert.equal(evaluateRule(level,layout,{...rule,source:{kind:'sofa',objectId:'b'}}).ok,false);
  assert.equal(evaluateRule(level,{...layout,objects:[]},{...rule,quantifier:'any',forbidden:true}).ok,false);
});
test('同房间重复家具拥有独立ID、一个数量条件，少放一件不能通关；补画保留两件',()=>{
  const level=createCampaignLevel(38),rule=level.rules.find(r=>r.type==='objectCount'&&r.value===2),objects=selectedObjects(level.reference,{kind:rule.kind,roomId:rule.roomId});
  assert.equal(objects.length,2);assert.equal(new Set(level.reference.objects.map(o=>o.id)).size,level.reference.objects.length);
  assert.equal(level.rules.filter(r=>r.type==='objectCount'&&r.kind===rule.kind&&r.roomId===rule.roomId).length,1);
  assert.equal(paletteForLevel(level).objectKinds.filter(k=>k===rule.kind).length,1);
  const missing=clone(level.reference);missing.objects=missing.objects.filter(o=>o.id!==objects[1].id);
  assert.equal(evaluateLayout(level,missing).complete,false);
  const repaired=hintRoom(level,missing,rule.roomId);assert.ok(repaired.layout);assert.equal(evaluateLayout(level,repaired.layout).complete,true);
  const moved=rotateObject(level,level.reference,objects[0].id,2);assert.equal(moved.layout.objects.length,level.reference.objects.length);assert.deepEqual(moved.layout.objects.find(o=>o.id===objects[1].id),objects[1]);
});
test('正面使用区随四向转动，不把碰撞占地与使用区混为一块',()=>{
  const object={id:'a',kind:'sofa',x:2,y:2,rotation:0};
  assert.deepEqual(frontCells(object),['2,3','3,3']);
  assert.deepEqual(frontCells({...object,rotation:90}),['1,2','1,3']);
  assert.deepEqual(frontCells({...object,rotation:180}),['2,1','3,1']);
  assert.deepEqual(frontCells({...object,rotation:270}),['3,2','3,3']);
  assert.equal(frontDirection({...object,rotation:180}),'N');
});
test('正面贴墙、被家具挡住、跨房间、固定墙及不可达的使用区不通过',()=>{
  const {level,layout}=fixture(),rule={id:'front',type:'useSpace',source:{kind:'sofa',objectId:'a'},depth:1};
  assert.equal(evaluateRule(level,layout,rule).ok,true);
  for(const kind of ['blocked','room','wall','entry']){
    const l=clone(level),next=clone(layout);
    if(kind==='blocked')next.objects.push({id:'block',kind:'chair',x:1,y:2,rotation:0});
    if(kind==='room')next.cells['1,2']='other';
    if(kind==='wall')l.fixedWalls=['h:1:2'];
    if(kind==='entry')next.edges={};
    assert.equal(evaluateRule(l,next,rule).ok,false,kind);
  }
  const wall=clone(layout);wall.objects[0].y=0;wall.objects[0].rotation=180;
  assert.equal(evaluateRule(level,wall,rule).ok,false);
});
test('180度转向占地不变但会改变显式正面要求，旧题不增加隐藏规则',()=>{
  const {level,layout}=fixture();layout.objects[0].y=0;
  const rule={id:'front',type:'useSpace',source:{kind:'sofa',objectId:'a'},depth:1};level.rules.push(rule);
  assert.equal(evaluateLayout(level,layout).complete,true);
  const turned=rotateObject(level,layout,'a',2).layout;assert.equal(evaluateLayout(level,turned).complete,false);
  const legacy={...level,contentVersion:'residential-2',rules:level.rules.filter(r=>r.type!=='useSpace')};
  assert.deepEqual(validateLevel(legacy),[]);assert.equal(evaluateLayout(legacy,turned).complete,true);assert.equal(frontAnnotationSVG(legacy,turned,turned.objects[0]),'');
});
test('距离使用家具边缘最短直线，贴边/角接触为0m，缺少目标不会通过',()=>{
  const a={id:'a',kind:'chair',x:0,y:0,rotation:0};
  assert.equal(objectDistanceSquared(a,{...a,id:'b',x:1}),0);
  assert.equal(objectDistanceSquared(a,{...a,id:'b',x:1,y:1}),0);
  assert.equal(objectDistanceSquared(a,{...a,id:'b',x:2,y:2}),2);
  assert.equal(objectDistanceSquared(a,{...a,id:'b',x:3}),4);
  const {level,layout}=fixture(),rule={id:'near',type:'distance',source:{kind:'sofa',objectId:'a'},target:{kind:'sofa',objectId:'b'},value:1,op:'lte'};
  assert.equal(evaluateRule(level,layout,rule).ok,false);
  layout.objects[1].x=3;layout.objects[1].y=1;assert.equal(evaluateRule(level,layout,rule).ok,true);
  layout.objects.pop();assert.equal(evaluateRule(level,layout,rule).ok,false);
});
test('距离的all/any与同类排除自身正确，不能把自身的0m当成最近目标',()=>{
  const {level,layout}=fixture();layout.objects.push({id:'chair',kind:'chair',x:1,y:2,rotation:0});
  const rule={id:'near',type:'distance',source:{kind:'sofa'},target:{kind:'chair'},value:0,op:'lte'};
  assert.equal(evaluateRule(level,layout,{...rule,quantifier:'all'}).ok,false);assert.equal(evaluateRule(level,layout,{...rule,quantifier:'any'}).ok,true);
  assert.equal(evaluateRule(level,layout,{...rule,source:{kind:'chair'},target:{kind:'chair'}}).ok,false);
});
test('新增规则参数加载校验，正面深度/来源、距离值/比较和实例ID均受检',()=>{
  const {level}=fixture();
  for(const rule of [{type:'useSpace',source:{kind:'bed'},depth:1},{type:'useSpace',source:{kind:'sofa'},depth:0},{type:'distance',source:{kind:'sofa'},target:{kind:'chair'},value:-1,op:'lte'},{type:'distance',source:{kind:'sofa'},value:1,op:'lte'},{type:'direction',source:{kind:'sofa',objectId:42},target:{kind:'chair'},direction:'N',value:1}]){
    assert.ok(validateLevel({...level,rules:[{id:'invalid',...rule}]}).length);
  }
});
test('新机制分阶段引入，参考解有用量词、正面通路、距离条件，教学可读后收起',()=>{
  for(const [chapter,key]of [[38,'multiple'],[40,'quantifiers'],[42,'useSpace'],[44,'distance']]){
    const level=createCampaignLevel(chapter);assert.ok(level.progression.newMechanics.includes(key));assert.equal(evaluateLayout(level,level.reference).complete,true);
    const lessons=lessonsForLevel(level);assert.ok(lessons.some(l=>l.id==='mechanic-v1:'+key));assert.deepEqual(lessonsForLevel(level,{seen:completeLessons([],lessons)}),[]);
    if(chapter===40)assert.ok(level.rules.some(r=>r.quantifier==='any'));
    if(chapter===42)assert.ok(useSpaceResults(level,level.reference,{kind:'sofa',roomId:'living'}).every(r=>r.ok));
  }
  const old=createCampaignLevel(37);assert.ok(!old.rules.some(r=>['useSpace','distance'].includes(r.type)));assert.ok(!old.rules.some(r=>r.type==='objectCount'&&r.value>1));
});
test('同占地180度正面不同题目指纹不同，预览/历史共享箭头与条件图形',()=>{
  const {level,layout}=fixture();level.rules.push({id:'front',type:'useSpace',source:{kind:'sofa'},depth:1});
  const turned=clone(level);turned.reference.objects[0].rotation=180;assert.notEqual(levelFingerprint(level),levelFingerprint(turned));
  assert.match(frontAnnotationSVG(level,layout,layout.objects[0]),/furniture-front/);
  assert.match(usagePreviewSVG(level,layout,layout.objects[0]),/rect/);
  assert.match(spatialRuleSVG(level,layout,level.rules.at(-1)),/use-space-overlay/);
  assert.match(spatialRuleSVG(level,layout,{type:'distance',source:{kind:'sofa',objectId:'a'},target:{kind:'sofa',objectId:'b'}}),/distance-overlay/);
  assert.match(renderPlan(level,layout),/furniture-front/);
});
