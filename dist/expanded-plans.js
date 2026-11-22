import {OBJECTS} from './catalog.js';
import {clipHalfPlane,polygonArea,geometrySegments} from './geometry.js';
import {cellKey,point,edgeKey,edgeParts} from './engine.js';
import {SHAPE_NAMES,SHAPE_UNLOCKS,SHAPE_INTRODUCTIONS} from './shape-catalog.js';
export {SHAPE_NAMES} from './shape-catalog.js';
export function shapeForChapter(chapter,rand){
  if(SHAPE_INTRODUCTIONS[chapter])return SHAPE_INTRODUCTIONS[chapter];
  const choices=Object.keys(SHAPE_NAMES).filter(k=>SHAPE_UNLOCKS[k]<=chapter);
  return choices[Math.floor(rand()*choices.length)];
}
export function createExpandedPlan(rand,{chapter=30,family}={}){
  family=family||shapeForChapter(chapter,rand);if(!SHAPE_NAMES[family])throw new Error('未知户型结构');
  const integer=(a,b)=>a+Math.floor(rand()*(b-a+1));
  const cells={},fixedAreas={},fixedWalls=[],connections=[];
  const rect=(id,x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){const c=cellKey(i,j);if(cells[c])throw new Error('结构模块重叠');cells[c]=id;}};
  const link=(a,b,kind='door')=>connections.push({a,b,kind});
  const introducedKind=Object.keys(OBJECTS).find(kind=>OBJECTS[kind].chapter===chapter);
  const introducedRole={workbench:'workshop',cornerDesk:'study',piano:'music',treadmill:'gym',gameTable:'game'}[introducedKind];
  const laterRoles=['study','workshop','guest',...(chapter>=OBJECTS.piano.chapter?['music']:[]),...(chapter>=OBJECTS.treadmill.chapter?['gym']:[]),...(chapter>=OBJECTS.gameTable.chapter?['game']:[])];
  const topRole=introducedRole||(chapter>=30?laterRoles[integer(0,laterRoles.length-1)]:chapter>=20?'study':'guest');
  const bottomRole=chapter>=26?'laundry':'store';
  const masterWidth=integer(chapter>=OBJECTS.utilityCabinet.chapter?5:4,5),auxWidth=integer(3,4),privateWidth=masterWidth+auxWidth,top=4;
  const hallX=privateWidth,publicX=hallX+1,publicWidth=(family==='diagonal'?7:6)+integer(0,1),livingHeight=4+integer(0,1),height=livingHeight+3;
  rect('master',0,0,masterWidth,top);rect(topRole,masterWidth,0,auxWidth,top);
  rect('hall',0,top,privateWidth,1);rect('hall',hallX,0,1,height);
  const lowerHeight=height-top-1,bathWidth=lowerHeight===2?3:2;
  const partial=['l','u'].includes(family),bottomWidth=partial?privateWidth-2:privateWidth;
  const start=family==='l'?privateWidth-bottomWidth:0;
  rect('bath',start,top+1,bathWidth,lowerHeight);
  rect(bottomRole,start+bathWidth,top+1,bottomWidth-bathWidth,lowerHeight);
  rect('living',publicX,0,publicWidth,livingHeight);
  rect('dining',publicX,livingHeight,3,3);rect('kitchen',publicX+3,livingHeight,publicWidth-3,3);
  let entryY=height;
  if(family==='narrow'){rect('hall',hallX,height,1,3);entryY+=3;}
  rect('entry',hallX,entryY,3,2);
  if(family==='notched')for(let x=publicX+publicWidth-2;x<publicX+publicWidth;x++)delete cells[cellKey(x,0)];
  if(family==='balcony'){rect('balcony',publicX+publicWidth,1,2,2);link('living','balcony');}
  if(['column','shaft','courtyard'].includes(family)){
    const c=cellKey(publicX+2,Math.min(2,livingHeight-2));delete cells[c];fixedAreas[c]=family;
    if(family==='courtyard'){const next=cellKey(publicX+3,Math.min(2,livingHeight-2));delete cells[next];fixedAreas[next]='courtyard';}
  }
  let geometry;
  if(family==='diagonal'){
    const cellPolygons={};
    for(const cell of Object.keys(cells)){
      const[x,y]=point(cell),poly=clipHalfPlane([[x,y],[x+1,y],[x+1,y+1],[x,y+1]],1,-1,publicX+publicWidth-3),area=polygonArea(poly);
      if(area<1e-8)delete cells[cell];else if(area<1-1e-8)cellPolygons[cell]=poly;
    }
    geometry={version:2,cellPolygons,segments:geometrySegments(cellPolygons)};
  }
  if(family==='wall')for(let y=0;y<2;y++)fixedWalls.push(edgeKey('v',publicX+publicWidth-2,y));
  for(const id of ['master',topRole,'bath',bottomRole,'entry'])link(id,'hall');
  link('hall','living','open');link('living','dining','open');link('dining','kitchen');
  const roomIds=['living','dining','kitchen','hall','entry','master',topRole,'bath',bottomRole,...(family==='balcony'?['balcony']:[])];
  let entryEdge=edgeKey('h',hallX+1,entryY+2);
  if(family==='offset'){const shifted=Object.fromEntries(Object.entries(cells).map(([c,id])=>{const[x,y]=point(c);return [cellKey(x+(y>=top?3:0),y),id];}));for(const key of Object.keys(cells))delete cells[key];Object.assign(cells,shifted);entryEdge=edgeKey('h',hallX+4,entryY+2);}
  return transformPlan({cells,fixedAreas,fixedWalls,geometry,connections,roomIds,entryRoomId:'entry',entryEdge,templateId:'expanded-'+family,shapeFamily:family},rand);
}
export function transformPlan(plan,rand){
  const turns=Math.floor(rand()*4),mirror=rand()>.5;
  const vertex=(x,y)=>{if(mirror)x=-x;for(let i=0;i<turns;i++)[x,y]=[-y,x];return [x,y];};
  const cell=key=>{const[x,y]=point(key),corners=[vertex(x,y),vertex(x+1,y),vertex(x,y+1),vertex(x+1,y+1)];return [Math.min(...corners.map(p=>p[0])),Math.min(...corners.map(p=>p[1]))];};
  const entries=Object.entries(plan.cells).map(([key,id])=>[...cell(key),id]);
  const dx=-Math.min(...entries.map(p=>p[0])),dy=-Math.min(...entries.map(p=>p[1]));
  const convert=map=>Object.fromEntries(Object.entries(map||{}).map(([key,value])=>{const[x,y]=cell(key);return [cellKey(x+dx,y+dy),value];}));
  const edge=key=>{const{axis,x,y}=edgeParts(key),a=vertex(x,y),b=vertex(x+(axis==='h'?1:0),y+(axis==='v'?1:0));return edgeKey(a[1]===b[1]?'h':'v',Math.min(a[0],b[0])+dx,Math.min(a[1],b[1])+dy);};
  const polygons=Object.fromEntries(Object.entries(plan.geometry?.cellPolygons||{}).map(([key,poly])=>{const[x,y]=cell(key);return [cellKey(x+dx,y+dy),poly.map(p=>{const[a,b]=vertex(...p);return [a+dx,b+dy];})];}));
  return {...plan,geometry:plan.geometry?{version:2,cellPolygons:polygons,segments:geometrySegments(polygons)}:undefined,cells:convert(plan.cells),fixedAreas:convert(plan.fixedAreas),fixedWalls:(plan.fixedWalls||[]).map(edge),entryEdge:edge(plan.entryEdge),orientation:{turns,mirror}};
}
