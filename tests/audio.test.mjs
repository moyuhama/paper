import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameAudio} from '../dist/audio.js';
function fixture(settings){
  const elements=[],listeners=new Map(),contexts=[];
  const doc={hidden:false,body:{append(){}},createElement(tag){
    const events=new Map(),el={tag,dataset:{},paused:true,ended:false,muted:false,currentTime:0,playCalls:0,pauseCalls:0,
      append(){},addEventListener(name,fn){events.set(name,fn);},
      play(){this.playCalls++;this.paused=false;events.get('play')?.();return Promise.resolve();},pause(){this.pauseCalls++;this.paused=true;}};
    // Reproduce mobile media elements that ignore volume writes and always return 1.
    Object.defineProperty(el,'volume',{get:()=>1,set:()=>{}});elements.push(el);return el;
  },addEventListener(name,fn){listeners.set(name,fn);}};
  class FakeContext{
    constructor(){this.state='suspended';this.destination={};this.gains=[];this.sources=[];contexts.push(this);}
    createGain(){const g={gain:{value:1},connect(){}};this.gains.push(g);return g;}
    createMediaElementSource(el){this.sources.push(el);return {connect(){}};}
    resume(){this.state='running';return Promise.resolve();}
  }
  const controller=createGameAudio(settings,{document:doc,AudioContext:FakeContext});
  return {controller,doc,contexts,music:elements.find(e=>e.dataset.sound==='music'),effects:elements.filter(e=>e.dataset.sound==='click'),touch:()=>listeners.get('pointerdown')({isTrusted:true}),visibility:()=>listeners.get('visibilitychange')()};
}
test('回归：播放器忽略volume=0时，保存的零音量仍暂停并静音，后续触摸不重播',()=>{
  const f=fixture({musicVolume:.5,effectsVolume:.7});f.touch();assert.equal(f.music.paused,false);
  f.controller.update({musicVolume:0,effectsVolume:.7});const played=f.music.playCalls;
  assert.equal(f.music.volume,1);assert.equal(f.music.paused,true);assert.equal(f.music.muted,true);assert.equal(f.contexts[0].gains[0].gain.value,0);
  f.touch();f.doc.hidden=true;f.visibility();f.doc.hidden=false;f.visibility();
  assert.equal(f.music.playCalls,played);assert.equal(f.music.paused,true);assert.equal(f.music.muted,true);
});
test('刷新恢复零音量后第一次操作也不能播放音乐；其他音效仍独立工作',()=>{
  const f=fixture({musicVolume:0,effectsVolume:.7});f.touch();f.controller.play('click');
  assert.equal(f.music.playCalls,0);assert.equal(f.music.muted,true);assert.equal(f.effects[0].playCalls,1);
});
test('手机忽略播放器音量时，非零音量使用独立GainNode，切换设置不重复创建音频图',()=>{
  const f=fixture({musicVolume:.2,effectsVolume:.8});f.touch();assert.equal(f.contexts[0].gains[0].gain.value,.2);assert.equal(f.contexts[0].gains[1].gain.value,.8);
  f.controller.update({musicVolume:.6,effectsVolume:.3});f.touch();assert.equal(f.contexts.length,1);assert.equal(f.contexts[0].sources.length,15);assert.equal(f.contexts[0].gains[0].gain.value,.6);assert.equal(f.contexts[0].gains[1].gain.value,.3);
});
test('音效设零立即停止已播放的音效，保留音乐；重新开启音乐只在正音量时恢复',()=>{
  const f=fixture({musicVolume:.5,effectsVolume:.7});f.touch();f.controller.play('click');f.controller.update({musicVolume:.5,effectsVolume:0});
  const played=f.effects[0].playCalls;assert.equal(f.effects[0].paused,true);assert.equal(f.effects[0].muted,true);assert.equal(f.music.paused,false);f.controller.play('click');assert.equal(f.effects[0].playCalls,played);
  f.controller.update({musicVolume:0,effectsVolume:0});f.controller.update({musicVolume:.3,effectsVolume:0});assert.equal(f.music.paused,false);assert.equal(f.music.muted,false);
});
