import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameEntry} from '../dist/game-entry.js';
function fixture({reduced=false,autoplay=true,broken=false}={}){
  const doc=new EventTarget(),view=new EventTarget(),motion=new EventTarget(),attributes=new Map(),classes=new Set(),animations=[];
  doc.defaultView=view;doc.hidden=false;motion.matches=reduced;view.matchMedia=()=>motion;view.getComputedStyle=()=>({transform:'none'});
  const root={ownerDocument:doc,inert:false,dataset:{},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},getAttribute:k=>attributes.get(k)??null,setAttribute:(k,v)=>attributes.set(k,v),removeAttribute:k=>attributes.delete(k),querySelector:()=>({animate(){
    if(broken)throw Error('unsupported');
    let resolve,reject;const animation={finished:new Promise((a,b)=>{resolve=a;reject=b;}),finish:()=>resolve(),cancel:()=>reject(Error('cancelled'))};animations.push(animation);if(autoplay)queueMicrotask(resolve);return animation;
  }})};
  return {root,doc,view,motion,animations,entry:createGameEntry(root)};
}
test('入场期间只接受一次开始操作，完成后解除输入锁且可再次进入',async()=>{
  const {root,entry}=fixture();let started=0;
  const pending=entry.run(()=>started++);assert.ok(entry.busy);assert.ok(root.inert);assert.equal(root.getAttribute('aria-busy'),'true');
  assert.equal(await entry.run(()=>started++),false);assert.equal(await pending,true);assert.equal(started,1);assert.equal(entry.busy,false);assert.equal(root.inert,false);assert.equal(root.getAttribute('aria-busy'),null);assert.equal(root.dataset.entryPhase,undefined);
  await entry.run(()=>started++);assert.equal(started,2);
});
test('减少动态效果和动画API失败都能直接进入，不遗留遮挡或输入锁',async()=>{
  for(const options of [{reduced:true},{broken:true}]){const {entry,root,animations}=fixture(options);let calls=0;assert.equal(await entry.run(()=>calls++),true);assert.equal(calls,1);assert.equal(entry.busy,false);assert.equal(root.inert,false);assert.equal(animations.length,0);}
});
test('旋屏/尺寸变化、后台和动态效果偏好变化都结束动画，开始动作仍只执行一次',async()=>{
  for(const event of ['resize','hidden','motion']){
    const {entry,root,view,doc,motion}=fixture({autoplay:false});let calls=0;const pending=entry.run(()=>calls++);
    if(event==='resize')view.dispatchEvent(new Event('resize'));
    if(event==='hidden'){doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));}
    if(event==='motion'){const changed=new Event('change');changed.matches=true;motion.dispatchEvent(changed);}
    assert.equal(await pending,true);assert.equal(calls,1);assert.equal(root.inert,false);assert.equal(entry.busy,false);
  }
});
test('进入回调异常仍恢复原ARIA和inert状态，不留下永久锁',async()=>{
  const {entry,root}=fixture();root.inert=true;root.setAttribute('aria-busy','false');
  await assert.rejects(entry.run(()=>{throw Error('start failed');}),/start failed/);assert.equal(entry.busy,false);assert.equal(root.inert,true);assert.equal(root.getAttribute('aria-busy'),'false');
});
test('动画finished不返回也有等待上限，最终解锁并且不重复开始',async()=>{
  const {entry,root}=fixture({autoplay:false});let calls=0;await entry.run(()=>calls++);assert.equal(calls,1);assert.equal(entry.busy,false);assert.equal(root.inert,false);
});
