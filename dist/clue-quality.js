import {footprint,objectRoom,point,placeObject,walkabilityErrors,evaluateRule} from './engine.js';

// A bounded check of alternative furniture poses, not an exhaustive solver.
// Every probe preserves room assignments, furniture counts, openings and access.
export function poseProbes(level,{perObject=4,deadline=Infinity}={}){
  const probes=[],layout=level.reference;
  for(const object of layout.objects){
    const room=objectRoom(layout,object),seen=new Set([footprint(object).sort().join(';')]);
    const candidates=[];
    for(const cell of Object.keys(layout.cells).filter(c=>layout.cells[c]===room)){
      const[x,y]=point(cell);
      for(const rotation of [0,90]){
        const candidate={...object,x,y,rotation},key=footprint(candidate).sort().join(';');
        if(seen.has(key))continue;seen.add(key);
        const moved=placeObject(level,layout,candidate);
        if(moved.layout)candidates.push({candidate,layout:moved.layout});
      }
    }
    const chosen=[object];let accepted=0,attempts=0;
    while(candidates.length&&accepted<perObject&&attempts++<20){
      if(Date.now()>deadline)throw new Error('线索验证超过预算');
      candidates.sort((a,b)=>distance(b.candidate)-distance(a.candidate));
      const item=candidates.shift();
      if(walkabilityErrors(level,item.layout).length)continue;
      probes.push(item.layout);chosen.push(item.candidate);accepted++;
    }
    function distance(p){return Math.min(...chosen.map(c=>Math.abs(p.x-c.x)+Math.abs(p.y-c.y)+(footprint(p).length>1&&p.rotation!==c.rotation ? .5 : 0)));}
  }
  return probes;
}

export function effectiveDirections(level,candidates,budget,{deadline=Infinity}={}){
  const probes=poseProbes(level,{deadline}),introduced=new Set(level.progression?.newFurniture||[]);
  const pool=candidates.map(rule=>({rule,failures:new Set(probes.flatMap((layout,i)=>evaluateRule(level,layout,rule).ok?[]:[i]))})).filter(item=>item.failures.size);
  const selected=[],covered=new Set(),sources=new Set();let positive=0,negative=0;
  while(selected.length<budget.directionBudget+budget.negativeBudget){
    let best,score=0;
    for(const item of pool){
      if(selected.includes(item)||(item.rule.forbidden?negative>=budget.negativeBudget:positive>=budget.directionBudget))continue;
      const gain=[...item.failures].filter(i=>!covered.has(i)).length;
      const rank=gain+(gain?(!sources.has(item.rule.source.kind)?1:0)+(introduced.has(item.rule.source.kind)?2:0):0);
      if(rank>score){score=rank;best=item;}
    }
    if(!best)break;
    selected.push(best);sources.add(best.rule.source.kind);best.rule.forbidden?negative++:positive++;
    for(const i of best.failures)covered.add(i);
  }
  // A later clue can subsume an earlier one. Keep a private witness for each.
  for(let i=selected.length-1;i>=0;i--){
    const others=new Set(selected.filter((_,j)=>i!==j).flatMap(item=>[...item.failures]));
    if([...selected[i].failures].every(n=>others.has(n)))selected.splice(i,1);
  }
  return {rules:selected.map(item=>item.rule),quality:{method:'local-pose-probes-v1',testedAlternatives:probes.length,excludedAlternatives:covered.size,effectiveDirections:selected.length,witnesses:selected.map(item=>({ruleId:item.rule.id,exclusive: [...item.failures].filter(n=>!selected.some(other=>other!==item&&other.failures.has(n))).length}))}};
}
