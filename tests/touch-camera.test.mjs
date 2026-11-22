import test from 'node:test';
import assert from 'node:assert/strict';
import {GRID_PIXELS} from '../dist/camera.js';
import {beginTouchCamera,updateTouchCamera} from '../dist/touch-camera.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const points=(a,b)=>[{x:a[0],y:a[1]},{x:b[0],y:b[1]}];
test('双指等距移动只平移，屏幕位移与手指一致',()=>{
  const start=beginTouchCamera(points([100,100],[200,100]),{x:2,y:3},1,{x:400,y:200});
  const next=updateTouchCamera(start,points([140,130],[240,130]));
  assert.equal(next.zoom,1);near((next.pan.x-2)*GRID_PIXELS,40);near((next.pan.y-3)*GRID_PIXELS,30);
});
test('离开屏幕中心捏合，原双指中点对应的世界位置仍落在手指中点',()=>{
  const start=beginTouchCamera(points([150,90],[250,90]),{x:-2,y:1},.8,{x:422,y:195});
  const next=updateTouchCamera(start,points([120,110],[320,110]));
  assert.equal(next.zoom,1.6);
  near(-start.pan.x+(200-422)/(GRID_PIXELS*.8),-next.pan.x+(220-422)/(GRID_PIXELS*1.6));
  near(-start.pan.y+(90-195)/(GRID_PIXELS*.8),-next.pan.y+(110-195)/(GRID_PIXELS*1.6));
});
test('双指重合不会产生NaN，放大与缩小受相机范围约束',()=>{
  const start=beginTouchCamera(points([0,0],[1,0]),{x:0,y:0},1,{x:0,y:0});
  assert.equal(updateTouchCamera(start,points([0,0],[1000,0])).zoom,3);
  const wide=beginTouchCamera(points([0,0],[1000,0]),{x:0,y:0},1,{x:0,y:0});
  const next=updateTouchCamera(wide,points([1,1],[1,1]));assert.equal(next.zoom,.4);assert.ok(Number.isFinite(next.pan.x)&&Number.isFinite(next.pan.y));
});
