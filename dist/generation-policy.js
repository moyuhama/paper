import {edgeParts,point,footprint} from './engine.js';
import {effectiveDirections} from './clue-quality.js';
export function difficultyFor(chapter){
  const tier=Math.max(0,Math.min(5,Math.floor((chapter-12)/6)));
  return {tier,directionBudget:4+tier*2,negativeBudget:Math.min(4,1+tier),maxVisibleRules:60,maxObjectKinds:12};
}
export function selectClues(level,chapter,{deadline=Infinity}={}){
  const budget=difficultyFor(chapter),rules=level.rules;
  const directional=rules.filter(r=>r.type==='direction');
  let sideCount=0;
  const pairs=new Set();
  level.rules=rules.filter(r=>{
    if(['fullOpen','openLength'].includes(r.type)&&!r.side){const key=r.type+':'+[r.roomId,r.targetRoomId].sort().join(':');if(pairs.has(key))return false;pairs.add(key);}
    if(r.type==='direction'||r.type==='adjacent')return false;
    if(r.type==='boundaryCount'){
      if(['door','open'].includes(r.kind))return false;
      if(r.side)return sideCount++<Math.min(3,budget.tier+1);
    }
    return true;
  });
  const {rules:directions,quality}=effectiveDirections(level,directional,budget,{deadline});
  level.clueQuality=quality;
  while(level.rules.length+directions.length>budget.maxVisibleRules){const index=level.rules.findLastIndex(r=>r.type==='boundaryCount'&&r.kind==='window');if(index<0)throw new Error('家具组合超出线索预算');level.rules.splice(index,1);}
  level.rules.push(...directions);
  level.difficulty=budget;
}
// Canonicalize geometry, furniture and clues under all global rotations/mirrors.
// Titles, chapter numbers and seeds intentionally do not affect this identity.
const stable=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export function levelFingerprint(level){
  const variants=[];
  for(const mirror of [false,true])for(let turns=0;turns<4;turns++){
    const vertex=([a,b])=>{let x=mirror?-a:a,y=b;for(let n=0;n<turns;n++)[x,y]=[-y,x];return [x,y];};
    const cell=key=>{const[x,y]=point(key),p=[vertex([x,y]),vertex([x+1,y]),vertex([x,y+1]),vertex([x+1,y+1])];return [Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1]))];};
    const raw=level.outline.map(cell),dx=-Math.min(...raw.map(p=>p[0])),dy=-Math.min(...raw.map(p=>p[1]));
    const ck=key=>{const[x,y]=cell(key);return `${x+dx},${y+dy}`;};
    const ek=key=>{const{axis,x,y,a,b}=edgeParts(key),ends=[vertex(a||[x,y]),vertex(b||[x+(axis==='h'?1:0),y+(axis==='v'?1:0)])].map(([a,b])=>`${a+dx},${b+dy}`).sort();return ends.join(';');};
    const direction=d=>{if(!d)return undefined;const[a,b]=vertex({N:[0,-1],S:[0,1],E:[1,0],W:[-1,0]}[d]);return a<0?'W':a>0?'E':b<0?'N':'S';};
    const rules=level.rules.map(r=>{const{id,text,group,...data}=r;return {...data,...(r.direction?{direction:direction(r.direction)}:{}),...(r.side?{side:direction(r.side)}:{})};}).map(stable).sort();
    variants.push(JSON.stringify({cells:Object.entries(level.reference.cells).map(([c,id])=>[ck(c),id]).sort(),objects:level.reference.objects.map(o=>[o.kind,footprint(o).map(ck).sort()]).sort(),edges:Object.entries(level.reference.edges).map(([key,e])=>[ek(key),e.kind,!!e.fixed]).sort(),geometry:Object.entries(level.geometry?.cellPolygons||{}).map(([c,poly])=>[ck(c),poly.map(p=>{const[x,y]=vertex(p);return [x+dx,y+dy];}).sort()]).sort(),fixed:Object.entries(level.fixedAreas||{}).map(([c,k])=>[ck(c),k]).sort(),walls:(level.fixedWalls||[]).map(ek).sort(),rules}));
  }
  const canonical=variants.sort()[0];let hash=14695981039346656037n;
  for(const c of canonical){hash^=BigInt(c.codePointAt(0));hash=BigInt.asUintN(64,hash*1099511628211n);}
  return hash.toString(16).padStart(16,'0');
}
