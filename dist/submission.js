import {evaluateLayout} from './engine.js';
import {RATING_VERSION,newAttempt,approveAttempt} from './rating.js';

export function submissionStatus(check,attempt,submissions=[]){
  const approved=!!attempt?.completed||submissions.some(item=>item.passed===true);
  return {approved,canSubmit:!approved&&check?.complete===true};
}

// Recheck at the action boundary, even if an old enabled button was clicked.
// Refused actions do not change scores, messages, history or playtest counters.
export function submitDesign(level,layout,{attempt=newAttempt(),submissions=[]}={}){
  const check=evaluateLayout(level,layout),status=submissionStatus(check,attempt,submissions);
  if(!status.canSubmit)return {accepted:false,...status,check};
  const approved=approveAttempt(attempt),visible=new Set(level.rules.filter(r=>!r.hidden).map(r=>r.id));
  return {accepted:true,check,attempt:approved.attempt,item:{
    version:submissions.length+1,passed:true,reason:'方案通过。',rating:approved.rating,scoringVersion:RATING_VERSION,
    complete:check.results.filter(r=>r.ok&&visible.has(r.id)).length,total:visible.size
  }};
}
