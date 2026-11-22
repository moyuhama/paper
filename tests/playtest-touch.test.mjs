import test from 'node:test';
import assert from 'node:assert/strict';
import {createBoardGestures} from '../dist/board-gestures.js';
import {createPlaytestRecorder,summarizePlaytests,percentile} from '../dist/playtest-metrics.js';
const p={x:20,y:30};
test('双指缩放后先松一指，余指和第三指都不能提交；全部抬起才允许新笔画',()=>{
  const g=createBoardGestures();assert.equal(g.down(1,p),'single');assert.ok(g.canDraw(1));
  assert.equal(g.down(2,p),'camera');g.down(3,p);assert.equal(g.phase,'camera');assert.ok(!g.canDraw(1));
  g.up(2);assert.equal(g.phase,'blocked');g.move(1,{x:400,y:300});assert.ok(!g.canDraw(1));
  g.up(1);assert.ok(!g.canDraw(3));g.up(3);assert.equal(g.down(4,p),'single');assert.ok(g.canDraw(4));
});
test('旋屏/重画/丢失捕获的中断不能被剩余触点复活，取消一个触点仍等待另一个',()=>{
  for(const reason of ['orientation','redraw','capture','hidden']){
    const g=createBoardGestures();g.down(1,p);g.down(2,p);g.interrupt(reason);assert.equal(g.phase,'blocked');
    g.cancel(1);assert.ok(!g.canDraw(2));g.down(3,p);assert.equal(g.phase,'blocked');g.up(2);g.up(3);g.down(4,p);assert.ok(g.canDraw(4));
  }
});
test('控件上的触点不作为地图双指，陌生pointerup不结束当前笔画',()=>{
  const g=createBoardGestures();g.down(1,p);g.up(99);assert.ok(g.canDraw(1));assert.ok(!g.canDraw(99));
  assert.equal(g.down(2,p,false),'blocked');assert.ok(!g.canDraw(1));g.up(1);g.up(2);
  g.down(3,p,false);g.down(4,p);assert.ok(!g.canDraw(4));
});
function fixture(){let time=0,saved;const r=createPlaytestRecorder({now:()=>time,write:value=>saved=value});return {r,advance:ms=>time+=ms,saved:()=>saved};}
const info=(id=1,fromStart=true)=>({campaignId:'test',level:{id:'story:'+id,chapter:id,generatorVersion:'0.8.0'},fromStart});
test('有效用时排除后台、弹窗、离开页面和60秒后的闲置，恢复不累加离线时间',()=>{
  const {r,advance,saved}=fixture();r.begin(info());r.context(true);advance(10000);r.record('edit');advance(120000);r.flush();
  assert.equal(saved().sessions[0].activeMs,70000);
  r.context(false);advance(300000);r.context(true);advance(5000);r.record('complete');assert.equal(saved().sessions[0].activeMs,75000);
  advance(10000);r.record('edit');assert.equal(saved().sessions[0].edits,1);assert.equal(saved().sessions[0].activeMs,75000);
  let clock=10000000;const reload=createPlaytestRecorder({read:()=>saved(),now:()=>clock});reload.begin(info());reload.context(true);clock+=50000;assert.equal(reload.snapshot().sessions[0].activeMs,75000);
});
test('旧草稿仅作部分观察，失败求助与撤销独立记录，不改变星级或草稿',()=>{
  const {r,advance}=fixture();r.begin(info(40,false));r.context(true);advance(1000);for(const event of ['hint','failure','undo','redo','interruption'])r.record(event);r.record('complete');
  r.begin(info(41));r.context(true);advance(6000);r.record('complete');
  const data=r.snapshot(),s=summarizePlaytests(data);assert.equal(s.observed,2);assert.equal(s.complete,1);assert.equal(s.partial,1);assert.equal(s.groups[0].medianMs,6000);
  assert.deepEqual(['hints','failures','undos','redos','interruptions'].map(k=>data.sessions[0][k]),[1,1,1,1,1]);
});
test('评测存储受限不阻塞游戏；记录有上限且P95正确，无样本不伪造零耗时',()=>{
  const r=createPlaytestRecorder({read:()=>{throw Error('blocked');},write:()=>{throw Error('full');}});
  for(let n=0;n<210;n++)r.begin(info(n));for(let n=0;n<110;n++)r.generation({chapter:10,source:n%2?'worker-generated':'verified-fallback',totalMs:n});
  const d=r.snapshot();assert.equal(d.sessions.length,200);assert.equal(d.generations.length,100);assert.equal(summarizePlaytests(d).fallbacks,50);
  assert.equal(percentile([]),null);assert.equal(percentile(Array.from({length:100},(_,i)=>i+1)),95);
});
