import {fallbackVariationRank} from './variation-seed.js';
import {point,bounds} from './engine.js';
import {levelFingerprint} from './generation-policy.js';

// Ignore furniture, clues, seed and global orientation when comparing plans.
export function describeStructure(level){
  const cells=Object.entries(level.reference.cells),total=cells.length,b=bounds(level.outline);
  const rooms=[...new Set(cells.map(([,id])=>id))].sort().map(id=>{
    const own=cells.filter(([,room])=>room===id).map(([key])=>point(key));
    return {id,area:own.length/total,x:own.reduce((n,p)=>n+p[0],0)/own.length,y:own.reduce((n,p)=>n+p[1],0)/own.length};
  });
  const adjacent=new Set();
  for(const[key,id]of cells){const[x,y]=point(key);for(const next of [`${x+1},${y}`,`${x},${y+1}`]){const other=level.reference.cells[next];if(other&&other!==id)adjacent.add([id,other].sort().join(':'));}}
  const relationships=rooms.flatMap((a,i)=>rooms.slice(i+1).map(b=>[[a.id,b.id].join(':'),(Math.abs(a.x-b.x)+Math.abs(a.y-b.y))/Math.sqrt(total),adjacent.has([a.id,b.id].join(':'))]));
  const shapeFingerprint=levelFingerprint({...level,rules:[],reference:{cells:level.reference.cells,objects:[],edges:{}}});
  return {version:1,family:level.planning?.shapeFamily||'legacy',shapeFingerprint,aspect:Math.min(b.w,b.h)/Math.max(b.w,b.h),rooms:rooms.map(r=>[r.id,r.area]),relationships};
}
export function structuralSimilarity(a,b){
  if(!a||!b||a.version!==1||b.version!==1)return 0;
  if(a.shapeFingerprint===b.shapeFingerprint)return 1;
  if(a.family!==b.family)return 0;
  const areas=new Map(b.rooms),pairs=new Map(b.relationships.map(([key,distance,adjacent])=>[key,{distance,adjacent}]));
  if(a.rooms.length!==b.rooms.length||a.rooms.some(([id])=>!areas.has(id)))return .5;
  const areaError=a.rooms.reduce((n,[id,value])=>n+Math.abs(value-areas.get(id)),0);
  const pairError=a.relationships.reduce((n,[key,distance,adjacent])=>{const other=pairs.get(key);return n+(other?Math.abs(distance-other.distance)+(adjacent!==other.adjacent ? .5 : 0):1);},0)/Math.max(1,a.relationships.length);
  return Math.max(0,1-areaError*.5-pairError*.8-Math.abs(a.aspect-b.aspect)*.3);
}
export function repetitionScore(structure,recent=[]){
  return Math.max(0,...recent.slice(-5).map(previous=>structuralSimilarity(structure,previous)));
}
export function rankFallbackEntries(entries,recent=[],{variationKey='',chapter=0}={}){
  const last=recent.slice(-2).map(item=>item.family);
  return entries.map((entry,index)=>({entry,index,rank:fallbackVariationRank(variationKey,chapter,entry.fingerprint),penalty:last.includes(entry.family)?1:0})).sort((a,b)=>a.penalty-b.penalty||(a.rank<b.rank?-1:a.rank>b.rank?1:0)||a.index-b.index).map(item=>item.entry);
}
