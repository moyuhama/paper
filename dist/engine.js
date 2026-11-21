// Pure shared rules: browser feedback, submission and generated reference checks.
export const ENGINE_VERSION = 'prototype-1';
export const OBJECTS = {
  bed:{name:'双人床',w:2,h:2}, singleBed:{name:'单人床',w:1,h:2},
  sofa:{name:'双人沙发',w:2,h:1}, chair:{name:'单人沙发',w:1,h:1},
  table:{name:'餐桌餐椅',w:2,h:2}, stove:{name:'炉具',w:1,h:1},
  sink:{name:'洗碗池',w:1,h:1}, toilet:{name:'马桶',w:1,h:1},
  shower:{name:'淋浴',w:1,h:1}, wardrobe:{name:'衣柜',w:1,h:2}, bathtub:{name:'浴缸',w:1,h:2}
};
export const RULE_TYPES = new Set(['area','objectCount','boundaryCount','globalCount','adjacent','direction','fullOpen','openLength','reachable','coverage']);
export const clone = value => structuredClone(value);
export const cellKey = (x,y) => `${x},${y}`;
export const point = key => key.split(',').map(Number);
export const edgeKey = (axis,x,y) => `${axis}:${x}:${y}`;
export const edgeParts = key => { const [axis,x,y]=key.split(':');return {axis,x:+x,y:+y}; };
export function edgeCells(key) { const {axis,x,y}=edgeParts(key); return axis==='v' ? [cellKey(x-1,y),cellKey(x,y)] : [cellKey(x,y-1),cellKey(x,y)]; }
export function allEdges(level) {
  const result=new Set();
  for(const cell of level.outline){const[x,y]=point(cell); result.add(edgeKey('v',x,y));result.add(edgeKey('v',x+1,y));result.add(edgeKey('h',x,y));result.add(edgeKey('h',x,y+1));}
  return [...result];
}
export function neighbors(cell) {const[x,y]=point(cell);return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].map(([a,b])=>cellKey(a,b));}
export function connected(cells) {
  if(!cells.length)return false;
  const set=new Set(cells), seen=new Set([cells[0]]), queue=[cells[0]];
  for(let i=0;i<queue.length;i++)for(const c of neighbors(queue[i]))if(set.has(c)&&!seen.has(c)){seen.add(c);queue.push(c);}
  return seen.size===set.size;
}
export function bounds(cells) {
  const pts=cells.map(point); const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs)+1,h:Math.max(...ys)-Math.min(...ys)+1};
}
export function footprint(object) {
  const def=OBJECTS[object.kind];if(!def)return [];
  const rotated=(object.rotation||0)%180!==0,w=rotated?def.h:def.w,h=rotated?def.w:def.h;
  return Array.from({length:w*h},(_,i)=>cellKey(object.x+i%w,object.y+Math.floor(i/w)));
}
export function objectRoom(layout,object) {
  const cells=footprint(object),ids=new Set(cells.map(c=>layout.cells[c]));
  return cells.length && ids.size===1 && !ids.has(undefined) ? [...ids][0] : null;
}
export function initialLayout(level) {return {cells:{},edges:clone(level.fixedEdges||{}),objects:[]};}
export function edgeInfo(level,layout,key) {
  const outline=new Set(level.outline),cells=edgeCells(key),inside=cells.map(c=>outline.has(c));
  const rooms=cells.map((c,i)=>inside[i]?layout.cells[c]||null:null);
  return {cells,inside,rooms,outer:inside[0]!==inside[1],internal:inside[0]&&inside[1]&&!!rooms[0]&&!!rooms[1]&&rooms[0]!==rooms[1]};
}
export function boundaryKind(level,layout,key) {
  const item=layout.edges[key];if(!item)return null;
  if(item.kind==='door')return edgeInfo(level,layout,key).outer?'entry':'door';
  return item.kind;
}
export function roomEdges(level,layout,roomId,side) {
  return allEdges(level).filter(key=>{
    const {rooms}=edgeInfo(level,layout,key);if(!rooms.includes(roomId)||rooms[0]===rooms[1])return false;
    if(!side)return true;
    const {axis}=edgeParts(key);
    return (side==='N'&&axis==='h'&&rooms[1]===roomId)||(side==='S'&&axis==='h'&&rooms[0]===roomId)||(side==='W'&&axis==='v'&&rooms[1]===roomId)||(side==='E'&&axis==='v'&&rooms[0]===roomId);
  });
}
export function sharedEdges(level,layout,a,b,side) {
  return roomEdges(level,layout,a,side).filter(key=>edgeInfo(level,layout,key).rooms.includes(b));
}
function entities(level,layout,selector) {
  if(selector.kind==='window'||selector.kind==='door'||selector.kind==='entry'){
    return Object.keys(layout.edges).filter(key=>boundaryKind(level,layout,key)===selector.kind).filter(key=>!selector.roomId||edgeInfo(level,layout,key).rooms.includes(selector.roomId)).map(key=>({id:key,cells:edgeCells(key).filter(c=>level.outline.includes(c))}));
  }
  return layout.objects.filter(o=>o.kind===selector.kind&&(!selector.roomId||objectRoom(layout,o)===selector.roomId)).map(o=>({id:o.id,cells:footprint(o)}));
}
export function inDirection(sourceCells,targetCells,direction) {
  if(!sourceCells.length||!targetCells.length)return false;
  const b=bounds(sourceCells);
  return targetCells.some(cell=>{const[x,y]=point(cell);switch(direction){case'N':return x>=b.x&&x<b.x+b.w&&y<b.y;case'S':return x>=b.x&&x<b.x+b.w&&y>=b.y+b.h;case'W':return y>=b.y&&y<b.y+b.h&&x<b.x;case'E':return y>=b.y&&y<b.y+b.h&&x>=b.x+b.w;default:return false;}});
}
export function directionCounts(level,layout,source,target,direction){
  const sources=entities(level,layout,source),targets=entities(level,layout,target);
  return sources.map(s=>targets.filter(t=>t.id!==s.id&&inDirection(s.cells,t.cells,direction)).length);
}
function compare(value,rule) {return rule.op==='gte'?value>=rule.value:rule.op==='lte'?value<=rule.value:value===rule.value;}
export function reachableRooms(level,layout) {
  const graph=new Map(level.rooms.map(r=>[r.id,new Set()])),start=new Set();
  for(const key of Object.keys(layout.edges)){
    const kind=boundaryKind(level,layout,key),info=edgeInfo(level,layout,key);
    if(kind==='entry'&&info.outer)for(const r of info.rooms)if(r)start.add(r);
    if((kind==='door'||kind==='open')&&info.internal){graph.get(info.rooms[0])?.add(info.rooms[1]);graph.get(info.rooms[1])?.add(info.rooms[0]);}
  }
  const queue=[...start];for(let i=0;i<queue.length;i++)for(const r of graph.get(queue[i])||[])if(!start.has(r)){start.add(r);queue.push(r);}
  return start;
}
export function evaluateRule(level,layout,rule) {
  let actual,ok=false;
  if(rule.roomId&&!Object.values(layout.cells).includes(rule.roomId))return {id:rule.id,group:rule.group||rule.roomId,ok:false,actual:'未绘制房间',text:rule.text,type:rule.type};
  switch(rule.type){
    case'area':actual=Object.values(layout.cells).filter(id=>id===rule.roomId).length;ok=compare(actual,rule);break;
    case'objectCount':actual=entities(level,layout,{kind:rule.kind,roomId:rule.roomId}).length;ok=compare(actual,rule);break;
    case'boundaryCount':actual=roomEdges(level,layout,rule.roomId,rule.side).filter(key=>boundaryKind(level,layout,key)===rule.kind).length;ok=compare(actual,rule);break;
    case'globalCount':actual=Object.keys(layout.edges).filter(key=>boundaryKind(level,layout,key)===rule.kind).length;ok=compare(actual,rule);break;
    case'adjacent':actual=sharedEdges(level,layout,rule.roomId,rule.targetRoomId).length>0;ok=actual===!rule.forbidden;break;
    case'direction':{
      const counts=directionCounts(level,layout,rule.source,rule.target,rule.direction);actual=counts.length?counts.join(' / '):'缺少参考家具';
      ok=counts.length>0&&counts.every(n=>rule.forbidden?n===0:compare(n,rule));break;
    }
    case'fullOpen':{const edges=sharedEdges(level,layout,rule.roomId,rule.targetRoomId,rule.side);actual=edges.filter(k=>layout.edges[k]?.kind==='open').length;ok=edges.length>0&&actual===edges.length;break;}
    case'openLength':actual=sharedEdges(level,layout,rule.roomId,rule.targetRoomId).filter(k=>layout.edges[k]?.kind==='open').length;ok=compare(actual,rule);break;
    case'reachable':actual=reachableRooms(level,layout).size;ok=actual===level.rooms.length;break;
    case'coverage':actual=level.outline.filter(c=>layout.cells[c]).length;ok=actual===level.outline.length;break;
    default:actual='不支持的规则';
  }
  return {id:rule.id,group:rule.group||rule.roomId||'global',ok,actual,text:rule.text,type:rule.type};
}
export function integrityErrors(level,layout) {
  const shapeErrors=validateLayoutShape(level,layout);if(shapeErrors.length)return shapeErrors;
  const errors=[],outline=new Set(level.outline),ids=new Set(level.rooms.map(r=>r.id));
  for(const[c,id]of Object.entries(layout.cells))if(!outline.has(c)||!ids.has(id))errors.push('存在轮廓外区域或未知房间');
  for(const room of level.rooms){const cells=Object.keys(layout.cells).filter(c=>layout.cells[c]===room.id);if(cells.length&&!connected(cells))errors.push(`${room.name}须连成整体，角接触不算连接`);}
  const occupied=new Set();
  for(const object of layout.objects){
    if(!objectRoom(layout,object))errors.push(`${OBJECTS[object.kind]?.name||'家具'}须完整放在同一房间内`);
    for(const cell of footprint(object)){if(occupied.has(cell))errors.push('家具不能重叠');occupied.add(cell);}
  }
  for(const[key,item]of Object.entries(layout.edges)){
    const info=edgeInfo(level,layout,key);
    if(item.kind==='window'&&!info.outer)errors.push('当前版本的窗须放在外墙上');
    if(item.kind==='door'&&!(info.outer?info.rooms.some(Boolean):info.internal))errors.push('门须位于有效的外墙或两房公共墙上');
    if(item.kind==='open'&&!info.internal)errors.push('开放连接两侧须有不同房间');
  }
  for(const[key,item]of Object.entries(level.fixedEdges||{}))if(layout.edges[key]?.kind!==item.kind)errors.push('固定门窗不可修改');
  return [...new Set(errors)];
}
export function validateLayoutShape(level,layout){
  if(!layout||!layout.cells||!layout.edges||!Array.isArray(layout.objects))return ['图纸缺少占地、边界或家具数据'];
  const errors=[],edges=new Set(allEdges(level)),outline=new Set(level.outline),rooms=new Set(level.rooms.map(r=>r.id)),objectIds=new Set();
  for(const[c,id]of Object.entries(layout.cells))if(!outline.has(c)||!rooms.has(id))errors.push('图纸含轮廓外占地或未知房间');
  for(const[k,v]of Object.entries(layout.edges))if(!edges.has(k)||!['window','door','open'].includes(v?.kind))errors.push('图纸含未知边界或边界类型');
  for(const o of layout.objects){
    if(!o||!OBJECTS[o.kind]||!Number.isSafeInteger(o.x)||!Number.isSafeInteger(o.y)||![0,90,180,270].includes(o.rotation||0))errors.push('家具类型、坐标或朝向无效');
    if(!o?.id||objectIds.has(o.id))errors.push('家具ID缺失或重复');objectIds.add(o?.id);
  }
  return [...new Set(errors)];
}
export function evaluateLayout(level,layout){
  const shapeErrors=validateLayoutShape(level,layout);
  if(shapeErrors.length)return {results:level.rules.map(r=>({id:r.id,group:r.group||r.roomId||'global',ok:false,actual:'图纸数据无效',text:r.text,type:r.type})),errors:shapeErrors,complete:false};
  const results=level.rules.map(r=>evaluateRule(level,layout,r));const errors=integrityErrors(level,layout);return {results,errors,complete:results.every(r=>r.ok)&&errors.length===0};
}
export function validateLevel(level) {
  const errors=[];
  if(!level||typeof level!=='object')return ['关卡须为对象'];
  if(level.schemaVersion!==1)errors.push('不支持的关卡格式版本');
  if(level.rulesVersion!==ENGINE_VERSION)errors.push('不支持的规则集版本');
  if(!Array.isArray(level.outline)||!level.outline.length||new Set(level.outline).size!==level.outline.length)errors.push('轮廓必须非空且无重复格');
  const validCell=c=>typeof c==='string'&&/^\d+,\d+$/.test(c);
  if(!level.outline?.every(validCell))errors.push('轮廓坐标须为非负整数');
  const ids=new Set(level.rooms?.map(r=>r.id));
  if(!level.rooms?.length||ids.size!==level.rooms.length)errors.push('房间ID须唯一且非空');
  for(const room of level.rooms||[]){
    if(!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(room.id))errors.push('房间ID须为字母开头的稳定标识');
    if(typeof room.name!=='string'||!room.name.length||room.name.length>80)errors.push('房间名称须为1—80个字符');
    if(!/^#[0-9a-fA-F]{6}$/.test(room.color))errors.push('房间颜色须为六位十六进制色值');
  }
  const legalEdges=new Set(Array.isArray(level.outline)&&level.outline.every(validCell)?allEdges(level):[]);
  for(const[key,item]of Object.entries(level.fixedEdges||{}))if(!legalEdges.has(key)||!['window','door'].includes(item?.kind))errors.push('固定元素须为有效边界上的门窗');
  const seen=new Set();
  for(const rule of level.rules||[]){
    if(!rule.id||seen.has(rule.id))errors.push('条件ID缺失或重复');seen.add(rule.id);
    if(!RULE_TYPES.has(rule.type))errors.push(`不支持的规则：${rule.type}`);
    if(rule.op&&!['eq','gte','lte'].includes(rule.op))errors.push(`条件${rule.id}比较方式无效`);
    if(rule.group&&rule.group!=='global'&&!ids.has(rule.group))errors.push(`条件${rule.id}分组无效`);
    if(rule.side&&!['N','S','W','E'].includes(rule.side))errors.push(`条件${rule.id}墙面方向无效`);
    for(const id of [rule.roomId,rule.targetRoomId,rule.source?.roomId,rule.target?.roomId])if(id&&!ids.has(id))errors.push(`条件${rule.id}引用未知房间：${id}`);
    if(rule.type==='direction'&&(!rule.source?.kind||!rule.target?.kind||!['N','S','W','E'].includes(rule.direction)))errors.push(`条件${rule.id}方向参数无效`);
    for(const selector of [rule.source,rule.target])if(selector&&!OBJECTS[selector.kind]&&!['window','door','entry'].includes(selector.kind))errors.push(`条件${rule.id}引用未知物件`);
    if(['area','objectCount','boundaryCount','globalCount','openLength'].includes(rule.type)&&(!Number.isFinite(rule.value)||rule.value<0))errors.push(`条件${rule.id}数量无效`);
    if(rule.type==='direction'&&!rule.forbidden&&(!Number.isFinite(rule.value)||rule.value<0))errors.push(`条件${rule.id}方向数量无效`);
    if(rule.type==='objectCount'&&!OBJECTS[rule.kind])errors.push(`条件${rule.id}引用未知家具`);
    if(['boundaryCount','globalCount'].includes(rule.type)&&!['window','door','entry','open'].includes(rule.kind))errors.push(`条件${rule.id}边界类型无效`);
    if(['area','objectCount','boundaryCount','adjacent','fullOpen','openLength'].includes(rule.type)&&!rule.roomId)errors.push(`条件${rule.id}缺少房间`);
    if(['adjacent','fullOpen','openLength'].includes(rule.type)&&(!rule.targetRoomId||rule.targetRoomId===rule.roomId))errors.push(`条件${rule.id}目标房间无效`);
  }
  if(!level.rules?.length)errors.push('关卡须包含条件');
  return [...new Set(errors)];
}
export function paintRoom(level,layout,roomId,rect) {
  const next=clone(layout),outline=new Set(level.outline);
  for(let y=rect.y;y<rect.y+rect.h;y++)for(let x=rect.x;x<rect.x+rect.w;x++){
    const c=cellKey(x,y);if(!outline.has(c))continue;
    if(next.cells[c]&&next.cells[c]!==roomId)return {error:'先擦除已有房间，再绘制新房间'};
    next.cells[c]=roomId;
  }
  const own=Object.keys(next.cells).filter(c=>next.cells[c]===roomId);
  if(!connected(own))return {error:'追加区域须与同一房间边接触'};
  return {layout:next};
}
export function eraseRect(level,layout,rect,filter='all') {
  const next=clone(layout),hit=c=>{const[x,y]=point(c);return x>=rect.x&&x<rect.x+rect.w&&y>=rect.y&&y<rect.y+rect.h;};
  if(filter==='all'||filter==='room')for(const c of Object.keys(next.cells))if(hit(c))delete next.cells[c];
  if(filter==='all'||filter==='object')next.objects=next.objects.filter(o=>!footprint(o).some(hit));
  if(filter==='all'||filter==='edge')for(const key of Object.keys(next.edges))if(!level.fixedEdges?.[key]&&edgeCells(key).some(hit))delete next.edges[key];
  // Room removal also removes unsupported movable objects/edges; fixed windows survive.
  if(filter==='all'||filter==='room'){
    next.objects=next.objects.filter(o=>objectRoom(next,o));
    for(const key of Object.keys(next.edges))if(!level.fixedEdges?.[key]){const i=edgeInfo(level,next,key),kind=next.edges[key].kind;if(kind==='open'&&!i.internal||kind==='door'&&!(i.outer?i.rooms.some(Boolean):i.internal))delete next.edges[key];}
  }
  return next;
}
export function placeBoundary(level,layout,key,kind) {
  if(level.fixedEdges?.[key])return {error:'这是固定门窗，不能修改'};
  const info=edgeInfo(level,layout,key);
  if(kind==='window'&&(!info.outer||!info.rooms.some(Boolean)))return {error:'请在已绘制房间的外墙上放窗'};
  if(kind==='door'&&!(info.outer?info.rooms.some(Boolean):info.internal))return {error:'请先绘制墙两侧的房间，外墙门需内侧已有房间'};
  if(kind==='open'&&!info.internal)return {error:'开放连接两侧须先画好不同房间'};
  const next=clone(layout);next.edges[key]={kind};return {layout:next};
}
export function placeObject(level,layout,object) {
  const next=clone(layout);next.objects=next.objects.filter(o=>o.id!==object.id);next.objects.push(object);
  if(!objectRoom(next,object))return {error:'家具须完整放入同一房间'};
  const cells=new Set(footprint(object));if(next.objects.some(o=>o.id!==object.id&&footprint(o).some(c=>cells.has(c))))return {error:'家具不能重叠'};
  return {layout:next};
}
