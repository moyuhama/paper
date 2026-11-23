import test from 'node:test';
import assert from 'node:assert/strict';
import {submissionStatus,submitDesign} from '../dist/submission.js';
import {createOpeningLevel} from '../dist/levels.js';
import {initialLayout,clone} from '../dist/engine.js';
import {newAttempt,recordHint,recordFailure} from '../dist/rating.js';
const level=createOpeningLevel();
test('空白、未满足条件和非法图纸均不能提交，不消耗星级或追加记录',()=>{
  const invalid=clone(level.reference);invalid.objects.push({...invalid.objects[0],id:'overlap'});
  for(const layout of [initialLayout(level),{...clone(level.reference),objects:[]},invalid]){
    const attempt=newAttempt(),submissions=[],before=JSON.stringify({attempt,submissions,layout});
    assert.equal(submitDesign(level,layout,{attempt,submissions}).accepted,false);
    assert.equal(JSON.stringify({attempt,submissions,layout}),before);
  }
});
test('完整方案只接收一次，连续重复提交不生成新版本、不重新评分',()=>{
  const submissions=[],first=submitDesign(level,level.reference,{attempt:newAttempt(),submissions});assert.ok(first.accepted);assert.equal(first.item.rating.stars,3);submissions.push(first.item);
  for(let i=0;i<10;i++)assert.equal(submitDesign(level,level.reference,{attempt:first.attempt,submissions}).accepted,false);
  assert.equal(submissions.length,1);assert.equal(submissions[0].version,1);assert.equal(submissions[0].rating.stars,3);
});
test('已通过后修改或撤销图纸仍不能重复提交，领取新委托不依赖改动中的图纸',()=>{
  const done=submitDesign(level,level.reference),submissions=[done.item];
  assert.deepEqual(submissionStatus({complete:false},done.attempt,submissions),{approved:true,canSubmit:false});
  assert.equal(submitDesign(level,initialLayout(level),{attempt:done.attempt,submissions}).accepted,false);
  assert.equal(submissionStatus({complete:true},newAttempt(),[]).canSubmit,true);
});
test('旧存档成功记录即使不是最后一条，也不能重复提交或卡住领取',()=>{
  const submissions=[{version:1,passed:true,rating:{stars:2}},{version:2,passed:false}],attempt=newAttempt();
  assert.deepEqual(submissionStatus({complete:true},attempt,submissions),{approved:true,canSubmit:false});
  assert.equal(submitDesign(level,level.reference,{attempt,submissions}).accepted,false);assert.equal(submissions.length,2);
});
test('历史失败和求助扣分保留，只有新委托重新开放提交',()=>{
  const attempt=recordHint(recordFailure(newAttempt())).attempt,submissions=[{version:1,passed:false}];
  const result=submitDesign(level,level.reference,{attempt,submissions});assert.ok(result.accepted);assert.equal(result.item.version,2);assert.equal(result.item.rating.stars,1);
  assert.equal(result.item.rating.hintsUsed,1);assert.equal(result.item.rating.failedSubmissions,1);
  assert.equal(submissionStatus({complete:false},newAttempt(),[]).canSubmit,false);
});
