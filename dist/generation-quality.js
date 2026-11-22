import {footprint,edgeCells,boundaryKind,objectRoom,walkabilityErrors} from './engine.js';

export function generationQualityErrors(level){
  const layout=level.reference,errors=[];
  const areas=Object.fromEntries(level.rooms.map(r=>[r.id,Object.values(layout.cells).filter(id=>id===r.id).length]));
  const circulation=(areas.hall||0)+(areas.entry||0);
  if((areas.hall||0)/level.outline.length>.18||circulation/level.outline.length>.24)errors.push('交通空间占比过高');
  if(areas.bath<4||areas.bath>8)errors.push('卫生间面积须在4至8㎡之间');
  for(const id of ['bedroom','master'])if(areas[id]&&areas[id]<12)errors.push('双人卧室面积不足');
  if(areas.living&&areas.living<Math.max(areas.bedroom||0,areas.master||0,areas.guest||0))errors.push('公共起居空间小于卧室');
  if(level.mode!=='intro'&&new Set(Object.values(areas)).size<4)errors.push('房间面积缺少用途区分');
  const graph=new Map(level.rooms.map(r=>[r.id,new Set()]));
  for(const key of Object.keys(layout.edges))if(['door','open'].includes(boundaryKind(level,layout,key))){
    const ids=[...new Set(edgeCells(key).map(c=>layout.cells[c]).filter(Boolean))];
    if(ids.length===2){graph.get(ids[0]).add(ids[1]);graph.get(ids[1]).add(ids[0]);}
  }
  for(const id of ['bedroom','master','guest','bath','kitchen','game'])if(graph.has(id)&&graph.get(id).size!==1)errors.push(`${id}不应承担穿行交通`);
  if(graph.has('kitchen')&&!graph.get('kitchen').has('dining'))errors.push('厨房须直接连接餐厅');
  if(graph.has('bath')&&!graph.get('bath').has('hall'))errors.push('卫生间须直接连接走廊');
  if(layout.objects.some(o=>!objectRoom(layout,o)||footprint(o).length===0))errors.push('参考家具占地无效');
  errors.push(...walkabilityErrors(level,layout));
  return [...new Set(errors)];
}
