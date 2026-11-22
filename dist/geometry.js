// Versioned cell polygons retain metre-grid drawing while representing real
// diagonal boundaries. Areas come from polygons, never from bounding boxes.
export function polygonArea(points){return Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;}
export function clipHalfPlane(points,a,b,c){
  const result=[];
  for(let i=0;i<points.length;i++){
    const p=points[i],q=points[(i+1)%points.length],dp=a*p[0]+b*p[1]-c,dq=a*q[0]+b*q[1]-c,inside=dp<=1e-9,next=dq<=1e-9;
    if(inside)result.push(p);
    if(inside!==next){const t=dp/(dp-dq);result.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
  }
  return result.filter((p,i)=>!i||Math.hypot(p[0]-result[i-1][0],p[1]-result[i-1][1])>1e-8);
}
export function cellPolygon(level,key){
  if(level.geometry?.cellPolygons?.[key])return level.geometry.cellPolygons[key];
  const[x,y]=key.split(',').map(Number);return [[x,y],[x+1,y],[x+1,y+1],[x,y+1]];
}
export function cellArea(level,key){return level.geometry?.cellPolygons?.[key]?polygonArea(level.geometry.cellPolygons[key]):1;}
export function roomArea(level,layout,id){return Math.round(Object.entries(layout.cells).filter(([,r])=>r===id).reduce((sum,[key])=>sum+cellArea(level,key),0)*1000)/1000;}
export function diagonalKey(a,b){return `d:${a[0]}:${a[1]}:${b[0]}:${b[1]}`;}
export function geometrySegments(polygons){
  const segments=[];
  for(const[cell,points]of Object.entries(polygons))for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    if(Math.abs(a[0]-b[0])>1e-8&&Math.abs(a[1]-b[1])>1e-8)segments.push({key:diagonalKey(a,b),cell,a,b});
  }
  return segments;
}
export function axisEdgePresent(level,cell,key){
  const poly=level.geometry?.cellPolygons?.[cell];if(!poly)return true;
  const[axis,sx,sy]=key.split(':'),x=Number(sx),y=Number(sy),a=[x,y],b=[x+(axis==='h'?1:0),y+(axis==='v'?1:0)];
  const on=p=>poly.some((u,i)=>{const v=poly[(i+1)%poly.length],cross=(p[0]-u[0])*(v[1]-u[1])-(p[1]-u[1])*(v[0]-u[0]);return Math.abs(cross)<1e-8&&p[0]>=Math.min(u[0],v[0])-1e-8&&p[0]<=Math.max(u[0],v[0])+1e-8&&p[1]>=Math.min(u[1],v[1])-1e-8&&p[1]<=Math.max(u[1],v[1])+1e-8;});
  return on(a)&&on(b);
}
export function validateGeometry(level){
  const g=level.geometry;if(!g)return level.schemaVersion===2?['缺少多边形几何']:[];
  const errors=[];
  if(level.schemaVersion!==2||g.version!==2||!g.cellPolygons||!Array.isArray(g.segments))return ['不支持的多边形几何版本'];
  for(const[cell,poly]of Object.entries(g.cellPolygons)){
    const[x,y]=cell.split(',').map(Number);
    if(!level.outline.includes(cell)||!Array.isArray(poly)||poly.length!==3||!poly.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isSafeInteger)&&p[0]>=x&&p[0]<=x+1&&p[1]>=y&&p[1]<=y+1)||Math.abs(polygonArea(poly)-.5)>1e-8)errors.push('斜边格须为有效半格三角形');
  }
  if(errors.length)return errors;
  const expected=geometrySegments(g.cellPolygons);
  if(JSON.stringify(expected)!==JSON.stringify(g.segments))errors.push('斜墙与多边形占地不一致');
  return errors;
}
