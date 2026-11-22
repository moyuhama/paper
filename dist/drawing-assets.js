import {cellPolygon} from './geometry.js';
import {OBJECTS,edgeParts} from './engine.js';
export function furnitureSVG(kind,x,y,rotation=0,scale=1){
  const def=OBJECTS[kind],w=def.w,h=def.h;
  const shapes={
    bed:`<rect x=".08" y=".08" width="1.84" height="1.84" rx=".08"/><path d="M.08 .7h1.84M1 .12v.52"/><rect x=".2" y=".18" width=".65" height=".36" rx=".04"/><rect x="1.15" y=".18" width=".65" height=".36" rx=".04"/>`,
    singleBed:'<rect x=".08" y=".08" width=".84" height="1.84" rx=".07"/><path d="M.08 .65h.84"/><rect x=".2" y=".2" width=".6" height=".3" rx=".04"/>',
    sofa:'<rect x=".05" y=".1" width="1.9" height=".8" rx=".12"/><path d="M.3 .2v.62M1.7 .2v.62M.3 .34h1.4M1 .34v.5"/>',
    chair:'<rect x=".08" y=".08" width=".84" height=".84" rx=".12"/><path d="M.26 .2v.6M.74 .2v.6M.26 .3h.48"/>',
    table:'<rect x=".4" y=".3" width="1.2" height="1.4" rx=".08"/><path d="M.08 .55h.25v.35H.08zM.08 1.1h.25v.35H.08zM1.67 .55h.25v.35h-.25zM1.67 1.1h.25v.35h-.25zM.75 .05h.5v.2h-.5zM.75 1.75h.5v.2h-.5z"/>',
    stove:'<rect x=".1" y=".1" width=".8" height=".8" rx=".06"/><circle cx=".32" cy=".32" r=".12"/><circle cx=".68" cy=".32" r=".12"/><circle cx=".32" cy=".68" r=".12"/><circle cx=".68" cy=".68" r=".12"/>',
    sink:'<rect x=".08" y=".08" width=".84" height=".84" rx=".06"/><rect x=".22" y=".3" width=".56" height=".48" rx=".09"/><path d="M.5 .15v.26"/>',
    toilet:'<rect x=".23" y=".08" width=".54" height=".25" rx=".04"/><ellipse cx=".5" cy=".59" rx=".29" ry=".29"/><ellipse cx=".5" cy=".58" rx=".18" ry=".17"/>',
    shower:'<rect x=".08" y=".08" width=".84" height=".84" rx=".04"/><path d="M.15 .82.82 .15M.16 .18h.25v.13"/><circle cx=".7" cy=".7" r=".04"/>',
    wardrobe:'<rect x=".08" y=".08" width=".84" height="1.84"/><path d="M.08 1h.84M.4 .86h.2M.4 1.14h.2"/>',
    fridge:'<rect x=".12" y=".08" width=".76" height=".84" rx=".04"/><path d="M.12 .4h.76M.25 .18v.12M.25 .52v.23"/>',
    coffeeTable:'<rect x=".08" y=".15" width="1.84" height=".7" rx=".13"/><path d="M.22 .28h1.56v.44H.22z"/>',
    tvStand:'<rect x=".08" y=".1" width="1.84" height=".8"/><path d="M.72 .1v.8M1.3 .1v.8"/><rect x=".35" y=".2" width="1.3" height=".38" fill="#c8cfc6"/><path d="M1 .58v.15M.72 .74h.56"/>',
    bedsideTable:'<rect x=".12" y=".12" width=".76" height=".76" rx=".05"/><path d="M.12 .55h.76M.4 .7h.2"/><circle cx=".5" cy=".34" r=".13"/>',
    desk:'<rect x=".06" y=".1" width="1.88" height=".75"/><path d="M.55 .1v.75M.16 .3h.25M.16 .58h.25"/><rect x=".95" y=".25" width=".65" height=".3"/><path d="M1.12 .66h.34"/>',
    bookcase:'<rect x=".1" y=".05" width=".8" height="1.9"/><path d="M.1 .55h.8M.1 1.05h.8M.1 1.55h.8M.25 .15v.3M.43 .15v.3M.65 .15l.1 .3M.28 .68v.25M.5 .65v.3M.7 1.18v.25M.3 1.7h.4"/>',
    basin:'<rect x=".1" y=".1" width=".8" height=".8" rx=".14"/><ellipse cx=".5" cy=".55" rx=".27" ry=".22"/><path d="M.5 .13v.22"/><circle cx=".5" cy=".57" r=".035"/>',
    washer:'<rect x=".08" y=".08" width=".84" height=".84" rx=".06"/><path d="M.08 .28h.84"/><circle cx=".5" cy=".59" r=".25"/><circle cx=".5" cy=".59" r=".17"/><circle cx=".72" cy=".18" r=".035"/>',
    shoeCabinet:'<rect x=".1" y=".08" width=".8" height="1.84"/><path d="M.1 .7h.8M.1 1.3h.8M.4 .6h.2M.4 1.2h.2M.4 1.8h.2"/>',
    workbench:'<rect x=".05" y=".1" width="2.9" height=".8"/><path d="M.2 .3h.5v.4H.2zM2.3 .3h.5v.4h-.5zM1 .25h1M1.5 .25v.45M1.25 .7h.5"/>',
    bathtub:'<rect x=".08" y=".08" width=".84" height="1.84" rx=".4"/><rect x=".2" y=".24" width=".6" height="1.45" rx=".3"/>'
  };
  const rw=rotation%180?h:w;
  const tr=rotation===90?`translate(${h} 0) rotate(90)`:rotation===180?`translate(${w} ${h}) rotate(180)`:rotation===270?`translate(0 ${w}) rotate(270)`:'';
  return `<g transform="translate(${x} ${y}) scale(${scale})" class="furniture"><g transform="${tr}" fill="#fffdf3" stroke="#5a6058" stroke-width=".035" stroke-linejoin="round">${shapes[kind]||''}</g></g>`;
}
export function objectIcon(kind,angle=0){return `<svg viewBox="0 0 ${Math.max(2.4,OBJECTS[kind].w+.3,OBJECTS[kind].h+.3)} ${Math.max(2.4,OBJECTS[kind].w+.3,OBJECTS[kind].h+.3)}" aria-hidden="true">${furnitureSVG(kind,.15,.15,angle,.95)}</svg>`;}

export function structureSVG(level){
  const marks={column:'柱',shaft:'井',courtyard:'院'};
  let svg='';
  for(const[cell,kind]of Object.entries(level.fixedAreas||{})){
    const[x,y]=cell.split(',').map(Number);
    svg+=`<g data-fixed-area="${kind}"><rect x="${x}" y="${y}" width="1" height="1" fill="${kind==='courtyard'?'#d6e5cc':'#bdbbac'}" stroke="#676c5c" stroke-width=".04"/><path d="M${x+.1} ${y+.1}l.8 .8m-.8 0 .8-.8" stroke="#8b8b7c" stroke-width=".02"/><text x="${x+.5}" y="${y+.62}" text-anchor="middle" font-size=".25" fill="#59614d">${marks[kind]}</text></g>`;
  }
  for(const key of level.fixedWalls||[]){const[axis,x,y]=key.split(':');svg+=`<path d="${edgePath(key)}" stroke="#4d5146" stroke-width=".12"/><path d="${edgePath(key)}" stroke="#9c9d8e" stroke-width=".025" stroke-dasharray=".05 .06"/>`;}
  return svg;
}

export function cellSVG(level,key,attributes=''){
  const poly=cellPolygon(level,key);
  return `<path d="M${poly.map(p=>p.join(' ')).join('L')}Z" ${attributes}/>`;
}
export function edgePath(key){const{axis,x,y,a,b}=edgeParts(key);return axis==='d'?`M${a.join(' ')}L${b.join(' ')}`:`M${x} ${y}${axis==='h'?'h1':'v1'}`;}
export function diagonalBoundarySVG(level,key,item){
  const{x,y,a,b}=edgeParts(key),dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length;
  const line=(stroke,width)=>`<path d="${edgePath(key)}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`;
  let svg=line('#474d40',.105);
  if(item?.kind==='window'){
    svg+=line('#fffdf5',.12)+line('#6c999e',.035);
    for(const offset of [-.045,.045])svg+=`<path d="M${a[0]+nx*offset} ${a[1]+ny*offset}L${b[0]+nx*offset} ${b[1]+ny*offset}" stroke="#6c999e" stroke-width=".018"/>`;
    if(item.fixed){const cx=(a[0]+b[0])/2,cy=(a[1]+b[1])/2;svg+=`<path d="M${cx-nx*.12-dx*.05} ${cy-ny*.12-dy*.05}l${nx*.24+dx*.1} ${ny*.24+dy*.1}" stroke="#5c898d" stroke-width=".035"/>`;}
  }
  if(item?.kind==='door'){
    const segment=level.geometry.segments.find(s=>s.key===key),poly=cellPolygon(level,segment.cell),cx=poly.reduce((s,p)=>s+p[0],0)/poly.length,cy=poly.reduce((s,p)=>s+p[1],0)/poly.length,sign=(cx-(a[0]+b[0])/2)*nx+(cy-(a[1]+b[1])/2)*ny>=0?1:-1;
    svg+=line('#faf8ee',.13)+`<path d="M${x} ${y}l${nx*.75*sign} ${ny*.75*sign}" stroke="#777e67" stroke-width=".03"/>`;
  }
  return svg;
}
