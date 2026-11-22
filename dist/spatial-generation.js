import {OBJECTS,objectRoom,useSpaceResults,furnitureDistances,evaluateRule} from './engine.js';
import {poseProbes} from './clue-quality.js';
export function referenceUseSpaceOK(level,layout){
  return (level.chapter||0)<42||['sofa','sectional'].every(kind=>useSpaceResults(level,layout,{kind,roomId:'living'},1).every(item=>item.ok));
}
export function addSpatialRules(level,add,{chapter,deadline}){
  if(chapter>=42)for(const kind of ['sofa','sectional'].filter(kind=>level.reference.objects.some(o=>o.kind===kind)))add({type:'useSpace',source:{kind,roomId:'living'},group:'living',quantifier:'all',depth:1,text:kind==='sofa'?'每个双人沙发正面须留1m深的整排空地，且可从入户门走到':'每个L形沙发座位正面须留1m使用区（按虚线），且可从入户门走到'});
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
