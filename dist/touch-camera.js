import {clampZoom,zoomedPan,draggedPan} from './camera.js';
export function touchSpan(points){const[a,b]=points;return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};}
export function beginTouchCamera(points,pan,zoom,viewportCenter){return {span:touchSpan(points),pan:{...pan},zoom,viewportCenter};}
export function updateTouchCamera(start,points){
  const span=touchSpan(points),zoom=clampZoom(start.zoom*span.distance/start.span.distance);
  const anchored=zoomedPan(start.pan,{x:start.span.x-start.viewportCenter.x,y:start.span.y-start.viewportCenter.y},start.zoom,zoom);
  return {pan:draggedPan(anchored,{x:span.x-start.span.x,y:span.y-start.span.y},zoom),zoom};
}
