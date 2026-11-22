import {configureInstances,addInstanceRule,instanceName} from './instances.js';
import {createUseSpacePlan,referenceUseSpaceOK,addSpatialRules} from './spatial-generation.js';
import {addFurnitureInstances,mechanicsAt,mechanicsIntroducedAt} from './mechanics.js';
import {describeStructure,repetitionScore} from './puzzle-diversity.js';
import {SHAPE_UNLOCKS,SHAPE_INTRODUCTIONS} from './shape-catalog.js';
import {roomArea} from './geometry.js';
import {selectClues,levelFingerprint} from './generation-policy.js';
import {CONTENT_VERSION,ROOM_CATALOG,roomFurniture} from './catalog.js';
import {createExpandedPlan,SHAPE_NAMES} from './expanded-plans.js';
import {createResidentialPlan} from './residential.js';
import {unlockedFurnitureAt,furnitureIntroducedAt} from './progression.js';
import {generationQualityErrors} from './generation-quality.js';
import {walkabilityErrors,crossesFixedWall,footprint,neighbors,edgeCells,boundaryKind,ENGINE_VERSION,OBJECTS,cellKey,point,allEdges,edgeInfo,edgeParts,sharedEdges,roomEdges,objectRoom,directionCounts,evaluateLayout,validateLevel,clone} from './engine.js';
export const GENERATOR_VERSION='0.8.0';
// Catalogue changes do not need to reshuffle the established spatial seed stream.
const SEED_STREAM_VERSION='0.2.0';
const ROLES=ROOM_CATALOG;
const SIDES={N:'北',S:'南',W:'西',E:'东'};
export function randomFromSeed(seed){let h=2166136261;for(const c of String(seed)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function shuffled(items,rand){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function placeReferenceFurniture(level,layout,rand,furnitureByRoom,deadline){
  const reserved=new Set(Object.entries(layout.edges).filter(([,e])=>['door','open'].includes(e.kind)).flatMap(([key])=>edgeCells(key)));
  for(const room of level.rooms){
    const own=Object.keys(layout.cells).filter(c=>layout.cells[c]===room.id);
    const kinds=[...furnitureByRoom[room.id]].sort((a,b)=>OBJECTS[b].w*OBJECTS[b].h-OBJECTS[a].w*OBJECTS[a].h);
    const candidates=kinds.map((kind,index)=>own.flatMap(c=>{const[x,y]=point(c);return [0,90,180,270].map(rotation=>({id:`${room.id}-${kind}-${index+1}`,kind,x,y,rotation}));}).filter(o=>!crossesFixedWall(level,o)&&!footprint(o).some(c=>level.geometry?.cellPolygons?.[c])&&footprint(o).every(c=>layout.cells[c]===room.id&&!reserved.has(c))).map(o=>({o,rank:footprint(o).reduce((sum,c)=>sum+neighbors(c).filter(n=>layout.cells[n]!==room.id).length,0)+rand()*.8})).sort((a,b)=>b.rank-a.rank).map(item=>item.o));
    const pack=index=>{
      if(Date.now()>deadline)throw new Error('家具摆放超过预算');
      if(index===kinds.length)return true;
      const occupied=new Set(layout.objects.flatMap(footprint));
      for(const object of candidates[index]){
        if(footprint(object).some(c=>occupied.has(c)))continue;
        layout.objects.push(object);
        if(!walkabilityErrors(level,layout).length&&referenceUseSpaceOK(level,layout)&&pack(index+1))return true;
        layout.objects.pop();
      }
      return false;
    };
    if(!pack(0))throw new Error(`${room.name}缺少家具与通行空间`);
  }
}
function makeLevel(seed,mode,{chapter,family,deadline=Date.now()+1200}={}) {
  const rand=randomFromSeed(`${SEED_STREAM_VERSION}:${mode}:${seed}`),basic=mode==='intro',complex=mode==='complex';
  const expanded=chapter>=12||!!family;
  const plan=expanded?createExpandedPlan(rand,{chapter,family}):createResidentialPlan(mode,rand);
  const furnitureByRoom=addFurnitureInstances(roomFurniture(plan,{chapter,rand,expanded,basic}),{chapter:chapter||0,rand});
  const newFurniture=chapter===undefined?[]:furnitureIntroducedAt(chapter).filter(kind=>Object.values(furnitureByRoom).some(kinds=>kinds.includes(kind)));
  const level={id:`${mode}:${seed}`,title:basic?'第一份委托':complex?'复杂住宅委托':'住宅设计委托',seed:String(seed),mode,...(chapter!==undefined?{chapter}:{}),schemaVersion:plan.geometry?2:1,geometry:plan.geometry,rulesVersion:ENGINE_VERSION,generatorVersion:GENERATOR_VERSION,rooms:plan.roomIds.map(id=>({id,name:ROLES[id].name,color:ROLES[id].color})),outline:Object.keys(plan.cells),fixedEdges:{},rules:[],contentVersion:CONTENT_VERSION,fixedAreas:plan.fixedAreas||{},fixedWalls:plan.fixedWalls||[],planning:{templateId:plan.templateId,shapeFamily:plan.shapeFamily||'legacy',orientation:plan.orientation}};
  level.useSpacePlan=createUseSpacePlan(furnitureByRoom,chapter||0,rand);
  const layout={cells:plan.cells,edges:{},objects:[]};
  const names=Object.fromEntries(level.rooms.map(r=>[r.id,r.name]));
  const add=rule=>level.rules.push({id:`r${level.rules.length+1}`,op:'eq',...rule});
  const openPairs=[];
  for(const connection of plan.connections){
    const edges=sharedEdges(level,layout,connection.a,connection.b);
    if(!edges.length)throw new Error(`分区模板缺少公共墙：${connection.a}/${connection.b}`);
    if(connection.kind==='open'){
      for(const key of edges)layout.edges[key]={kind:'open'};
      openPairs.push({...connection,edges});
    }else layout.edges[edges[Math.floor(edges.length/2)]]={kind:'door'};
  }
  const entry=plan.entryEdge;layout.edges[entry]={kind:'door'};
  placeReferenceFurniture(level,layout,rand,furnitureByRoom,deadline);
  configureInstances(level,layout,chapter||0);
  for(const room of level.rooms){
    for(const side of ['N','S','W','E']){
      const edges=roomEdges(level,layout,room.id,side).filter(key=>edgeInfo(level,layout,key).windowAllowed&&key!==entry);
      if(edges.length){const center=Math.floor(edges.length/2);layout.edges[edges[center]]={kind:'window'};
        if(!basic&&edges.length>=4&&rand()>.4){const other=edges[Math.max(0,center-2)];layout.edges[other]={kind:'window'};}
      }
    }
  }
  for(const segment of level.geometry?.segments||[])layout.edges[segment.key]={kind:'window'};
  const windows=Object.keys(layout.edges).filter(key=>layout.edges[key].kind==='window');
  for(const key of shuffled(windows,rand).slice(0,basic?2:3)){level.fixedEdges[key]={kind:'window',fixed:true};layout.edges[key].fixed=true;}
  for(const[kind,text]of [['entry','入户门'],['door','室内门'],['window','窗户'],['open','开放连接总长']]){
    const value=Object.keys(layout.edges).filter(key=>boundaryKind(level,layout,key)===kind).length;
    add({type:'globalCount',kind,value,text:`全屋${text} ${value}${kind==='open'?'m':'扇'}`,group:'global'});
  }
  add({type:'reachable',text:'所有房间直接或间接通向入户门',group:'global'});
  add({type:'coverage',text:'规划完整建筑轮廓',group:'global'});
  add({type:'walkable',text:'门口留空，家具不阻断通路且有可到达的使用位置',group:'global'});
  add({type:'boundaryCount',roomId:plan.entryRoomId,kind:'entry',value:1,text:'入户门 ×1'});
  for(const room of level.rooms){
    const own=Object.keys(layout.cells).filter(c=>layout.cells[c]===room.id);
    add({type:'area',roomId:room.id,value:roomArea(level,layout,room.id),text:`面积 ${roomArea(level,layout,room.id)}㎡`});
    for(const kind of new Set(furnitureByRoom[room.id])){const value=furnitureByRoom[room.id].filter(k=>k===kind).length;add({type:'objectCount',roomId:room.id,kind,value,text:`${OBJECTS[kind].name} ×${value}`});}
    const n=roomEdges(level,layout,room.id).filter(k=>layout.edges[k]?.kind==='window').length;
    add({type:'boundaryCount',roomId:room.id,kind:'window',value:n,text:n?`窗户 ×${n}`:'不能有窗户'});
    if(!basic){
      const side=shuffled(['N','S','W','E'],rand).find(s=>roomEdges(level,layout,room.id,s).some(k=>layout.edges[k]?.kind==='window'));
      if(side){const count=roomEdges(level,layout,room.id,side).filter(k=>layout.edges[k]?.kind==='window').length;add({type:'boundaryCount',roomId:room.id,side,kind:'window',value:count,text:`${SIDES[side]}墙窗户 ×${count}`});}
      const connection=plan.connections.find(p=>p.a===room.id||p.b===room.id),near=level.rooms.find(r=>r.id===(connection.a===room.id?connection.b:connection.a));
      if(near)add({type:'adjacent',roomId:room.id,targetRoomId:near.id,text:`必须与${near.name}相邻`});
      if(complex){const far=level.rooms.find(r=>r.id!==room.id&&!sharedEdges(level,layout,room.id,r.id).length);if(far)add({type:'adjacent',roomId:room.id,targetRoomId:far.id,forbidden:true,text:`不能与${far.name}相邻`});}
    }
  }
  for(const openPair of openPairs)for(const[a,b]of [[openPair.a,openPair.b],[openPair.b,openPair.a]]){
    add({type:'fullOpen',roomId:a,targetRoomId:b,text:`与${names[b]}相邻部分完全开放，无隔墙`});
    add({type:'openLength',roomId:a,targetRoomId:b,value:openPair.edges.length,text:`与${names[b]}开放连接 ${openPair.edges.length}m`});
  }
  for(const connection of plan.connections)if(connection.kind==='door'){
    add({type:'connectionCount',roomId:connection.a,targetRoomId:connection.b,kind:'door',value:1,text:`通向${names[connection.b]}的室内门 ×1`});
  }
  for(const id of ['bedroom','master','guest','bath','kitchen','game','study','store','laundry','workshop','music','gym'])if(plan.roomIds.includes(id)&&!(basic&&id==='bedroom')){
    add({type:'boundaryCount',roomId:id,kind:'door',value:1,text:'室内门 ×1'});
    add({type:'boundaryCount',roomId:id,kind:'open',value:0,text:'不设开放连接'});
  }
  if(!basic){
    const candidates=[];
    for(const object of layout.objects){
      const source={kind:object.kind,roomId:layout.cells[cellKey(object.x,object.y)],...(object.tag?{tag:object.tag}:{})};
      const targets=[...layout.objects.filter(o=>o.id!==object.id&&layout.cells[cellKey(o.x,o.y)]!==source.roomId).map(o=>({kind:o.kind,roomId:layout.cells[cellKey(o.x,o.y)],...(o.tag?{tag:o.tag}:{})})),{kind:'window'},{kind:'window',roomId:source.roomId}];
      for(const target of targets)for(const direction of ['N','S','W','E']){
        const counts=directionCounts(level,layout,source,target,direction);
        const multiple=counts.length>1,mixed=new Set(counts).size>1;
        if(mixed&&(chapter||0)<40)continue;
        const quantifier=mixed?'any':'all';
        const label=target.roomId?`${names[target.roomId]}的${OBJECTS[target.kind]?.name||'窗户'}${target.tag?' '+target.tag:''}`:'窗户（不限房间）';
        for(const count of new Set(counts))candidates.push({type:'direction',group:source.roomId,source,target,direction,value:count,forbidden:count===0,...(multiple?{quantifier}:{}),text:`${multiple?(quantifier==='all'?'每个':'至少一个'):''}${instanceName(object)}${SIDES[direction]}侧${count===0?'不能有':'需有'}${label}${count?' ×'+count:''}`});
      }
    }
    const unique=items=>[...new Map(items.map(r=>[JSON.stringify([r.source,r.target,r.direction]),r])).values()];
    const prioritized=items=>unique([...newFurniture.flatMap(kind=>items.filter(r=>r.source.kind===kind).slice(0,4)),...items]);
    const positive=prioritized(shuffled(unique(candidates.filter(r=>!r.forbidden)),rand)).slice(0,expanded?48:complex?16:7);
    const negative=prioritized(shuffled(unique(candidates.filter(r=>r.forbidden)),rand)).slice(0,expanded?32:complex?8:3);
    for(const rule of [...positive,...negative])add(rule);
  }
  level.reference=layout;
  if(chapter>=38)level.mechanics=mechanicsAt(chapter);
  if(chapter!==undefined)level.progression={newFurniture,newMechanics:mechanicsIntroducedAt(chapter)};
  addInstanceRule(level,add);
  addSpatialRules(level,add,{chapter:chapter||0,deadline});
  if(expanded)selectClues(level,chapter||30,{deadline});
  delete level.useSpacePlan;
  const quality=generationQualityErrors(level);if(quality.length)throw new Error('生成质量未通过：'+quality.join('；'));
  if(expanded)level.planning.label=SHAPE_NAMES[plan.shapeFamily];
  level.brief=basic?'先规划房间，再安放门窗和家具。蓝色斜纹窗已固定；公共边可用开放连接打通。':'房间之间的需求彼此关联。先读完条件，再决定分区；同一份委托可以有多个合法布局。';
  return level;
}
export function generateLevel(seed='初次委托',mode='intro',options={}) {
  if(options.chapter!==undefined)unlockedFurnitureAt(options.chapter);
  if(!['intro','standard','complex'].includes(mode))throw new Error('未知任务类型');
  const level=makeLevel(String(seed).slice(0,80),mode,options),errors=validateLevel(level);
  if(errors.length)throw new Error(errors.join('；'));
  const check=evaluateLayout(level,level.reference);
  if(!check.complete)throw new Error('生成任务未通过验证：'+[...check.errors,...check.results.filter(r=>!r.ok).map(r=>r.text)].join('；'));
  return level;
}
export function hintRoom(level,layout,roomId){
  const next=clone(layout),reference=level.reference;
  if(!reference?.cells||!reference?.objects||!reference?.edges)return {error:'这份关卡没有参考布局，暂不提供补画求助'};
  const targets=Object.keys(reference.cells).filter(c=>reference.cells[c]===roomId);
  for(const cell of targets)if(next.cells[cell]&&next.cells[cell]!==roomId)return {error:'参考房间与现有分区冲突，请先擦除重叠区域'};
  for(const cell of Object.keys(next.cells))if(next.cells[cell]===roomId)delete next.cells[cell];
  for(const cell of targets)next.cells[cell]=roomId;
  next.objects=next.objects.filter(o=>objectRoom(layout,o)!==roomId);
  for(const o of reference.objects)if(reference.cells[cellKey(o.x,o.y)]===roomId)next.objects.push(clone(o));
  for(const key of roomEdges(level,reference,roomId)){
    if(reference.edges[key]){
      const info=edgeInfo(level,next,key),kind=reference.edges[key].kind;
      if(kind==='window'||info.outer||info.internal)next.edges[key]=clone(reference.edges[key]);
    }else if(!level.fixedEdges[key])delete next.edges[key];
  }
  // Remove replaced room furniture that no longer belongs to a valid room.
  return {layout:next};
}

export function createOpeningLevel(){
  const rooms=[{id:'bath',name:'卫生间',color:'#d5cce6'},{id:'hall',name:'走廊',color:'#e5e6b8'},{id:'bedroom',name:'卧室',color:'#e8c7c9'}];
  const level={id:'story:1',chapter:1,title:'第一份委托',seed:'第一份委托',mode:'intro',schemaVersion:1,rulesVersion:ENGINE_VERSION,generatorVersion:'opening-1',rooms,outline:[],fixedEdges:{'h:0:0':{kind:'window',fixed:true},'h:2:0':{kind:'window',fixed:true},'v:7:1':{kind:'window',fixed:true}},rules:[],brief:'先完成卫生间，再规划走廊和卧室。工具会随教学逐步加入铅笔列表。'};
  const reference={cells:{},edges:clone(level.fixedEdges),objects:[{id:'bedroom-bed',kind:'bed',x:4,y:1,rotation:0}]};
  for(let y=0;y<4;y++)for(let x=0;x<7;x++){const c=cellKey(x,y);level.outline.push(c);reference.cells[c]=x>=3?'bedroom':y<3?'bath':'hall';}
  for(const key of ['v:0:1','h:5:0','h:5:4'])reference.edges[key]={kind:'window'};
  reference.edges['v:0:3']={kind:'door'};reference.edges['h:1:3']={kind:'door'};reference.edges['v:3:3']={kind:'open'};
  const add=rule=>level.rules.push({id:'opening-'+(level.rules.length+1),op:'eq',...rule});
  for(const[kind,value,text]of [['entry',1,'全屋入户门 ×1'],['door',1,'全屋室内门 ×1'],['window',6,'全屋窗户 ×6'],['open',1,'全屋开放连接总长 1m']])add({type:'globalCount',group:'global',kind,value,text});
  add({type:'area',roomId:'bath',value:9,text:'面积 9㎡'});add({type:'boundaryCount',roomId:'bath',kind:'window',side:'N',value:2,text:'北墙窗户 ×2'});add({type:'boundaryCount',roomId:'bath',kind:'window',side:'W',value:1,text:'西墙窗户 ×1'});
  add({type:'area',roomId:'hall',value:3,text:'面积 3㎡'});add({type:'boundaryCount',roomId:'hall',kind:'entry',side:'W',value:1,text:'西墙入户门 ×1'});add({type:'adjacent',roomId:'hall',targetRoomId:'bath',text:'必须与卫生间相邻'});add({type:'fullOpen',roomId:'hall',targetRoomId:'bedroom',text:'与卧室相邻部分完全开放，无隔墙'});
  add({type:'area',roomId:'bedroom',value:16,text:'面积 16㎡'});add({type:'objectCount',roomId:'bedroom',kind:'bed',value:1,text:'双人床 ×1'});add({type:'boundaryCount',roomId:'bedroom',kind:'window',value:3,text:'窗户 ×3'});add({type:'fullOpen',roomId:'bedroom',targetRoomId:'hall',text:'与走廊相邻部分完全开放，无隔墙'});
  add({type:'reachable',group:'global',text:'所有房间直接或间接通向入户门',hidden:true});add({type:'coverage',group:'global',text:'完整规划建筑轮廓',hidden:true});
  level.reference=reference;
  if(!evaluateLayout(level,reference).complete)throw new Error('入门关卡参考解无效');
  return level;
}
export function paletteForLevel(level,tutorialStage=5){
  const roomIds=level.rooms.map(r=>r.id);
  const kinds=[...new Set(level.rules.filter(r=>r.type==='objectCount'&&r.value>0).map(r=>r.kind))];
  const boundaries=['door','window',...(level.rules.some(r=>(r.type==='globalCount'&&r.kind==='open'||r.type==='openLength')&&r.value>0)||level.rules.some(r=>r.type==='fullOpen')?['open']:[])];
  if(level.chapter===1)return {roomIds:roomIds.slice(0,Math.min(3,tutorialStage+1)),boundaries:tutorialStage>=3?boundaries:[],objectKinds:tutorialStage>=3?kinds:[]};
  return {roomIds,boundaries,objectKinds:kinds};
}
function campaignCandidate(chapter,variant=0,options={}){
  unlockedFurnitureAt(chapter);
  if(chapter===1)return createOpeningLevel();
  const mode=chapter===2?'intro':chapter<9?'standard':'complex',level=generateLevel('委托-'+chapter+(variant?'-'+variant:''),mode,{...options,chapter});
  if(chapter<4)level.rules=level.rules.filter(r=>r.type!=='direction');
  if(chapter>=46&&!level.rules.some(r=>r.source?.tag||r.target?.tag))throw new Error('指定家具缺少有效标记条件');
  if(chapter===40&&!level.rules.some(r=>r.type==='direction'&&r.quantifier==='any'))throw new Error('量词教学缺少有效的至少一个条件');
  level.id='story:'+chapter;level.chapter=chapter;level.title='第'+chapter+'份委托';level.seed=level.title;
  if(!evaluateLayout(level,level.reference).complete)throw new Error('委托参考解未通过验证');
  return level;
}

export function createCampaignLevel(chapter,options={}){
  const avoid=new Set(options.avoidFingerprints||[]),deadline=Date.now()+(options.budgetMs??1200);
  const recent=options.recentStructures||[];let reason,best,bestScore=Infinity;
  for(let variant=0;variant<6;variant++){
    if(Date.now()>deadline)break;
    try{
      let family=options.family;
      if(chapter>=12&&!family&&!SHAPE_INTRODUCTIONS[chapter]&&recent.length){
        const available=Object.keys(SHAPE_UNLOCKS).filter(id=>SHAPE_UNLOCKS[id]<=chapter);
        const fresh=available.filter(id=>!recent.slice(-2).some(item=>item.family===id));
        const pool=fresh.length?fresh:available;
        family=pool[Math.floor(randomFromSeed('variety:'+chapter+':'+variant)()*pool.length)];
      }
      const level=campaignCandidate(chapter,variant,{...options,family,deadline});
      level.generationFingerprint=levelFingerprint(level);
      if(avoid.has(level.generationFingerprint)){reason='近期已有相似委托';continue;}
      const structure=describeStructure(level),score=repetitionScore(structure,recent);
      level.generationStructure=structure;
      level.generation={source:'worker-generated',similarity:score};
      if(score<bestScore){best=level;bestScore=score;}
      if(score<.93||SHAPE_INTRODUCTIONS[chapter])return level;
    }catch(error){reason=error.message;}
  }
  if(best){best.generation.similarityLimited=true;return best;}
  throw new Error(reason||'生成超过预算');
}
