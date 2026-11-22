// Add verified furniture here when extending the catalogue. Each entry needs
// engine geometry, a drawing, room placement, and a chapter that introduces it.
import {OBJECTS} from './catalog.js';
export const FURNITURE_PROGRESSION=Object.freeze(Object.entries(OBJECTS).map(([kind,def])=>Object.freeze({kind,chapter:def.chapter})).sort((a,b)=>a.chapter-b.chapter));

export function unlockedFurnitureAt(chapter){
  if(!Number.isSafeInteger(chapter)||chapter<1)throw new Error('委托编号须为正整数');
  return FURNITURE_PROGRESSION.filter(item=>item.chapter<=chapter).map(item=>item.kind);
}
export function furnitureIntroducedAt(chapter){
  return FURNITURE_PROGRESSION.filter(item=>item.chapter===chapter).map(item=>item.kind);
}
