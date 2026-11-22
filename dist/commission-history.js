import {clone,validateLevel,validateLayoutShape} from './engine.js';
const runOf=item=>item.campaignId||'legacy';
export function archiveConversation(threads,{campaignId='legacy',level,submissions}){
  if(!level||!submissions.length)return threads;
  const item={campaignId,id:level.id,submissions:clone(submissions)};
  return [...threads.filter(t=>!(runOf(t)===campaignId&&t.id===level.id)),item].slice(-50);
}
// Old saves already contain accepted layouts, but not a full conversation archive.
// Restore the successful messages we actually have; never invent missing failures/stars.
export function completedCommissions(history,threads,{campaignId='legacy',currentLevelId}){
  const groups=new Map();
  for(const entry of history){
    if(runOf(entry)!==campaignId||entry.id===currentLevelId||!entry.level||!entry.layout)continue;
    if(validateLevel(entry.level).length||validateLayoutShape(entry.level,entry.layout).length)continue;
    if(!groups.has(entry.id))groups.set(entry.id,[]);groups.get(entry.id).push(entry);
  }
  return [...groups.values()].map(entries=>{
    entries.sort((a,b)=>(a.version||0)-(b.version||0));const latest=entries.at(-1);
    const thread=threads.find(t=>runOf(t)===campaignId&&t.id===latest.id);
    const total=latest.level.rules.filter(r=>!r.hidden).length;
    const submissions=thread?.submissions?.length?thread.submissions:entries.map(e=>({version:e.version,passed:true,rating:e.rating||null,complete:total,total}));
    return {...latest,submissions};
  }).sort((a,b)=>(a.level.chapter||0)-(b.level.chapter||0));
}
