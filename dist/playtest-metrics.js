export const PLAYTEST_STORE='paper-studio:playtest:v1';
const IDLE_MS=60000,MAX_SESSIONS=200,MAX_GENERATIONS=100;
const copy=value=>JSON.parse(JSON.stringify(value));
const count=value=>Number.isFinite(value)?Math.max(0,value):0;
export function percentile(values,p=.95){const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);return sorted.length?sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]:null;}
// Local, aggregate observations only: no layout, pointer coordinates or upload.
// Time is counted only in an active game, up to 60s after the last interaction.
export function createPlaytestRecorder({now=()=>performance.now(),read=()=>null,write=()=>{}}={}){
  let data;try{data=read();}catch{}
  data=data?.version===1&&Array.isArray(data.sessions)&&Array.isArray(data.generations)?copy(data):{version:1,sessions:[],generations:[]};
  data.sessions=data.sessions.slice(-MAX_SESSIONS);data.generations=data.generations.slice(-MAX_GENERATIONS);
  let current=null,active=false,last=now(),lastInput=last;
  function tick(){const time=now();if(current&&!current.completed&&active)current.activeMs=count(current.activeMs)+Math.max(0,Math.min(time,lastInput+IDLE_MS)-last);last=time;}
  function save(){try{write(copy(data));}catch{/* Storage must never interrupt play. */}}
  return {
    begin({campaignId,level,fromStart=false,completed=false}){
      tick();const key=campaignId+':'+level.id;
      current=data.sessions.find(s=>s.key===key);
      if(!current){current={key,chapter:level.chapter||1,fingerprint:level.generationFingerprint||null,generatorVersion:level.generatorVersion,contentVersion:level.contentVersion||null,family:level.planning?.shapeFamily||'opening',fromStart:!!fromStart,activeMs:0,edits:0,undos:0,redos:0,hints:0,failures:0,interruptions:0,completed:!!completed};data.sessions.push(current);data.sessions=data.sessions.slice(-MAX_SESSIONS);}
      last=lastInput=now();active=false;save();
    },
    context(value){tick();if(value&&!active)lastInput=now();active=!!value;save();},
    interact(){tick();lastInput=now();},
    record(event){tick();lastInput=now();if(current&&!current.completed){const fields={edit:'edits',undo:'undos',redo:'redos',hint:'hints',failure:'failures',interruption:'interruptions'};if(fields[event])current[fields[event]]=count(current[fields[event]])+1;if(event==='complete')current.completed=true;}save();},
    generation(sample){const {chapter,source,reason,totalMs,workerMs,fallbackMs}=sample;data.generations.push({chapter,source,reason,totalMs:count(totalMs),workerMs:count(workerMs),fallbackMs:count(fallbackMs)});data.generations=data.generations.slice(-MAX_GENERATIONS);save();},
    flush(){tick();save();},
    snapshot(){tick();return copy(data);}
  };
}
export function summarizePlaytests(data){
  const sessions=data?.sessions||[],generations=data?.generations||[];
  const complete=sessions.filter(s=>s.completed&&s.fromStart),groups=[];
  for(const from of [1,12,30,38,46,50,67]){
    const to=({1:11,12:29,30:37,38:45,46:49,50:66,67:Infinity})[from],rows=sessions.filter(s=>s.chapter>=from&&s.chapter<=to),done=rows.filter(s=>s.completed&&s.fromStart);
    if(rows.length)groups.push({from,to:to===Infinity?null:to,observed:rows.length,complete:done.length,medianMs:percentile(done.map(s=>s.activeMs),.5),hints:done.reduce((n,s)=>n+s.hints,0),failures:done.reduce((n,s)=>n+s.failures,0)});
  }
  return {observed:sessions.length,complete:complete.length,partial:sessions.filter(s=>!s.fromStart).length,generationSamples:generations.length,generationP95:percentile(generations.map(s=>s.totalMs)),fallbacks:generations.filter(s=>s.source==='verified-fallback').length,groups};
}
