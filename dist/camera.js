// Camera units are metres. One grid cell always remains one square metre.
export const GRID_PIXELS=44;
export const clampZoom=value=>Math.max(.4,Math.min(3,value));
export function cameraBox(viewport,center,pan,zoom){
  const w=viewport.width/(GRID_PIXELS*zoom),h=viewport.height/(GRID_PIXELS*zoom);
  return {x:center.x-pan.x-w/2,y:center.y-pan.y-h/2,w,h};
}
export function draggedPan(start,delta,zoom){return {x:start.x+delta.x/(GRID_PIXELS*zoom),y:start.y+delta.y/(GRID_PIXELS*zoom)};}
export function zoomedPan(pan,offset,oldZoom,newZoom){
  return {x:pan.x+offset.x/GRID_PIXELS*(1/newZoom-1/oldZoom),y:pan.y+offset.y/GRID_PIXELS*(1/newZoom-1/oldZoom)};
}
