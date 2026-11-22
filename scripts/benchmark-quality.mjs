import {writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {cpus,platform,arch} from 'node:os';
import {createCampaignLevel,GENERATOR_VERSION} from '../dist/levels.js';
import {CONTENT_VERSION} from '../dist/catalog.js';
import {evaluateLayout,validateLevel} from '../dist/engine.js';
import {generationQualityErrors} from '../dist/generation-quality.js';
import {describeStructure,repetitionScore} from '../dist/puzzle-diversity.js';
import {SHAPE_UNLOCKS} from '../dist/shape-catalog.js';
import {percentile} from '../dist/playtest-metrics.js';
const rows=[],recent=[],fingerprints=[];
const cases=[...[12,18,24,30,38,46,50,62,67,98].flatMap(start=>Array.from({length:4},(_,i)=>({chapter:start+i}))),...Object.keys(SHAPE_UNLOCKS).map(family=>({chapter:80,family})),{chapter:1000},{chapter:10000}];
for(const request of cases){
  const started=performance.now();let level;
  try{level=createCampaignLevel(request.chapter,{family:request.family,recentStructures:recent.slice(-8),avoidFingerprints:fingerprints.slice(-100),budgetMs:1150});}
  catch(error){rows.push({...request,ms:performance.now()-started,error:error.message});continue;}
  const ms=performance.now()-started,check=evaluateLayout(level,level.reference),errors=[...validateLevel(level),...generationQualityErrors(level),...check.errors];
  if(!check.complete)errors.push('参考解未通过');
  const visible=level.rules.filter(r=>!r.hidden).length,kinds=new Set(level.reference.objects.map(o=>o.kind)).size;
  if(visible>60||kinds>12)errors.push('超出内容预算');
  const structure=describeStructure(level);
  rows.push({...request,ms,family:structure.family,rooms:level.rooms.length,visibleRules:visible,objectKinds:kinds,objects:level.reference.objects.length,similarity:repetitionScore(structure,recent),similarityLimited:!!level.generation?.similarityLimited,fingerprint:level.generationFingerprint,errors});
  recent.push(structure);fingerprints.push(level.generationFingerprint);
}
const passed=rows.filter(r=>!r.error&&!r.errors.length),report={version:1,generatorVersion:GENERATOR_VERSION,contentVersion:CONTENT_VERSION,environment:{runtime:process.version,platform:platform(),arch:arch(),cpu:cpus()[0]?.model},scope:'Sequential Node compute including generator validation; excludes browser Worker startup, network and phone hardware. Not human difficulty evidence.',samples:rows.length,generated:passed.length,generationFailures:rows.filter(r=>r.error).length,invalid:rows.filter(r=>r.errors?.length).length,computeP50:percentile(rows.map(r=>r.ms),.5),computeP95:percentile(rows.map(r=>r.ms)),maxMs:Math.max(...rows.map(r=>r.ms)),similarityLimited:rows.filter(r=>r.similarityLimited).length,rows};
const output=process.argv[2];if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined},null,2));
if(report.invalid||report.generationFailures)process.exitCode=1;
