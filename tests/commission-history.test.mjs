import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveConversation,completedCommissions} from '../dist/commission-history.js';
import {createOpeningLevel} from '../dist/levels.js';
const first=createOpeningLevel();
const entry=(version=1)=>({id:first.id,version,title:first.title,level:first,layout:first.reference,rating:{stars:2,deductions:[]}});
test('旧存档已有通关快照恢复为往期委托，保留版本和星级，不伪造失败记录',()=>{
  const old=completedCommissions([entry(1),entry(2)],[],{currentLevelId:'story:5'});
  assert.equal(old.length,1);assert.equal(old[0].version,2);assert.equal(old[0].submissions.length,2);assert.equal(old[0].submissions[0].rating.stars,2);
});
test('新聊天归档保留失败及成功的顺序，切下一份不改原提交数组',()=>{
  const submissions=[{version:1,passed:false,reason:'缺门'},{version:2,passed:true,rating:{stars:1}}];
  const threads=archiveConversation([],{level:first,submissions});submissions[0].reason='changed';
  const previous=completedCommissions([entry(2)],threads,{currentLevelId:'story:2'});
  assert.equal(previous[0].submissions[0].reason,'缺门');assert.deepEqual(previous[0].submissions.map(s=>s.passed),[false,true]);
});
test('当前委托不重复显示为往期，新开游戏不会混入上一次游戏的记录',()=>{
  assert.deepEqual(completedCommissions([entry()],[],{currentLevelId:first.id}),[]);
  assert.deepEqual(completedCommissions([entry()],[],{campaignId:'new-run',currentLevelId:'story:2'}),[]);
  assert.equal(completedCommissions([{...entry(),campaignId:'new-run'}],[],{campaignId:'new-run',currentLevelId:'story:2'}).length,1);
});
test('缺失旧星级不冒充三星，损坏快照跳过，重复归档替换原记录',()=>{
  const previous=completedCommissions([{...entry(),rating:null},{id:'broken',level:{},layout:{}}],[],{currentLevelId:'story:2'});
  assert.equal(previous.length,1);assert.equal(previous[0].submissions[0].rating,null);
  const firstArchive=archiveConversation([],{level:first,submissions:[{version:1}]});
  const secondArchive=archiveConversation(firstArchive,{level:first,submissions:[{version:1},{version:2}]});
  assert.equal(secondArchive.length,1);assert.equal(secondArchive[0].submissions.length,2);
});
