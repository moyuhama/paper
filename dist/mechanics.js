// New mechanics are introduced separately from new furniture and shape lessons.
export const MECHANIC_UNLOCKS={multiple:38,quantifiers:40,useSpace:42,distance:44};
export const MECHANIC_NAMES={multiple:'同类多件家具',quantifiers:'每个与至少一个',useSpace:'正面使用空间',distance:'家具边缘距离'};
export function mechanicsAt(chapter){return Object.keys(MECHANIC_UNLOCKS).filter(key=>chapter>=MECHANIC_UNLOCKS[key]);}
export function mechanicsIntroducedAt(chapter){return Object.keys(MECHANIC_UNLOCKS).filter(key=>chapter===MECHANIC_UNLOCKS[key]);}
export function addFurnitureInstances(furnitureByRoom,{chapter,rand}){
  if(chapter<MECHANIC_UNLOCKS.multiple)return furnitureByRoom;
  const result=Object.fromEntries(Object.entries(furnitureByRoom).map(([id,kinds])=>[id,[...kinds]]));
  const choices=[['living','sofa'],['study','desk'],['master','bedsideTable'],['guest','singleBed']].filter(([id,kind])=>result[id]?.includes(kind));
  // First lesson always introduces two sofas in the generous living area.
  const first=chapter===38?choices.find(([id])=>id==='living'):choices[Math.floor(rand()*choices.length)];
  if(first)result[first[0]].push(first[1]);
  if(chapter>=48&&rand()>.5){const next=choices.find(([id])=>id!==first?.[0]);if(next)result[next[0]].push(next[1]);}
  return result;
}
export function supportsMechanics(level,chapter){
  const required=mechanicsAt(chapter);
  if(required.includes('multiple')&&!level.rules.some(r=>r.type==='objectCount'&&r.value>1))return false;
  if(chapter===40&&!level.rules.some(r=>r.type==='direction'&&r.quantifier==='any'))return false;
  if(required.includes('useSpace')&&!level.rules.some(r=>r.type==='useSpace'))return false;
  if(required.includes('distance')&&!level.rules.some(r=>r.type==='distance'))return false;
  return true;
}
