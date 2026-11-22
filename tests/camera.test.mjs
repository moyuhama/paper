import test from 'node:test';
import assert from 'node:assert/strict';
import {GRID_PIXELS,cameraBox,draggedPan,zoomedPan,clampZoom} from '../dist/camera.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('米制网格独立于户型大小，969像素显示22格而非自动撑大户型',()=>{
  for(const center of [{x:3.5,y:2},{x:15,y:12}]){const v=cameraBox({width:969,height:638},center,{x:0,y:0},1);near(969/v.w,GRID_PIXELS);near(638/v.h,GRID_PIXELS);assert.ok(v.w>22);}
});
test('拖动的屏幕距离与图纸位移一致，不受缩放或帧数影响',()=>{
  for(const zoom of [.4,1,1.7,3]){const p=draggedPan({x:2,y:-1},{x:120,y:-80},zoom);near((p.x-2)*GRID_PIXELS*zoom,120);near((p.y+1)*GRID_PIXELS*zoom,-80);const back=draggedPan(p,{x:-120,y:80},zoom);near(back.x,2);near(back.y,-1);}
});
test('鼠标处缩放保持指向的世界坐标，放大缩小后恢复原平移',()=>{
  const start={x:2,y:3},offset={x:230,y:-120},next=zoomedPan(start,offset,1,1.7);
  near(-start.x+offset.x/GRID_PIXELS,-next.x+offset.x/(GRID_PIXELS*1.7));
  near(-start.y+offset.y/GRID_PIXELS,-next.y+offset.y/(GRID_PIXELS*1.7));
  const back=zoomedPan(next,offset,1.7,1);near(back.x,start.x);near(back.y,start.y);
});
test('缩放限制保留可操作范围',()=>{assert.equal(clampZoom(.1),.4);assert.equal(clampZoom(5),3);assert.equal(clampZoom(1.7),1.7);});
