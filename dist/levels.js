import {ENGINE_VERSION,OBJECTS,cellKey,point,allEdges,edgeInfo,edgeParts,sharedEdges,roomEdges,objectRoom,directionCounts,evaluateLayout,validateLevel,clone} from './engine.js';
export const GENERATOR_VERSION='0.1.2';
const ROLES={
  living:{name:'客厅',color:'#edc8c3',objects:['sofa','chair']},bedroom:{name:'卧室',color:'#ede5b2',objects:['bed']},
  bath:{name:'卫生间',color:'#c9c9e8',objects:['shower','toilet']},kitchen:{name:'厨房',color:'#bcdccd',objects:['stove','sink']},
  dining:{name:'餐厅',color:'#bdd9e7',objects:['table']},hall:{name:'走廊',color:'#d5d8c2',objects:[]},
  entry:{name:'玄关',color:'#cde0c0',objects:[]},master:{name:'主卧',color:'#e8dfad',objects:['bed']},
  guest:{name:'客卧',color:'#e8c9b1',objects:['singleBed','wardrobe']},game:{name:'游戏室',color:'#c6dfe1',objects:['chair']}
};
const SIDES={N:'北',S:'南',W:'西',E:'东'};
export function randomFromSeed(seed){let h=2166136261;for(const c of String(seed)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function shuffled(items,rand){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function makeLevel(seed,mode) {
  const rand=randomFromSeed(`${GENERATOR_VERSION}:${mode}:${seed}`),basic=mode==='intro',complex=mode==='complex';
  const roles=basic?['bath','hall','bedroom']:complex?['entry','living','master','guest','game','dining','kitchen','bath','hall']:['living','bedroom','kitchen','dining','bath','hall'];
  const ordered=basic?roles:shuffled(roles,rand),cols=3,rows=ordered.length/3;
  if(complex&&ordered[4]==='entry'){[ordered[0],ordered[4]]=[ordered[4],ordered[0]];}
  if(!basic){
    const living=ordered.indexOf('living'),hall=ordered.indexOf('hall');
    if(Math.abs(living%3-hall%3)+Math.abs(Math.floor(living/3)-Math.floor(hall/3))!==1){
      const adjacent=ordered.findIndex((role,i)=>role!=='entry'&&i!==living&&Math.abs(i%3-living%3)+Math.abs(Math.floor(i/3)-Math.floor(living/3))===1);
      [ordered[hall],ordered[adjacent]]=[ordered[adjacent],ordered[hall]];
    }
  }
  const widths=Array.from({length:cols},()=>3+Math.floor(rand()*3));
  const heights=Array.from({length:rows},()=>3+Math.floor(rand()*3));
  const level={id:`${mode}:${seed}`,title:basic?'第一份委托':complex?'复杂住宅委托':'住宅设计委托',seed:String(seed),mode,schemaVersion:1,rulesVersion:ENGINE_VERSION,generatorVersion:GENERATOR_VERSION,rooms:[],outline:[],fixedEdges:{},rules:[]};
  const layout={cells:{},edges:{},objects:[]};
  let y=0;
  for(let row=0;row<rows;row++){let x=0;for(let col=0;col<cols;col++){
    const role=ordered[row*cols+col],def=ROLES[role],room={id:role,...def};delete room.objects;level.rooms.push(room);
    for(let dy=0;dy<heights[row];dy++)for(let dx=0;dx<widths[col];dx++){const cell=cellKey(x+dx,y+dy);level.outline.push(cell);layout.cells[cell]=role;}
    for(let j=0;j<def.objects.length;j++){
      const kind=def.objects[j];let ox=x+1,oy=y+1;
      if(j===1){if(role==='living')oy=y+2;else ox=x+2;}
      layout.objects.push({id:`${role}-${kind}`,kind,x:ox,y:oy,rotation:0});
    }
    x+=widths[col];
  }y+=heights[row];}
  // A small cutout varies exterior geometry without touching reference furniture.
  if(!basic&&rand()>.35){const cell=cellKey(0,0);level.outline=level.outline.filter(c=>c!==cell);delete layout.cells[cell];}
  const names=Object.fromEntries(level.rooms.map(r=>[r.id,r.name]));
  const add=rule=>level.rules.push({id:`r${level.rules.length+1}`,op:'eq',...rule});
  const pairs=[];
  for(let a=0;a<level.rooms.length;a++)for(let b=a+1;b<level.rooms.length;b++){
    const ar=level.rooms[a].id,br=level.rooms[b].id,edges=sharedEdges(level,layout,ar,br);if(edges.length)pairs.push({a:ar,b:br,edges});
  }
  const compatible=[['hall','bedroom'],['living','hall'],['kitchen','dining'],['living','dining'],['entry','living']];
  const candidates=pairs.filter(pair=>compatible.some(([a,b])=>pair.a===a&&pair.b===b||pair.a===b&&pair.b===a));
  const openPair=candidates[Math.floor(rand()*candidates.length)];for(const key of openPair.edges)layout.edges[key]={kind:'open'};
  const parent=Object.fromEntries(level.rooms.map(r=>[r.id,r.id]));const find=x=>parent[x]===x?x:parent[x]=find(parent[x]);
  parent[find(openPair.a)]=find(openPair.b);
  for(const pair of shuffled(pairs.filter(p=>p!==openPair),rand))if(find(pair.a)!==find(pair.b)){
    parent[find(pair.a)]=find(pair.b);layout.edges[pair.edges[Math.floor(pair.edges.length/2)]]={kind:'door'};
  }
  const exterior=allEdges(level).filter(key=>edgeInfo(level,layout,key).outer);
  const entry=['entry','hall','living'].map(room=>exterior.find(key=>edgeInfo(level,layout,key).rooms.includes(room))).find(Boolean)||exterior[0];
  layout.edges[entry]={kind:'door'};
  for(const room of level.rooms){
    for(const side of ['N','S','W','E']){
      const edges=roomEdges(level,layout,room.id,side).filter(key=>edgeInfo(level,layout,key).outer&&key!==entry);
      if(edges.length){const center=Math.floor(edges.length/2);layout.edges[edges[center]]={kind:'window'};
        if(!basic&&edges.length>=4&&rand()>.4){const other=edges[Math.max(0,center-2)];layout.edges[other]={kind:'window'};}
      }
    }
  }
  const windows=Object.keys(layout.edges).filter(key=>layout.edges[key].kind==='window');
  for(const key of shuffled(windows,rand).slice(0,basic?2:3)){level.fixedEdges[key]={kind:'window',fixed:true};layout.edges[key].fixed=true;}
  for(const[kind,text]of [['entry','入户门'],['door','室内门'],['window','窗户'],['open','开放连接总长']]){
    const value=kind==='entry'?1:kind==='door'?level.rooms.length-2:Object.values(layout.edges).filter(e=>e.kind===kind).length;
    add({type:'globalCount',kind,value,text:`全屋${text} ${value}${kind==='open'?'m':'扇'}`,group:'global'});
  }
  add({type:'reachable',text:'所有房间直接或间接通向入户门',group:'global'});
  add({type:'coverage',text:'规划完整建筑轮廓',group:'global'});
  for(const room of level.rooms){
    const own=Object.keys(layout.cells).filter(c=>layout.cells[c]===room.id);
    add({type:'area',roomId:room.id,value:own.length,text:`面积 ${own.length}㎡`});
    for(const kind of ROLES[room.id].objects)add({type:'objectCount',roomId:room.id,kind,value:1,text:`${OBJECTS[kind].name} ×1`});
    const n=roomEdges(level,layout,room.id).filter(k=>layout.edges[k]?.kind==='window').length;
    add({type:'boundaryCount',roomId:room.id,kind:'window',value:n,text:n?`窗户 ×${n}`:'不能有窗户'});
    if(!basic){
      const side=shuffled(['N','S','W','E'],rand).find(s=>roomEdges(level,layout,room.id,s).some(k=>layout.edges[k]?.kind==='window'));
      if(side){const count=roomEdges(level,layout,room.id,side).filter(k=>layout.edges[k]?.kind==='window').length;add({type:'boundaryCount',roomId:room.id,side,kind:'window',value:count,text:`${SIDES[side]}墙窗户 ×${count}`});}
      const near=level.rooms.find(r=>r.id!==room.id&&sharedEdges(level,layout,room.id,r.id).length);
      if(near)add({type:'adjacent',roomId:room.id,targetRoomId:near.id,text:`必须与${near.name}相邻`});
      if(complex){const far=level.rooms.find(r=>r.id!==room.id&&!sharedEdges(level,layout,room.id,r.id).length);if(far)add({type:'adjacent',roomId:room.id,targetRoomId:far.id,forbidden:true,text:`不能与${far.name}相邻`});}
    }
  }
  for(const[a,b]of [[openPair.a,openPair.b],[openPair.b,openPair.a]]){
    add({type:'fullOpen',roomId:a,targetRoomId:b,text:`与${names[b]}相邻部分完全开放，无隔墙`});
    add({type:'openLength',roomId:a,targetRoomId:b,value:openPair.edges.length,text:`与${names[b]}开放连接 ${openPair.edges.length}m`});
  }
  if(!basic){
    const candidates=[];
    for(const object of layout.objects){
      const source={kind:object.kind,roomId:layout.cells[cellKey(object.x,object.y)]};
      const targets=[...layout.objects.filter(o=>o.id!==object.id&&layout.cells[cellKey(o.x,o.y)]!==source.roomId).map(o=>({kind:o.kind,roomId:layout.cells[cellKey(o.x,o.y)]})),{kind:'window'},{kind:'window',roomId:source.roomId}];
      for(const target of targets)for(const direction of ['N','S','W','E']){
        const count=directionCounts(level,layout,source,target,direction)[0];
        const label=target.roomId?`${names[target.roomId]}的${OBJECTS[target.kind]?.name||'窗户'}`:'窗户（不限房间）';
        candidates.push({type:'direction',group:source.roomId,source,target,direction,value:count,forbidden:count===0,text:`${OBJECTS[source.kind].name}${SIDES[direction]}侧${count===0?'不能有':'需有'}${label}${count?' ×'+count:''}`});
      }
    }
    const unique=items=>[...new Map(items.map(r=>[JSON.stringify([r.source,r.target,r.direction]),r])).values()];
    const positive=shuffled(unique(candidates.filter(r=>!r.forbidden)),rand).slice(0,complex?16:7);
    const negative=shuffled(unique(candidates.filter(r=>r.forbidden)),rand).slice(0,complex?8:3);
    for(const rule of [...positive,...negative])add(rule);
  }
  level.reference=layout;
  level.brief=basic?'先规划房间，再安放门窗和家具。蓝色斜纹窗已固定；公共边可用开放连接打通。':'房间之间的需求彼此关联。先读完条件，再决定分区；同一份委托可以有多个合法布局。';
  return level;
}
export function generateLevel(seed='初次委托',mode='intro') {
  if(!['intro','standard','complex'].includes(mode))throw new Error('未知任务类型');
  const level=makeLevel(String(seed).slice(0,80),mode),errors=validateLevel(level);
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
