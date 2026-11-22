import {cellKey,point,edgeKey,edgeParts} from './engine.js';

// Add new spatial families here without changing the player's tools or scoring.
// Dimensions vary inside each family; roles are never shuffled into arbitrary cells.
export function createResidentialPlan(mode,rand){
  const cells={},connections=[];
  const integer=(a,b)=>a+Math.floor(rand()*(b-a+1));
  const rect=(id,x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)cells[cellKey(i,j)]=id;};
  const link=(a,b,kind='door')=>connections.push({a,b,kind});
  let roomIds,entryRoomId,entryEdge,templateId;
  if(mode==='intro'){
    const w=integer(4,6),h=integer(3,4);
    rect('bedroom',0,0,w,h);rect('bath',w,0,2,h-1);rect('hall',w,h-1,2,1);
    roomIds=['bath','hall','bedroom'];link('bath','hall');link('hall','bedroom','open');
    entryRoomId='hall';entryEdge=edgeKey('h',w+1,h);templateId='compact-private';
  }else{
    const complex=mode==='complex';
    const bedroomWidth=complex?integer(4,5):integer(3,4),guestWidth=complex?integer(3,4):0;
    const privateWidth=bedroomWidth+guestWidth;
    const top=complex?integer(3,4):integer(4,6),height=top+(complex?3:2);
    const livingHeight=height-3,diningWidth=3;
    const largestBedroom=bedroomWidth*top;
    const kitchenWidth=Math.max(integer(2,4),Math.ceil(largestBedroom/livingHeight)-diningWidth);
    const publicX=privateWidth+1;
    if(complex){
      rect('master',0,0,bedroomWidth,top);rect('guest',bedroomWidth,0,guestWidth,top);
      rect('hall',0,top,privateWidth,1);
      rect('game',0,top+1,bedroomWidth,2);rect('bath',bedroomWidth,top+1,guestWidth,2);
      rect('entry',privateWidth,height,2,2);
      roomIds=['living','dining','kitchen','hall','entry','master','guest','bath','game'];
      for(const id of ['master','guest','game','bath','entry'])link(id,'hall');
      entryRoomId='entry';entryEdge=edgeKey('h',privateWidth+1,height+2);templateId='private-crosshall';
    }else{
      rect('bedroom',0,0,privateWidth,top);rect('bath',0,top,privateWidth,2);
      roomIds=['living','dining','kitchen','hall','bedroom','bath'];
      link('bedroom','hall');link('bath','hall');
      entryRoomId='hall';entryEdge=edgeKey('h',privateWidth,height);templateId='public-private-spine';
    }
    rect('hall',privateWidth,0,1,height);
    rect('living',publicX,0,diningWidth+kitchenWidth,livingHeight);
    rect('dining',publicX,livingHeight,diningWidth,3);
    rect('kitchen',publicX+diningWidth,livingHeight,kitchenWidth,3);
    link('hall','living','open');link('living','dining','open');link('dining','kitchen');
  }
  const turns=integer(0,3),mirror=rand()>.5;
  const vertex=(x,y)=>{if(mirror)x=-x;for(let i=0;i<turns;i++)[x,y]=[-y,x];return [x,y];};
  const cell=(x,y)=>{const corners=[vertex(x,y),vertex(x+1,y),vertex(x,y+1),vertex(x+1,y+1)];return [Math.min(...corners.map(c=>c[0])),Math.min(...corners.map(c=>c[1]))];};
  const transformed=Object.entries(cells).map(([key,id])=>{const [x,y]=point(key);return [...cell(x,y),id];});
  const dx=-Math.min(...transformed.map(c=>c[0])),dy=-Math.min(...transformed.map(c=>c[1]));
  const transformedCells=Object.fromEntries(transformed.map(([x,y,id])=>[cellKey(x+dx,y+dy),id]));
  const {axis,x,y}=edgeParts(entryEdge),a=vertex(x,y),b=vertex(x+(axis==='h'?1:0),y+(axis==='v'?1:0));
  entryEdge=edgeKey(a[1]===b[1]?'h':'v',Math.min(a[0],b[0])+dx,Math.min(a[1],b[1])+dy);
  return {cells:transformedCells,roomIds,connections,entryRoomId,entryEdge,templateId,orientation:{turns,mirror}};
}
