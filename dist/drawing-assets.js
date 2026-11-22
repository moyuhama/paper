import {OBJECTS} from './engine.js';
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
    bathtub:'<rect x=".08" y=".08" width=".84" height="1.84" rx=".4"/><rect x=".2" y=".24" width=".6" height="1.45" rx=".3"/>'
  };
  const rw=rotation%180?h:w;
  const tr=rotation===90?`translate(${h} 0) rotate(90)`:rotation===180?`translate(${w} ${h}) rotate(180)`:rotation===270?`translate(0 ${w}) rotate(270)`:'';
  return `<g transform="translate(${x} ${y}) scale(${scale})" class="furniture"><g transform="${tr}" fill="#fffdf3" stroke="#5a6058" stroke-width=".035" stroke-linejoin="round">${shapes[kind]||''}</g></g>`;
}
export function objectIcon(kind,angle=0){return `<svg viewBox="0 0 2.4 2.4" aria-hidden="true">${furnitureSVG(kind,.15,.15,angle,.95)}</svg>`;}
