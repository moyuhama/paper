// Add verified furniture here when extending the catalogue. Each entry needs
// engine geometry, a drawing, room placement, and a chapter that introduces it.
export const FURNITURE_PROGRESSION = Object.freeze([
  ['bed',1],['sofa',3],['chair',4],['toilet',5],['stove',6],
  ['sink',7],['shower',8],['singleBed',9],['wardrobe',9],
  ['table',10],['bathtub',11]
].map(([kind,chapter])=>Object.freeze({kind,chapter})));

export function unlockedFurnitureAt(chapter){
  if(!Number.isSafeInteger(chapter)||chapter<1)throw new Error('委托编号须为正整数');
  return FURNITURE_PROGRESSION.filter(item=>item.chapter<=chapter).map(item=>item.kind);
}
export function furnitureIntroducedAt(chapter){
  return FURNITURE_PROGRESSION.filter(item=>item.chapter===chapter).map(item=>item.kind);
}
