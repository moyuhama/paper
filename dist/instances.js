import {clone,objectRoom,OBJECTS} from './engine.js';
export const instanceName=object=>OBJECTS[object.kind].name+(object.tag?' '+object.tag:'');
export function configureInstances(level,layout,chapter){
  if(chapter<46)return;
  const groups=new Map();
  for(const object of layout.objects){const roomId=objectRoom(layout,object),key=roomId+':'+object.kind;groups.set(key,[...(groups.get(key)||[]),object]);}
  const group=[...groups.values()].find(items=>items.length>1);if(!group)throw new Error('标记关卡需要两件同类家具');
  level.instanceSlots=group.map((object,i)=>{object.tag=String.fromCharCode(65+i);return {tag:object.tag,kind:object.kind,roomId:objectRoom(layout,object)};});
}
export function addInstanceRule(level,add){
  const slots=level.instanceSlots;if(!slots?.length)return;
  add({type:'instances',roomId:slots[0].roomId,kind:slots[0].kind,tags:slots.map(slot=>slot.tag),text:`${OBJECTS[slots[0].kind].name}分别标为 ${slots.map(slot=>slot.tag).join('、')}`});
}
export function availableTags(level,layout,kind){return (level.instanceSlots||[]).filter(slot=>slot.kind===kind&&!layout.objects.some(o=>o.tag===slot.tag));}
export function placementIdentity(level,layout,object,requested=null){
  if(requested==='')return {object};
  const slots=(level.instanceSlots||[]).filter(slot=>slot.kind===object.kind&&slot.roomId===objectRoom(layout,object));
  const tag=requested??slots.find(slot=>!layout.objects.some(o=>o.tag===slot.tag&&o.id!==object.id))?.tag;
  if(!tag)return {object};
  if(!slots.some(slot=>slot.tag===tag))return {error:'这个标记须用于指定房间内的对应家具'};
  if(layout.objects.some(o=>o.id!==object.id&&o.tag===tag))return {error:`标记 ${tag} 已使用，请选择其他标记`};
  return {object:{...object,tag}};
}
export function assignFurnitureTag(level,layout,id,tag){
  const object=layout.objects.find(o=>o.id===id);if(!object)return {error:'请先选中家具'};
  if(tag&&!(level.instanceSlots||[]).some(slot=>slot.tag===tag&&slot.kind===object.kind))return {error:'该标记不适用于这件家具'};
  const next=clone(layout),selected=next.objects.find(o=>o.id===id),owner=next.objects.find(o=>o.id!==id&&o.tag===tag);
  if(owner){if(selected.tag)owner.tag=selected.tag;else delete owner.tag;}
  if(tag)selected.tag=tag;else delete selected.tag;
  return {layout:next};
}
