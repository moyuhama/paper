import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,cellKey,edgeKey,footprint,inDirection,initialLayout,evaluateRule,evaluateLayout,integrityErrors,validateLevel,paintRoom,eraseRect,placeBoundary,placeObject,rotateObject} from '../dist/engine.js';
import {generateLevel,hintRoom,createOpeningLevel,createCampaignLevel,paletteForLevel} from '../dist/levels.js';

function twoRooms(){
  const level={schemaVersion:1,rulesVersion:'prototype-1',outline:[],rooms:[{id:'master',name:'主卧',color:'#ffeeaa'},{id:'guest',name:'客卧',color:'#aaffee'}],rules:[{id:'area',type:'area',roomId:'master',value:4}],fixedEdges:{'h:0:0':{kind:'window',fixed:true}}};
  const layout={cells:{},edges:{'h:0:0':{kind:'window',fixed:true},'v:0:0':{kind:'door'},'v:2:0':{kind:'open'},'v:2:1':{kind:'open'}},objects:[]};
  for(let y=0;y<2;y++)for(let x=0;x<4;x++){const c=cellKey(x,y);level.outline.push(c);layout.cells[c]=x<2?'master':'guest';}
  return{level,layout};
}
test('方向使用占格条带，错开行的西北目标不算正西',()=>{
  const source=['2,2','3,2'];assert.equal(inDirection(source,['0,2'],'W'),true);assert.equal(inDirection(source,['0,1'],'W'),false);assert.equal(inDirection(source,['3,0','4,0'],'N'),true);
});
test('旋转后的占格宽高更新',()=>assert.deepEqual(footprint({kind:'wardrobe',x:0,y:0,rotation:90}),['0,0','1,0']));
test('第一关先只显示卫生间，随教学解锁房间、门窗和双人床',()=>{
  const level=createOpeningLevel();assert.equal(evaluateLayout(level,level.reference).complete,true);
  assert.deepEqual(paletteForLevel(level,0),{roomIds:['bath'],boundaries:[],objectKinds:[]});
  assert.deepEqual(paletteForLevel(level,1).roomIds,['bath','hall']);
  assert.deepEqual(paletteForLevel(level,2).objectKinds,[]);
  assert.deepEqual(paletteForLevel(level,3).boundaries,['door','window','open']);
  assert.deepEqual(paletteForLevel(level,3).objectKinds,['bed']);assert.deepEqual(paletteForLevel(level,4).objectKinds,['bed']);
});
test('截图回归：缺少室内门时仍能选床，缺门只影响审核',()=>{
  const level=createOpeningLevel(),layout=clone(level.reference);delete layout.edges['h:1:3'];layout.objects=[];
  const result=evaluateLayout(level,layout),whole=result.results.filter(r=>r.group==='global'&&!level.rules.find(rule=>rule.id===r.id).hidden);
  assert.equal(whole.filter(r=>r.ok).length,3);assert.equal(evaluateRule(level,layout,{type:'globalCount',kind:'door',value:1}).ok,false);
  assert.equal(paletteForLevel(level,3).objectKinds.includes('bed'),true);assert.equal(result.complete,false);
  const placed=placeObject(level,layout,{id:'player-bed',kind:'bed',x:4,y:1,rotation:90});assert.ok(placed.layout);assert.equal(evaluateLayout(level,placed.layout).complete,false);
});
test('后续委托仅提供实际要求的家具，新物件随关卡增加',()=>{
  const second=createCampaignLevel(2),fifth=createCampaignLevel(5);
  assert.deepEqual(paletteForLevel(second).objectKinds,['bed']);assert.equal(paletteForLevel(fifth).objectKinds.includes('toilet'),true);assert.equal(paletteForLevel(second).objectKinds.includes('toilet'),false);
  for(let n=1;n<=12;n++){const level=createCampaignLevel(n);assert.deepEqual(validateLevel(level),[]);assert.equal(evaluateLayout(level,level.reference).complete,true);}
});
test('已放家具四次转向后回到原方向，身份和原布局不变',()=>{
  const{level,layout}=twoRooms();layout.objects=[{id:'wardrobe',kind:'wardrobe',x:0,y:0,rotation:0}];const original=clone(layout);let next=layout;
  for(const angle of [90,180,270,0]){next=rotateObject(level,next,'wardrobe').layout;assert.equal(next.objects[0].rotation,angle);assert.equal(next.objects[0].id,'wardrobe');assert.equal(next.objects.length,1);}
  assert.deepEqual(layout,original);assert.deepEqual(next,original);
});
test('转向造成跨房间或碰撞时拒绝，不改变原对象',()=>{
  const{level,layout}=twoRooms();layout.objects=[{id:'wardrobe',kind:'wardrobe',x:1,y:0,rotation:0}];assert.match(rotateObject(level,layout,'wardrobe').error,/同一房间/);
  layout.objects[0].x=0;layout.objects.push({id:'toilet',kind:'toilet',x:1,y:0,rotation:0});const original=clone(layout);assert.match(rotateObject(level,layout,'wardrobe').error,/重叠/);assert.deepEqual(layout,original);
});
test('家具转向改变占格后，方向条件重新按图纸方位判断',()=>{
  const{level,layout}=twoRooms();layout.objects=[{id:'wardrobe',kind:'wardrobe',x:0,y:0,rotation:0},{id:'toilet',kind:'toilet',x:1,y:1,rotation:0}];
  const rule={type:'direction',source:{kind:'wardrobe',roomId:'master'},target:{kind:'toilet'},direction:'E',value:1};
  assert.equal(evaluateRule(level,layout,rule).ok,true);const next=rotateObject(level,layout,'wardrobe').layout;assert.ok(next);assert.equal(evaluateRule(level,next,rule).ok,false);
});
test('同类用途的主卧客卧具有独立身份，禁止直接覆盖',()=>{
  const{level,layout}=twoRooms(),result=paintRoom(level,layout,'master',{x:1,y:0,w:2,h:1});assert.match(result.error,/擦除/);assert.equal(layout.cells['2,0'],'guest');
});
test('同一房间不规则追加按并集计算，不重复计数',()=>{
  const{level}=twoRooms();let state=initialLayout(level);
  state=paintRoom(level,state,'master',{x:0,y:0,w:2,h:1}).layout;
  state=paintRoom(level,state,'master',{x:0,y:0,w:1,h:2}).layout;
  assert.equal(Object.keys(state.cells).length,3);assert.equal(state.cells['1,1'],undefined);
});
test('仅角接触和分离的追加被拒绝',()=>{
  const{level}=twoRooms();let state=paintRoom(level,initialLayout(level),'master',{x:0,y:0,w:1,h:1}).layout;
  assert.match(paintRoom(level,state,'master',{x:1,y:1,w:1,h:1}).error,/边接触/);
});
test('矩形擦除可跨两个房间，固定窗被保留',()=>{
  const{level,layout}=twoRooms(),next=eraseRect(level,layout,{x:1,y:0,w:2,h:1});
  assert.equal(Object.values(next.cells).filter(r=>r==='master').length,3);assert.equal(Object.values(next.cells).filter(r=>r==='guest').length,3);assert.equal(next.edges['h:0:0'].fixed,true);
});
test('仅擦家具保留房间、固定边界',()=>{
  const{level,layout}=twoRooms();layout.objects=[{id:'t',kind:'toilet',x:0,y:0,rotation:0}];
  const next=eraseRect(level,layout,{x:0,y:0,w:1,h:1},'object');assert.equal(next.objects.length,0);assert.deepEqual(next.cells,layout.cells);assert.deepEqual(next.edges,layout.edges);
});
test('固定窗不可覆盖成门',()=>{const{level,layout}=twoRooms();assert.match(placeBoundary(level,layout,'h:0:0','door').error,/固定/);});
test('开放边必须已有两侧房间',()=>{const{level}=twoRooms();assert.match(placeBoundary(level,initialLayout(level),'v:2:0','open').error,/两侧/);});
test('外墙门与内部门分别统计',()=>{
  const{level,layout}=twoRooms();layout.edges['v:2:0']={kind:'door'};
  assert.equal(evaluateRule(level,layout,{type:'globalCount',kind:'entry',value:1}).ok,true);assert.equal(evaluateRule(level,layout,{type:'globalCount',kind:'door',value:1}).ok,true);
});
test('共享开放边在双方均满足，全屋物理长度只计一次',()=>{
  const{level,layout}=twoRooms();
  for(const[a,b]of [['master','guest'],['guest','master']])assert.equal(evaluateRule(level,layout,{type:'fullOpen',roomId:a,targetRoomId:b}).ok,true);
  assert.equal(evaluateRule(level,layout,{type:'globalCount',kind:'open',value:2}).ok,true);
  delete layout.edges['v:2:1'];assert.equal(evaluateRule(level,layout,{type:'fullOpen',roomId:'master',targetRoomId:'guest'}).ok,false);
});
test('可达性同时经过门和开放连接',()=>{
  const{level,layout}=twoRooms();assert.equal(evaluateRule(level,layout,{type:'reachable'}).ok,true);delete layout.edges['v:0:0'];assert.equal(evaluateRule(level,layout,{type:'reachable'}).ok,false);
});
test('禁止条件的参考家具缺失时不真空成立',()=>{
  const{level,layout}=twoRooms(),rule={type:'direction',source:{kind:'toilet',roomId:'master'},target:{kind:'stove'},direction:'W',forbidden:true};
  assert.equal(evaluateRule(level,layout,rule).ok,false);layout.objects.push({id:'t',kind:'toilet',x:0,y:0});assert.equal(evaluateRule(level,layout,rule).ok,true);
});
test('未绘制房间不能靠零窗或禁止相邻得到完成项',()=>{
  const{level}=twoRooms(),layout=initialLayout(level);
  assert.equal(evaluateRule(level,layout,{type:'boundaryCount',roomId:'master',kind:'window',value:0}).ok,false);
  assert.equal(evaluateRule(level,layout,{type:'adjacent',roomId:'master',targetRoomId:'guest',forbidden:true}).ok,false);
});
test('跨房方向统计两扇窗，指定房间选择器与不限房间分开',()=>{
  const{level,layout}=twoRooms();layout.objects=[{id:'bed',kind:'bed',x:0,y:0}];layout.edges['v:4:0']={kind:'window'};layout.edges['v:4:1']={kind:'window'};
  const rule={type:'direction',source:{kind:'bed',roomId:'master'},target:{kind:'window'},direction:'E',value:2};
  assert.equal(evaluateRule(level,layout,rule).ok,true);assert.equal(evaluateRule(level,layout,{...rule,target:{kind:'window',roomId:'master'}}).ok,false);
  delete layout.edges['v:4:1'];assert.equal(evaluateRule(level,layout,rule).ok,false);
});
test('全屋有解参考图不会代替条件判断：不同家具摆法仍通过',()=>{
  const level=generateLevel('alternative','intro'),next=clone(level.reference),bed=next.objects.find(o=>o.kind==='bed');
  const own=Object.keys(next.cells).filter(c=>next.cells[c]==='bedroom').map(c=>c.split(',').map(Number));bed.x=Math.min(...own.map(p=>p[0]));bed.y=Math.min(...own.map(p=>p[1]));
  assert.notDeepEqual(next,level.reference);assert.equal(evaluateLayout(level,next).complete,true);
});
test('家具重叠或跨房间被拒绝',()=>{
  const{level,layout}=twoRooms();assert.match(placeObject(level,layout,{id:'b',kind:'bed',x:1,y:0}).error,/同一房间/);
  layout.objects=[{id:'t',kind:'toilet',x:0,y:0}];assert.match(placeObject(level,layout,{id:'s',kind:'sink',x:0,y:0}).error,/重叠/);
});
test('参数、引用、规则版本和未知规则在加载前被拒绝',()=>{
  const{level}=twoRooms();assert.deepEqual(validateLevel(level),[]);
  const bad=clone(level);bad.rules.push({id:'bad',type:'direction',source:{kind:'sink',roomId:'missing'},target:{kind:'window'},direction:'X',value:2});
  assert.ok(validateLevel(bad).some(e=>e.includes('未知房间')));assert.ok(validateLevel(bad).some(e=>e.includes('方向参数')));
  bad.rules.push({id:'other',type:'magic'});assert.ok(validateLevel(bad).some(e=>e.includes('不支持的规则')));
});
test('导入名称不作为HTML执行，颜色和ID限制为安全数据',()=>{
  const{level}=twoRooms();level.rooms[0].color='red;" onmouseover="alert(1)';level.rooms[1].id='__proto__';assert.ok(validateLevel(level).length>=2);
});
test('求助逐间补画可完成入门任务，原布局不被原地修改',()=>{
  const level=generateLevel('第一份委托','intro');let state=initialLayout(level);const blank=clone(state);
  for(const room of level.rooms){const result=hintRoom(level,state,room.id);assert.ok(result.layout,result.error);state=result.layout;}
  assert.deepEqual(initialLayout(level),blank);assert.equal(evaluateLayout(level,state).complete,true);
});
test('求助与已有其他房间冲突时不破坏图纸',()=>{
  const level=generateLevel('conflict','intro'),state=clone(level.reference),room=level.rooms[0].id,cell=Object.keys(state.cells).find(c=>state.cells[c]===room);state.cells[cell]=level.rooms[1].id;
  assert.match(hintRoom(level,state,room).error,/冲突/);
});
test('同一种子、模式及生成器版本完全可复现',()=>assert.deepEqual(generateLevel('repro','complex'),generateLevel('repro','complex')));
test('生成题的开放公共边使用匹配的空间组合，卫生间保持门连接',()=>{
  for(const mode of ['intro','standard','complex']){
    const level=generateLevel('privacy',mode);
    assert.equal(level.rules.filter(r=>r.type==='fullOpen').some(r=>r.roomId==='bath'||r.targetRoomId==='bath'),false);
  }
});
test('坏图纸结构、边界与重复家具ID不能进入审核',()=>{
  const{level,layout}=twoRooms();assert.equal(evaluateLayout(level,{cells:{}}).complete,false);
  layout.edges['v:999:999']={kind:'open'};assert.match(evaluateLayout(level,layout).errors[0],/未知边界/);
});
test('三个规模共90个固定种子：格式、参考解、连通和完整条件同时验证',()=>{
  const fingerprints=new Set();
  for(const mode of ['intro','standard','complex'])for(let i=0;i<30;i++){
    const level=generateLevel(`regression-${i}`,mode);assert.deepEqual(validateLevel(level),[]);assert.equal(evaluateLayout(level,level.reference).complete,true);assert.deepEqual(integrityErrors(level,level.reference),[]);
    assert.equal(level.rooms.length,{intro:3,standard:6,complex:9}[mode]);fingerprints.add(JSON.stringify([level.outline,level.reference.cells,level.rules]));
  }
  assert.ok(fingerprints.size>=85,'种子应产生不同内容，而非仅改委托编号');
});
