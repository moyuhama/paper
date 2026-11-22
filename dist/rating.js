// Verified against the installed original demo's scoring methods and localization.
// Layout validity and the rating of an attempt are deliberately separate.
export const RATING_VERSION='demo-0.1.9-v1';
const bounded=(value,max=Number.MAX_SAFE_INTEGER)=>Math.max(0,Math.min(max,Number.isFinite(value)?Math.trunc(value):0));
export function newAttempt(){return {version:RATING_VERSION,hintsUsed:0,failedSubmissions:0,wrongPenalties:0,completed:false,legacyOrderUnknown:false};}
export function recordHint(attempt){
  if(attempt.completed||attempt.hintsUsed>=3)return {attempt,error:attempt.completed?'本次委托已经审核通过':'求助次数已用完'};
  return {attempt:{...attempt,hintsUsed:attempt.hintsUsed+1}};
}
export function recordFailure(attempt){
  if(attempt.completed)return attempt;
  return {...attempt,failedSubmissions:attempt.failedSubmissions+1,wrongPenalties:attempt.wrongPenalties===null?null:attempt.hintsUsed===0?Math.min(2,attempt.wrongPenalties+1):attempt.wrongPenalties};
}
export function calculateRating(attempt){
  const hintPenalty=bounded(attempt.hintsUsed,3),failurePenalty=attempt.wrongPenalties===null?null:bounded(attempt.wrongPenalties,2);
  const deductions=[];
  if(failurePenalty)deductions.push({kind:'failed-submission',amount:failurePenalty,text:`求助前提交未通过：扣${failurePenalty}星`});
  if(hintPenalty)deductions.push({kind:'hint',amount:hintPenalty,text:`求助${hintPenalty}次：扣${hintPenalty}星`});
  return {version:RATING_VERSION,stars:failurePenalty===null?null:Math.max(0,3-hintPenalty-failurePenalty),maxStars:3,hintsUsed:hintPenalty,failedSubmissions:bounded(attempt.failedSubmissions),hintPenalty,failurePenalty,deductions,legacyOrderUnknown:failurePenalty===null};
}
export function approveAttempt(attempt){const completed={...attempt,completed:true};return {attempt:completed,rating:calculateRating(completed)};}
export function restoreAttempt(saved,{hintsRemaining=3,submissions=[]}={}){
  if(saved?.version===RATING_VERSION)return {
    version:RATING_VERSION,hintsUsed:bounded(saved.hintsUsed,3),failedSubmissions:bounded(saved.failedSubmissions),
    wrongPenalties:saved.wrongPenalties===null?null:bounded(saved.wrongPenalties,2),completed:!!saved.completed,legacyOrderUnknown:saved.wrongPenalties===null
  };
  const firstPass=submissions.findIndex(s=>s.passed),beforePass=firstPass<0?submissions:submissions.slice(0,firstPass);
  const hintsUsed=3-bounded(hintsRemaining,3),failedSubmissions=beforePass.filter(s=>!s.passed).length;
  // Old saves recorded neither hint timestamps nor per-submission deductions.
  // A mixture of hints and failures cannot establish which happened first.
  const wrongPenalties=failedSubmissions&&hintsUsed?null:Math.min(2,failedSubmissions);
  return {version:RATING_VERSION,hintsUsed,failedSubmissions,wrongPenalties,completed:firstPass>=0,legacyOrderUnknown:wrongPenalties===null};
}
export function restoreSubmissionRatings(submissions,attempt){
  const lastPass=submissions.findLastIndex(s=>s.passed);
  return submissions.map((s,index)=>{
    if(!s.passed||s.rating?.version===RATING_VERSION)return s;
    return {...s,rating:index===lastPass?calculateRating(attempt):null};
  });
}
