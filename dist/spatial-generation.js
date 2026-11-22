import {OBJECTS,objectRoom,useSpaceResults,furnitureDistances,evaluateRule} from './engine.js';
import {poseProbes} from './clue-quality.js';
export function createUseSpacePlan(furnitureByRoom,chapter,rand){
  if(chapter<42)return [];
  const plans=['sofa','sectional'].filter(kind=>furnitureByRoom.living?.includes(kind)).map(kind=>({kind,roomId:'living',depth:1}));
  const extras=Object.entries(furnitureByRoom).flatMap(([roomId,kinds])=>[...new Set(kinds)].filter(kind=>OBJECTS[kind].pack==='second'&&OBJECTS[kind].front&&!plans.some(plan=>plan.kind===kind&&plan.roomId===roomId)).map(kind=>({kind,roomId,depth:1,rank:OBJECTS[kind].chapter===chapter?-1:rand()}))).sort((a,b)=>a.rank-b.rank);
  return [...plans,...extras.map(({rank,...plan})=>plan)];
}
export function referenceUseSpaceOK(level,layout){
  const plans=level.useSpacePlan||level.rules.filter(r=>r.type==='useSpace').map(r=>({...r.source,depth:r.depth}));
  return plans.every(({depth,...selector})=>useSpaceResults(level,layout,selector,depth).every(item=>item.ok));
}
export function addSpatialRules(level,add,{chapter,deadline}){
  for(const {depth,...source}of level.useSpacePlan||[])add({type:'useSpace',source,group:source.roomId,quantifier:'all',depth,text:source.kind==='sofa'?'每个双人沙发正面须留1m深的整排空地，且可从入户门走到':`每个${OBJECTS[source.kind].name}按虚线留出1m使用区，且可从入户门走到`});
  if(chapter<44)return;
  const probes=poseProbes(level,{deadline}),groups=[...new Map(level.reference.objects.map(o=>{const roomId=objectRoom(level.reference,o);return [roomId+':'+o.kind,{roomId,kind:o.kind}];})).values()];
  let best,bestScore=0;
  for(const source of groups)for(const target of groups){
    if(source.roomId!==target.roomId)continue;
    const distances=furnitureDistances(level.reference,source,target);
    if(!distances.some(n=>n!==null&&n<=1))continue;
    const quantifier=distances.every(n=>n!==null&&n<=1)?'all':'any';
    const prefix=distances.length>1?(quantifier==='all'?'每个':'至少一个'):'';
    const rule={type:'distance',source,target,group:source.roomId,op:'lte',value:1,quantifier,text:`${prefix}${OBJECTS[source.kind].name}与${source.kind===target.kind?'最近的另一个':'最近的'}${OBJECTS[target.kind].name}的边缘距离不超过1m（直线最短距离）`};
    const score=probes.filter(layout=>!evaluateRule(level,layout,rule).ok).length;
    if(score>bestScore){bestScore=score;best=rule;}
  }
  if(!best)throw new Error('缺少有实际作用的家具距离条件');
  add(best);
}
