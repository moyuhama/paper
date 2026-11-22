import {frontAnnotationSVG} from './rule-visuals.js';
import {roomArea} from './geometry.js';
import {bounds,point,allEdges,edgeParts,edgeInfo,boundaryKind,footprint} from './engine.js';
import {furnitureSVG,structureSVG,cellSVG,diagonalBoundarySVG} from './drawing-assets.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderPlan(level,layout=level.reference){
  const b=bounds(level.outline),pad=.65;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(level.title)}参考布局" viewBox="${b.x-pad} ${b.y-pad} ${b.w+pad*2} ${b.h+pad*2}"><rect x="${b.x-pad}" y="${b.y-pad}" width="${b.w+pad*2}" height="${b.h+pad*2}" fill="#f8f6e9"/>`;
  for(const cell of level.outline){const[x,y]=point(cell),room=level.rooms.find(r=>r.id===layout.cells[cell]);s+=cellSVG(level,cell,`fill="${room?.color||'#faf8ee'}" stroke="#727b6c" stroke-opacity=".17" stroke-width=".012"`);}
  for(const key of allEdges(level)){
    const info=edgeInfo(level,layout,key),kind=boundaryKind(level,layout,key);if(!info.boundary&&info.rooms[0]===info.rooms[1])continue;
    if(edgeParts(key).axis==='d'){s+=diagonalBoundarySVG(level,key,layout.edges[key]);continue;}
    const{axis,x,y}=edgeParts(key),line=(stroke,width)=>`<path d="M${x} ${y}${axis==='h'?'h1':'v1'}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`;
    if(kind==='open')continue;
    s+=line('#474d40',info.boundary?.09:.055);
    if(kind==='window')s+=line('#fffdf5',.12)+line('#6c999e',.035);
    if(kind==='door'||kind==='entry'){
      s+=line('#faf8ee',.12);
      s+=axis==='h'?`<path d="M${x} ${y}v-.75a.75 .75 0 0 1 .75 .75" fill="none" stroke="#777e67" stroke-width=".025"/>`:`<path d="M${x} ${y}h.75a.75 .75 0 0 1-.75 .75" fill="none" stroke="#777e67" stroke-width=".025"/>`;
      if(kind==='entry')s+=`<circle cx="${x}" cy="${y}" r=".08" fill="#526b50"/>`;
    }
  }
  s+=structureSVG(level);
  for(const object of layout.objects)s+=furnitureSVG(object.kind,object.x,object.y,object.rotation)+frontAnnotationSVG(level,layout,object);
  const occupied=new Set(layout.objects.flatMap(footprint));
  for(const room of level.rooms){
    const cells=Object.keys(layout.cells).filter(c=>layout.cells[c]===room.id);if(!cells.length)continue;const rb=bounds(cells),cx=rb.x+rb.w/2,cy=rb.y+rb.h/2;
    const free=cells.filter(c=>!occupied.has(c));
    const center=(free.length?free:cells).sort((a,b)=>{const[p,q]=point(a),[u,v]=point(b);return(p+.5-cx)**2+(q+.5-cy)**2-((u+.5-cx)**2+(v+.5-cy)**2);})[0];
    const[x,y]=point(center);
    s+=`<g fill="#474b3b" font-family="Kaiti SC,STKaiti,serif" text-anchor="middle" paint-order="stroke" stroke="#f8f6e9" stroke-width=".025"><text x="${x+.5}" y="${y+.4}" font-size=".27">${esc(room.name)}</text><text x="${x+.5}" y="${y+.75}" font-size=".23">${roomArea(level,layout,room.id)}㎡</text></g>`;
  }
  return s+'</svg>';
}
