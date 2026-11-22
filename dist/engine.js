import {roomArea,axisEdgePresent,validateGeometry} from './geometry.js';
export {roomArea} from './geometry.js';
// Pure shared rules: browser feedback, submission and generated reference checks.
export const ENGINE_VERSION = 'prototype-1';
import {OBJECTS} from './catalog.js';
export {OBJECTS} from './catalog.js';
export const RULE_TYPES = new Set(['area','objectCount','boundaryCount','globalCount','adjacent','direction','fullOpen','openLength','reachable','coverage','connectionCount','walkable','useSpace','distance','instances']);
export const clone = value => structuredClone(value);
export const cellKey = (x,y) => `${x},${y}`;
export const point = key => key.split(',').map(Number);
export const edgeKey = (axis,x,y) => `${axis}:${x}:${y}`;
export const edgeParts=key=>{const[axis,x,y,bx,by]=key.split(':');return {axis,x:+x,y:+y,...(axis==='d'?{a:[+x,+y],b:[+bx,+by]}:{})};};
export function edgeCells(key) { const {axis,x,y,a,b}=edgeParts(key);if(axis==='d')return [cellKey(Math.floor((a[0]+b[0])/2),Math.floor((a[1]+b[1])/2))]; return axis==='v' ? [cellKey(x-1,y),cellKey(x,y)] : [cellKey(x,y-1),cellKey(x,y)]; }
const geometryCache=new WeakMap();
function geometryFor(level){
  let cached=geometryCache.get(level);
  if(cached&&cached.source===level.outline&&cached.count===level.outline.length&&cached.areas===level.fixedAreas&&cached.walls===level.fixedWalls&&cached.geometry===level.geometry)return cached;
  const outline=new Set(level.outline),edges=new Set(),walls=new Set(level.fixedWalls||[]),exterior=new Set();
  for(const cell of outline){const[x,y]=point(cell);edges.add(edgeKey('v',x,y));edges.add(edgeKey('v',x+1,y));edges.add(edgeKey('h',x,y));edges.add(edgeKey('h',x,y+1));}
  for(const key of [...edges])if(!edgeCells(key).some(cell=>outline.has(cell)&&axisEdgePresent(level,cell,key)))edges.delete(key);
  for(const segment of level.geometry?.segments||[])edges.add(segment.key);
  if(outline.size){
    const b=bounds([...outline]),start=cellKey(b.x-1,b.y-1),queue=[start];exterior.add(start);
    for(let i=0;i<queue.length;i++)for(const n of neighbors(queue[i])){
      const[x,y]=point(n);if(x<b.x-1||x>b.x+b.w||y<b.y-1||y>b.y+b.h||outline.has(n)||level.fixedAreas?.[n]||exterior.has(n))continue;
      exterior.add(n);queue.push(n);
    }
  }
  cached={source:level.outline,count:level.outline.length,areas:level.fixedAreas,walls:level.fixedWalls,geometry:level.geometry,outline,edges:[...edges],wallSet:walls,exterior};geometryCache.set(level,cached);return cached;
}
export function allEdges(level){return geometryFor(level).edges;}
export function crossesFixedWall(level,object){
  const cells=new Set(footprint(object));
  return (level.fixedWalls||[]).some(key=>edgeCells(key).every(c=>cells.has(c)));
}
export function neighbors(cell) {const[x,y]=point(cell);return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].map(([a,b])=>cellKey(a,b));}
export function connected(cells,level) {
  if(!cells.length)return false;
  const set=new Set(cells), seen=new Set([cells[0]]), queue=[cells[0]];
  for(let i=0;i<queue.length;i++)for(const c of neighbors(queue[i]))if(set.has(c)&&!seen.has(c)){if(level){const[x,y]=point(queue[i]),[nx,ny]=point(c),key=nx===x?edgeKey('h',x,Math.max(y,ny)):edgeKey('v',Math.max(x,nx),y),info=edgeInfo(level,{cells:{}},key);if(!info.inside.every(Boolean)||info.fixed)continue;}seen.add(c);queue.push(c);}
  return seen.size===set.size;
}
export function bounds(cells) {
  const pts=cells.map(point); const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs)+1,h:Math.max(...ys)-Math.min(...ys)+1};
}
export function footprint(object) {
  const def=OBJECTS[object.kind];if(!def)return [];
  const shape=def.shape||Array.from({length:def.w*def.h},(_,i)=>[i%def.w,Math.floor(i/def.w)]);
  return shape.map(([a,b])=>{let x=a,y=b;switch(object.rotation||0){case 90:x=def.h-1-b;y=a;break;case 180:x=def.w-1-a;y=def.h-1-b;break;case 270:x=b;y=def.w-1-a;break;}return cellKey(object.x+x,object.y+y);}).sort((a,b)=>{const[x,y]=point(a),[u,v]=point(b);return y-v||x-u;});
}
export function objectRoom(layout,object) {
  const cells=footprint(object),ids=new Set(cells.map(c=>layout.cells[c]));
  return cells.length && ids.size===1 && !ids.has(undefined) ? [...ids][0] : null;
}
export function initialLayout(level) {return {cells:{},edges:clone(level.fixedEdges||{}),objects:[]};}
export function edgeInfo(level,layout,key) {
  const geometry=geometryFor(level),segment=level.geometry?.segments?.find(s=>s.key===key);
  if(segment)return {cells:[segment.cell],inside:[true,false],rooms:[layout.cells[segment.cell]||null,null],outer:true,boundary:true,structural:false,fixed:false,windowAllowed:true,internal:false};
  const cells=edgeCells(key),inside=cells.map(c=>geometry.outline.has(c)&&axisEdgePresent(level,c,key));
  const rooms=cells.map((c,i)=>inside[i]?layout.cells[c]||null:null),outside=cells.find((c,i)=>!inside[i]);
  const boundary=inside[0]!==inside[1],outer=boundary&&(geometry.exterior.has(outside)||!!level.geometry?.cellPolygons?.[outside]);
  return {cells,inside,rooms,outer,boundary,structural:boundary&&!outer,fixed:geometry.wallSet.has(key),windowAllowed:outer||boundary&&level.fixedAreas?.[outside]==='courtyard',internal:inside[0]&&inside[1]&&!!rooms[0]&&!!rooms[1]&&rooms[0]!==rooms[1]};
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
export function selectedObjects(layout,selector){return layout.objects.filter(o=>(!selector.objectId||o.id===selector.objectId)&&(!selector.tag||o.tag===selector.tag)&&o.kind===selector.kind&&(!selector.roomId||objectRoom(layout,o)===selector.roomId));}
function entities(level,layout,selector) {
  if(selector.kind==='window'||selector.kind==='door'||selector.kind==='entry'){
    return Object.keys(layout.edges).filter(key=>boundaryKind(level,layout,key)===selector.kind).filter(key=>!selector.roomId||edgeInfo(level,layout,key).rooms.includes(selector.roomId)).map(key=>{const info=edgeInfo(level,layout,key);return {id:key,cells:info.cells.filter((c,i)=>info.inside[i])};});
  }
  return selectedObjects(layout,selector).map(o=>({id:o.id,cells:footprint(o)}));
}
export function directionBands(sourceCells,direction,outer){
  const vertical=['N','S'].includes(direction),groups=new Map();
  for(const cell of sourceCells){const[x,y]=point(cell),key=vertical?x:y,value=vertical?y:x;groups.set(key,[...(groups.get(key)||[]),value]);}
  return [...groups].map(([axis,values])=>{
    const lo=Math.min(...values),hi=Math.max(...values)+1;
    if(direction==='N')return {x:axis,y:outer.y,w:1,h:Math.max(0,lo-outer.y)};
    if(direction==='S')return {x:axis,y:hi,w:1,h:Math.max(0,outer.y+outer.h-hi)};
    if(direction==='W')return {x:outer.x,y:axis,w:Math.max(0,lo-outer.x),h:1};
    return {x:hi,y:axis,w:Math.max(0,outer.x+outer.w-hi),h:1};
  });
}
export function inDirection(sourceCells,targetCells,direction) {
  if(!sourceCells.length||!targetCells.length||!['N','S','W','E'].includes(direction))return false;
  const all=bounds([...sourceCells,...targetCells]),bands=directionBands(sourceCells,direction,all);
  return targetCells.some(cell=>{const[x,y]=point(cell);return bands.some(b=>x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h);});
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
// Used only when a level explicitly includes the visible walkability condition.
// Old drafts keep their original rules and therefore their original results.
export function walkableFloor(level,layout){
  const occupied=new Set(layout.objects.flatMap(footprint)),free=new Set(Object.keys(layout.cells).filter(c=>!occupied.has(c))),starts=[];
  let blockedDoors=false;
  for(const [key,item]of Object.entries(layout.edges))if(item.kind==='door'){
    const info=edgeInfo(level,layout,key),inside=info.cells.filter((c,i)=>info.inside[i]);
    if(inside.some(c=>!free.has(c)))blockedDoors=true;
    if(info.outer&&free.has(inside[0]))starts.push(inside[0]);
  }
  const seen=new Set(starts),queue=[...seen];
  for(let i=0;i<queue.length;i++){
    const c=queue[i],[x,y]=point(c);
    for(const n of neighbors(c))if(free.has(n)&&!seen.has(n)){
      const[nx,ny]=point(n),key=nx===x?edgeKey('h',x,Math.max(y,ny)):edgeKey('v',Math.max(x,nx),y);
      if(geometryFor(level).wallSet.has(key)||!edgeInfo(level,layout,key).inside.every(Boolean))continue;
      if(layout.cells[c]!==layout.cells[n]&&!['door','open'].includes(layout.edges[key]?.kind))continue;
      seen.add(n);queue.push(n);
    }
  }
  return {free,seen,blockedDoors,hasEntry:starts.length>0};
}
export function walkabilityErrors(level,layout){
  const {free,seen,blockedDoors,hasEntry}=walkableFloor(level,layout),errors=[];
  if(!hasEntry)return ['需要可通行的入户门'];
  if(blockedDoors)errors.push('门口不能被家具或未绘制区域阻挡');
  if(seen.size!==free.size)errors.push('家具不能切断室内通路');
  for(const room of level.rooms)if(![...seen].some(c=>layout.cells[c]===room.id))errors.push(`${room.name}没有可通行空间`);
  for(const object of layout.objects)if(!footprint(object).some(c=>neighbors(c).some(n=>seen.has(n)&&layout.cells[n]===objectRoom(layout,object))))errors.push(`${OBJECTS[object.kind].name}需要可到达的使用位置`);
  return [...new Set(errors)];
}
export function frontDirection(object){
  const directions=['S','W','N','E'],base=directions.indexOf(OBJECTS[object.kind]?.front);
  return base<0?null:directions[(base+(object.rotation||0)/90)%4];
}
export function frontCells(object,depth=1){
  const direction=frontDirection(object);if(!direction)return [];
  const vertical=['N','S'].includes(direction),groups=new Map();
  for(const cell of footprint(object)){const[x,y]=point(cell),key=vertical?x:y,value=vertical?y:x;groups.set(key,[...(groups.get(key)||[]),value]);}
  return [...groups].flatMap(([axis,values])=>Array.from({length:depth},(_,i)=>{const value=['N','W'].includes(direction)?Math.min(...values)-1-i:Math.max(...values)+1+i;return vertical?cellKey(axis,value):cellKey(value,axis);}));
}
export function useSpaceResults(level,layout,selector,depth=1){
  const {seen}=walkableFloor(level,layout);
  return selectedObjects(layout,selector).map(object=>{
    const room=objectRoom(layout,object),cells=frontCells(object,depth),area=new Set([...footprint(object),...cells]);
    const wall=(level.fixedWalls||[]).some(key=>edgeCells(key).every(c=>area.has(c)));
    return {id:object.id,cells,ok:!!room&&!!cells.length&&!wall&&cells.every(c=>layout.cells[c]===room&&!level.geometry?.cellPolygons?.[c]&&seen.has(c))};
  });
}
// Compare real occupied unit squares, including concave furniture cutouts.
export function objectClosestPoints(a,b){
  const rectangles=o=>OBJECTS[o.kind]?.shape?footprint(o).map(c=>{const[x,y]=point(c);return {x,y,w:1,h:1};}):[bounds(footprint(o))];
  const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));let best;
  for(const x of rectangles(a))for(const y of rectangles(b)){
    const ax=clamp(y.x+y.w/2,x.x,x.x+x.w),ay=clamp(y.y+y.h/2,x.y,x.y+x.h),bx=clamp(ax,y.x,y.x+y.w),by=clamp(ay,y.y,y.y+y.h),squared=(ax-bx)**2+(ay-by)**2;
    if(!best||squared<best.squared)best={squared,a:[ax,ay],b:[bx,by]};
  }
  return best;
}
export function objectDistanceSquared(a,b){return objectClosestPoints(a,b).squared;}
export function furnitureDistances(layout,source,target){
  const targets=selectedObjects(layout,target);
  return selectedObjects(layout,source).map(a=>{const values=targets.filter(b=>b.id!==a.id).map(b=>objectDistanceSquared(a,b));return values.length?Math.min(...values):null;});
}
export function evaluateRule(level,layout,rule) {
  let actual,ok=false;
  if(rule.roomId&&!Object.values(layout.cells).includes(rule.roomId))return {id:rule.id,group:rule.group||rule.roomId,ok:false,actual:'未绘制房间',text:rule.text,type:rule.type};
  switch(rule.type){
    case'instances':{const found=rule.tags.filter(tag=>selectedObjects(layout,{kind:rule.kind,roomId:rule.roomId,tag}).length===1);actual=found.length;ok=found.length===rule.tags.length;break;}
    case'area':actual=roomArea(level,layout,rule.roomId);ok=compare(actual,rule);break;
    case'objectCount':actual=entities(level,layout,{kind:rule.kind,roomId:rule.roomId}).length;ok=compare(actual,rule);break;
    case'boundaryCount':actual=roomEdges(level,layout,rule.roomId,rule.side).filter(key=>boundaryKind(level,layout,key)===rule.kind).length;ok=compare(actual,rule);break;
    case'globalCount':actual=Object.keys(layout.edges).filter(key=>boundaryKind(level,layout,key)===rule.kind).length;ok=compare(actual,rule);break;
    case'adjacent':actual=sharedEdges(level,layout,rule.roomId,rule.targetRoomId).length>0;ok=actual===!rule.forbidden;break;
    case'direction':{
      const counts=directionCounts(level,layout,rule.source,rule.target,rule.direction);actual=counts.length?counts.join(' / '):'缺少参考家具';
      ok=counts.length>0&&counts[rule.quantifier==='any'?'some':'every'](n=>rule.forbidden?n===0:compare(n,rule));break;
    }
    case'fullOpen':{const edges=sharedEdges(level,layout,rule.roomId,rule.targetRoomId,rule.side);actual=edges.filter(k=>layout.edges[k]?.kind==='open').length;ok=edges.length>0&&actual===edges.length;break;}
    case'openLength':actual=sharedEdges(level,layout,rule.roomId,rule.targetRoomId).filter(k=>layout.edges[k]?.kind==='open').length;ok=compare(actual,rule);break;
    case'connectionCount':actual=sharedEdges(level,layout,rule.roomId,rule.targetRoomId).filter(key=>boundaryKind(level,layout,key)===rule.kind).length;ok=compare(actual,rule);break;
    case'useSpace':{const results=useSpaceResults(level,layout,rule.source,rule.depth);actual=results.length?results.map(r=>r.ok?'可使用':'正面受阻').join(' / '):'缺少参考家具';ok=results.length>0&&results[rule.quantifier==='any'?'some':'every'](r=>r.ok);break;}
    case'distance':{const values=furnitureDistances(layout,rule.source,rule.target);actual=values.length?values.map(n=>n===null?'缺少目标家具':Math.round(Math.sqrt(n)*100)/100+'m').join(' / '):'缺少参考家具';ok=values.length>0&&values[rule.quantifier==='any'?'some':'every'](n=>n!==null&&compare(n,{...rule,value:rule.value**2}));break;}
    case'walkable':actual=walkabilityErrors(level,layout).length;ok=actual===0;break;
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
  for(const room of level.rooms){const cells=Object.keys(layout.cells).filter(c=>layout.cells[c]===room.id);if(cells.length&&!connected(cells,level))errors.push(`${room.name}须连成整体，角接触不算连接`);}
  const occupied=new Set();
  for(const object of layout.objects){
    if(footprint(object).some(c=>level.geometry?.cellPolygons?.[c]))errors.push('家具不能越过斜墙');
    if(crossesFixedWall(level,object))errors.push('家具不能跨越固定墙');
    if(!objectRoom(layout,object))errors.push(`${OBJECTS[object.kind]?.name||'家具'}须完整放在同一房间内`);
    for(const cell of footprint(object)){if(occupied.has(cell))errors.push('家具不能重叠');occupied.add(cell);}
  }
  for(const[key,item]of Object.entries(layout.edges)){
    const info=edgeInfo(level,layout,key);
    if(info.fixed)errors.push('固定墙不可改为门窗或开放连接');
    if(item.kind==='window'&&!info.windowAllowed)errors.push('当前版本的窗须放在外墙上');
    if(item.kind==='door'&&!(info.outer?info.rooms.some(Boolean):info.internal))errors.push('门须位于有效的外墙或两房公共墙上');
    if(item.kind==='open'&&!info.internal)errors.push('开放连接两侧须有不同房间');
  }
  for(const[key,item]of Object.entries(level.fixedEdges||{}))if(layout.edges[key]?.kind!==item.kind)errors.push('固定门窗不可修改');
  return [...new Set(errors)];
}
export function validateLayoutShape(level,layout){
  if(!layout||!layout.cells||!layout.edges||!Array.isArray(layout.objects))return ['图纸缺少占地、边界或家具数据'];
  const errors=[],tags=new Set(),slots=new Map((level.instanceSlots||[]).map(slot=>[slot.tag,slot])),edges=new Set(allEdges(level)),outline=new Set(level.outline),rooms=new Set(level.rooms.map(r=>r.id)),objectIds=new Set();
  for(const[c,id]of Object.entries(layout.cells))if(!outline.has(c)||!rooms.has(id))errors.push('图纸含轮廓外占地或未知房间');
  for(const[k,v]of Object.entries(layout.edges))if(!edges.has(k)||!['window','door','open'].includes(v?.kind))errors.push('图纸含未知边界或边界类型');
  for(const o of layout.objects){
    if(!o||!OBJECTS[o.kind]||!Number.isSafeInteger(o.x)||!Number.isSafeInteger(o.y)||![0,90,180,270].includes(o.rotation||0))errors.push('家具类型、坐标或朝向无效');
    if(o.tag!==undefined){const slot=slots.get(o.tag);if(!slot||slot.kind!==o.kind||tags.has(o.tag))errors.push('家具标记未知、类型不匹配或重复');tags.add(o.tag);}
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
  if(![1,2].includes(level.schemaVersion))errors.push('不支持的关卡格式版本');
  if(level.rulesVersion!==ENGINE_VERSION)errors.push('不支持的规则集版本');
  if(!Array.isArray(level.outline)||!level.outline.length||new Set(level.outline).size!==level.outline.length)errors.push('轮廓必须非空且无重复格');
  const validCell=c=>typeof c==='string'&&/^\d+,\d+$/.test(c);
  if(!level.outline?.every(validCell))errors.push('轮廓坐标须为非负整数');
  if(Array.isArray(level.outline))errors.push(...validateGeometry(level));
  const ids=new Set(level.rooms?.map(r=>r.id));
  if(!level.rooms?.length||ids.size!==level.rooms.length)errors.push('房间ID须唯一且非空');
  for(const room of level.rooms||[]){
    if(!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(room.id))errors.push('房间ID须为字母开头的稳定标识');
    if(typeof room.name!=='string'||!room.name.length||room.name.length>80)errors.push('房间名称须为1—80个字符');
    if(!/^#[0-9a-fA-F]{6}$/.test(room.color))errors.push('房间颜色须为六位十六进制色值');
  }
  const legalEdges=new Set(Array.isArray(level.outline)&&level.outline.every(validCell)?allEdges(level):[]);
  for(const[key,item]of Object.entries(level.fixedEdges||{}))if(!legalEdges.has(key)||!['window','door'].includes(item?.kind))errors.push('固定元素须为有效边界上的门窗');
  for(const [cell,kind]of Object.entries(level.fixedAreas||{}))if(!validCell(cell)||level.outline.includes(cell)||!['column','shaft','courtyard'].includes(kind))errors.push('固定区域类型或占地无效');
  if(level.fixedWalls&&(!Array.isArray(level.fixedWalls)||level.fixedWalls.some(key=>!legalEdges.has(key))))errors.push('固定墙须位于有效边界');
  const rawSlots=Array.isArray(level.instanceSlots)?level.instanceSlots:[],configuredSlots=rawSlots.filter(slot=>slot&&typeof slot==='object');
  if(rawSlots.length!==configuredSlots.length)errors.push('家具标记定义无效');
  if(level.instanceSlots!==undefined&&!Array.isArray(level.instanceSlots))errors.push('家具标记须为列表');
  const slotTags=new Set();
  for(const slot of configuredSlots){if(!slot||typeof slot!=='object'){errors.push('家具标记定义无效');continue;}if(!/^[A-Z]$/.test(slot.tag)||slotTags.has(slot.tag)||!OBJECTS[slot.kind]||!ids.has(slot.roomId))errors.push('家具标记定义无效或重复');slotTags.add(slot.tag);}
  const seen=new Set();
  for(const rule of level.rules||[]){
    if(!rule.id||seen.has(rule.id))errors.push('条件ID缺失或重复');seen.add(rule.id);
    if(!RULE_TYPES.has(rule.type))errors.push(`不支持的规则：${rule.type}`);
    if(rule.op&&!['eq','gte','lte'].includes(rule.op))errors.push(`条件${rule.id}比较方式无效`);
    if(rule.group&&rule.group!=='global'&&!ids.has(rule.group))errors.push(`条件${rule.id}分组无效`);
    if(rule.side&&!['N','S','W','E'].includes(rule.side))errors.push(`条件${rule.id}墙面方向无效`);
    for(const id of [rule.roomId,rule.targetRoomId,rule.source?.roomId,rule.target?.roomId])if(id&&!ids.has(id))errors.push(`条件${rule.id}引用未知房间：${id}`);
    if(rule.quantifier&&!['all','any'].includes(rule.quantifier))errors.push(`条件${rule.id}来源量词无效`);
    if(rule.type==='direction'&&(!rule.source?.kind||!rule.target?.kind||!['N','S','W','E'].includes(rule.direction)))errors.push(`条件${rule.id}方向参数无效`);
    for(const selector of [rule.source,rule.target])if(selector&&!OBJECTS[selector.kind]&&!['window','door','entry'].includes(selector.kind))errors.push(`条件${rule.id}引用未知物件`);
    if(['area','objectCount','boundaryCount','globalCount','openLength','connectionCount'].includes(rule.type)&&(!Number.isFinite(rule.value)||rule.value<0))errors.push(`条件${rule.id}数量无效`);
    if(rule.type==='direction'&&!rule.forbidden&&(!Number.isFinite(rule.value)||rule.value<0))errors.push(`条件${rule.id}方向数量无效`);
    if(['useSpace','distance'].includes(rule.type)&&(!rule.source||!OBJECTS[rule.source.kind]))errors.push(`条件${rule.id}需要家具来源`);
    if(rule.type==='useSpace'&&(!OBJECTS[rule.source?.kind]?.front||!Number.isInteger(rule.depth)||rule.depth<1||rule.depth>3))errors.push(`条件${rule.id}正面或使用深度无效`);
    if(rule.type==='distance'&&(!rule.target||!OBJECTS[rule.target.kind]||!Number.isFinite(rule.value)||rule.value<0||!['lte','gte'].includes(rule.op)))errors.push(`条件${rule.id}距离参数无效`);
    for(const selector of [rule.source,rule.target])if(selector?.objectId!==undefined&&(typeof selector.objectId!=='string'||!selector.objectId.length))errors.push(`条件${rule.id}实例标识无效`);
    if(rule.type==='instances'&&(!rule.roomId||!OBJECTS[rule.kind]||!Array.isArray(rule.tags)||!rule.tags.length||new Set(rule.tags).size!==rule.tags.length||rule.tags.some(tag=>!configuredSlots.some(slot=>slot.tag===tag&&slot.kind===rule.kind&&slot.roomId===rule.roomId))))errors.push(`条件${rule.id}标记定义无效`);
    for(const selector of [rule.source,rule.target])if(selector?.tag!==undefined&&(!configuredSlots.some(slot=>slot.tag===selector.tag&&slot.kind===selector.kind)||selector.objectId))errors.push(`条件${rule.id}引用无效家具标记`);
    if(rule.type==='objectCount'&&!OBJECTS[rule.kind])errors.push(`条件${rule.id}引用未知家具`);
    if(rule.type==='connectionCount'&&!['door','open'].includes(rule.kind))errors.push(`条件${rule.id}连接类型无效`);
    if(['boundaryCount','globalCount'].includes(rule.type)&&!['window','door','entry','open'].includes(rule.kind))errors.push(`条件${rule.id}边界类型无效`);
    if(['area','objectCount','boundaryCount','adjacent','fullOpen','openLength','connectionCount'].includes(rule.type)&&!rule.roomId)errors.push(`条件${rule.id}缺少房间`);
    if(['adjacent','fullOpen','openLength','connectionCount'].includes(rule.type)&&(!rule.targetRoomId||rule.targetRoomId===rule.roomId))errors.push(`条件${rule.id}目标房间无效`);
  }
  for(const slot of configuredSlots)if(slot&&!level.rules?.some(r=>r.type==='instances'&&Array.isArray(r.tags)&&r.tags.includes(slot.tag)))errors.push('每个家具标记须有明示标记要求');
  if(!level.rules?.length)errors.push('关卡须包含条件');
  return [...new Set(errors)];
}
export function paintRoom(level,layout,roomId,rect) {
  const next=clone(layout),outline=new Set(level.outline);let painted=0;
  for(let y=rect.y;y<rect.y+rect.h;y++)for(let x=rect.x;x<rect.x+rect.w;x++){
    const c=cellKey(x,y);if(!outline.has(c))continue;
    if(next.cells[c]&&next.cells[c]!==roomId)return {error:'先擦除已有房间，再绘制新房间'};
    next.cells[c]=roomId;painted++;
  }
  if(!painted)return {error:'范围内没有可规划区域，固定结构不能占用'};
  const own=Object.keys(next.cells).filter(c=>next.cells[c]===roomId);
  if(!connected(own,level))return {error:'追加区域须与同一房间边接触'};
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
  if((level.fixedWalls||[]).includes(key))return {error:'这是固定墙，不能放置门窗或开放连接'};
  if(level.fixedEdges?.[key])return {error:'这是固定门窗，不能修改'};
  const info=edgeInfo(level,layout,key);
  if(kind==='window'&&(!info.windowAllowed||!info.rooms.some(Boolean)))return {error:'请在已绘制房间的外墙上放窗'};
  if(kind==='door'&&!(info.outer?info.rooms.some(Boolean):info.internal))return {error:'请先绘制墙两侧的房间，外墙门需内侧已有房间'};
  if(kind==='open'&&!info.internal)return {error:'开放连接两侧须先画好不同房间'};
  const next=clone(layout);next.edges[key]={kind};return {layout:next};
}
export function placeObject(level,layout,object) {
  const next=clone(layout);next.objects=next.objects.filter(o=>o.id!==object.id);next.objects.push(object);
  if(footprint(object).some(c=>level.geometry?.cellPolygons?.[c]))return {error:'家具不能越过斜墙，请放到完整可用空间'};
  if(crossesFixedWall(level,object))return {error:'家具不能跨越固定墙'};
  if(!objectRoom(next,object))return {error:'家具须完整放入同一房间'};
  if(object.tag&&!(level.instanceSlots||[]).some(slot=>slot.tag===object.tag&&slot.kind===object.kind))return {error:'这个标记不适用于当前家具'};
  if(object.tag&&next.objects.some(o=>o.id!==object.id&&o.tag===object.tag))return {error:'这个家具标记已被使用，请更换或交换标记'};
  const cells=new Set(footprint(object));if(next.objects.some(o=>o.id!==object.id&&footprint(o).some(c=>cells.has(c))))return {error:'家具不能重叠'};
  return {layout:next};
}
export function rotateObject(level,layout,id,quarterTurns=1){
  const object=layout.objects.find(o=>o.id===id);
  if(!object)return {error:'请先选中一件家具'};
  const rotation=(((object.rotation||0)+quarterTurns*90)%360+360)%360;
  return placeObject(level,layout,{...object,rotation});
}
