import test from 'node:test';
import assert from 'node:assert/strict';
import {newAttempt,recordHint,recordFailure,calculateRating,approveAttempt,restoreAttempt,restoreSubmissionRatings} from '../dist/rating.js';

test('首次成功且没有求助或失败得到3星',()=>assert.equal(approveAttempt(newAttempt()).rating.stars,3));
test('截图回归：求助一次、首次提交成功应为2星',()=>{
  const helped=recordHint(newAttempt()).attempt,result=approveAttempt(helped);
  assert.equal(result.rating.stars,2);assert.equal(result.rating.hintPenalty,1);assert.equal(result.rating.failurePenalty,0);assert.match(result.rating.deductions[0].text,/求助1次/);
});
test('每次求助扣1星，使用3次后审核通过仍可为0星',()=>{
  let state=newAttempt();for(const stars of [2,1,0]){state=recordHint(state).attempt;assert.equal(calculateRating(state).stars,stars);}assert.equal(approveAttempt(state).attempt.completed,true);
});
test('求助前的失败每次扣1星，失败扣分最多2星',()=>{
  let state=newAttempt();for(const stars of [2,1,1]){state=recordFailure(state);assert.equal(calculateRating(state).stars,stars);}assert.equal(state.failedSubmissions,3);assert.equal(state.wrongPenalties,2);
});
test('使用求助后再失败，仅累计失败次数，不增加失败扣分',()=>{
  let state=recordHint(newAttempt()).attempt;state=recordFailure(recordFailure(state));assert.equal(state.failedSubmissions,2);assert.equal(state.wrongPenalties,0);assert.equal(calculateRating(state).stars,2);
});
test('失败扣分与求助扣分合计，最低0星',()=>{
  let state=recordFailure(recordFailure(newAttempt()));state=recordHint(state).attempt;assert.equal(calculateRating(state).stars,0);
  state=recordHint(state).attempt;assert.equal(calculateRating(state).stars,0);
});
test('已通过后不能继续求助或增加失败扣分',()=>{
  const done=approveAttempt(newAttempt()).attempt;assert.ok(recordHint(done).error);assert.deepEqual(recordFailure(done),done);
});
test('评分快照不随后续状态对象变化',()=>{
  const first=approveAttempt(recordHint(newAttempt()).attempt).rating;const modified={...newAttempt(),hintsUsed:3};calculateRating(modified);assert.equal(first.stars,2);
});
test('新格式存档恢复保留失败和求助的先后效果',()=>{
  let state=recordFailure(newAttempt());state=recordHint(state).attempt;state=recordFailure(state);const restored=restoreAttempt(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.wrongPenalties,1);assert.equal(restored.failedSubmissions,2);assert.equal(calculateRating(restored).stars,1);
});
test('修复旧版固定三星：零失败、剩余2次求助的最新成功记录改为2星',()=>{
  const submissions=[{version:1,passed:true}],state=restoreAttempt(null,{hintsRemaining:2,submissions}),fixed=restoreSubmissionRatings(submissions,state);
  assert.equal(fixed[0].rating.stars,2);assert.equal(fixed[0].rating.hintPenalty,1);assert.equal(submissions[0].rating,undefined);
});
test('旧存档同时有求助和失败、缺少先后记录时不猜星级',()=>{
  const state=restoreAttempt(null,{hintsRemaining:2,submissions:[{passed:false},{passed:true}]});assert.equal(calculateRating(state).stars,null);assert.equal(state.legacyOrderUnknown,true);
});
test('旧存档只有失败记录时可恢复扣分',()=>{
  const state=restoreAttempt(null,{hintsRemaining:3,submissions:[{passed:false},{passed:false},{passed:true}]});assert.equal(calculateRating(state).stars,1);
});
