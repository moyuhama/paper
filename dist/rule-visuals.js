import {selectedObjects,objectRoom,footprint,bounds,frontDirection,frontCells,useSpaceResults,objectDistanceSquared} from './engine.js';
const rect=(cell,color)=>{const[x,y]=cell.split(',').map(Number);return `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}" fill-opacity=".22" stroke="${color}" stroke-width=".045" stroke-dasharray=".12 .06"/>`;};
export function useRuleForObject(level,layout,object){return level.rules.find(r=>r.type==='useSpace'&&r.source.kind===object.kind&&(!r.source.objectId||r.source.objectId===object.id)&&(!r.source.roomId||r.source.roomId===objectRoom(layout,object)));}
export function frontAnnotationSVG(level,layout,object){
  if(!useRuleForObject(level,layout,object))return '';
  const b=bounds(footprint(object)),direction=frontDirection(object),[dx,dy]={N:[0,-1],S:[0,1],W:[-1,0],E:[1,0]}[direction];
  const x=b.x+b.w/2+dx*(b.w/2-.2),y=b.y+b.h/2+dy*(b.h/2-.2),sx=x-dx*.18,sy=y-dy*.18;
  return `<g class="furniture-front" pointer-events="none"><title>箭头朝向家具正面</title><path d="M${sx} ${sy}L${x} ${y}m${-dx*.09-dy*.07} ${-dy*.09+dx*.07}L${x} ${y}l${-dx*.09+dy*.07} ${-dy*.09-dx*.07}" fill="none" stroke="#257c67" stroke-width=".055" stroke-linecap="round"/></g>`;
}
export function usagePreviewSVG(level,layout,object){
  const rule=useRuleForObject(level,layout,object);if(!rule)return '';
  const next={...layout,objects:[...layout.objects.filter(o=>o.id!==object.id),object]},check=useSpaceResults(level,next,{kind:object.kind,objectId:object.id},rule.depth)[0];
  return `<g pointer-events="none">${frontCells(object,rule.depth).map(c=>rect(c,check?.ok?'#318b75':'#b95b50')).join('')}${frontAnnotationSVG(level,next,object)}</g>`;
}
export function spatialRuleSVG(level,layout,rule){
  if(!rule)return '';
  if(rule.type==='useSpace')return `<g class="use-space-overlay" pointer-events="none">${useSpaceResults(level,layout,rule.source,rule.depth).flatMap(item=>item.cells.map(c=>rect(c,item.ok?'#318b75':'#b95b50'))).join('')}</g>`;
  if(rule.type!=='distance')return '';
  const targets=selectedObjects(layout,rule.target),clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  return `<g class="distance-overlay" pointer-events="none">${selectedObjects(layout,rule.source).map(source=>{
    const target=targets.filter(o=>o.id!==source.id).sort((a,b)=>objectDistanceSquared(source,a)-objectDistanceSquared(source,b))[0];if(!target)return '';
    const a=bounds(footprint(source)),b=bounds(footprint(target)),ax=clamp(b.x+b.w/2,a.x,a.x+a.w),ay=clamp(b.y+b.h/2,a.y,a.y+a.h),bx=clamp(ax,b.x,b.x+b.w),by=clamp(ay,b.y,b.y+b.h),distance=Math.round(Math.sqrt(objectDistanceSquared(source,target))*100)/100;
    return `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="none" stroke="#348879" stroke-width=".045"/><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="#348879" stroke-width=".045"/><path d="M${ax} ${ay}L${bx} ${by}" stroke="#348879" stroke-width=".05" stroke-dasharray=".12 .06"/><circle cx="${ax}" cy="${ay}" r=".055" fill="#348879"/><circle cx="${bx}" cy="${by}" r=".055" fill="#348879"/><text x="${(ax+bx)/2}" y="${(ay+by)/2-.14}" text-anchor="middle" font-size=".24" fill="#256356" paint-order="stroke" stroke="#fffdf2" stroke-width=".055">${distance}m</text>`;
  }).join('')}</g>`;
}
export function ruleExplanation(rule,layout){
  if(layout&&['useSpace','distance'].includes(rule.type)&&!selectedObjects(layout,rule.source).length)return '先放置条件涉及的家具，再点此处查看使用区或距离连线。';
  if(rule.type==='useSpace')return '箭头指向正面。彩色区域须整排留空、在同一房间内，并可从入户门走到。';
  if(rule.type==='distance')return '连线显示到最近目标家具边缘的直线距离，贴边为0m；“每个”和“至少一个”分别判定。';
  return '红色条带从每件来源家具延伸；目标任一格进入范围即计入，按条件中的量词判定。';
}
