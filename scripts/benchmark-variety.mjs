import {writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createCampaignLevel,GENERATOR_VERSION} from '../dist/levels.js';
import {evaluateLayout,validateLevel} from '../dist/engine.js';
import {generationQualityErrors} from '../dist/generation-quality.js';
import {describeStructure} from '../dist/puzzle-diversity.js';
import {furnitureIntroducedAt} from '../dist/progression.js';
import {SHAPE_INTRODUCTIONS} from '../dist/shape-catalog.js';
import {percentile} from '../dist/playtest-metrics.js';
const chapters=[12,13,15,17,18,21,23,25,27,30,31,33,35,37,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,67,68,69,70,71,72,80,100,1000,10000];
const rows=[],seeds=['playtest-A','playtest-B','playtest-C'];
for(const variationSeed of seeds){
  const recent=[],avoid=[];
  for(const chapter of chapters){
    const started=performance.now();
    try{
      const level=createCampaignLevel(chapter,{variationSeed,recentStructures:recent.slice(-8),avoidFingerprints:avoid,budgetMs:1150}),ms=performance.now()-started;
      const errors=[...validateLevel(level),...generationQualityErrors(level)];
      if(!evaluateLayout(level,level.reference).complete)errors.push('参考解失败');
      if(level.rules.length>60||new Set(level.reference.objects.map(o=>o.kind)).size>12)errors.push('超出内容预算');
      for(const kind of furnitureIntroducedAt(chapter))if(!level.progression.newFurniture.includes(kind)||!level.reference.objects.some(o=>o.kind===kind)||!level.rules.some(r=>r.type==='objectCount'&&r.kind===kind))errors.push('引入家具缺失:'+kind);
      if(SHAPE_INTRODUCTIONS[chapter]&&level.planning.shapeFamily!==SHAPE_INTRODUCTIONS[chapter])errors.push('引入结构缺失');
      const structure=describeStructure(level);recent.push(structure);avoid.push(level.generationFingerprint);
      rows.push({variationSeed,chapter,ms,family:structure.family,shapeFingerprint:structure.shapeFingerprint,fingerprint:level.generationFingerprint,similarityLimited:!!level.generation.similarityLimited,errors});
    }catch(error){rows.push({variationSeed,chapter,ms:performance.now()-started,errors:[error.message]});}
  }
}
const comparisons=chapters.map(chapter=>{const items=rows.filter(r=>r.chapter===chapter&&!r.errors.length);return {chapter,runs:items.length,distinctPuzzles:new Set(items.map(r=>r.fingerprint)).size,distinctStructures:new Set(items.map(r=>r.shapeFingerprint)).size};});
const report={version:1,generatorVersion:GENERATOR_VERSION,scope:'Fixed cross-campaign compute samples; not a uniqueness proof or human difficulty calibration.',samples:rows.length,invalid:rows.filter(r=>r.errors.length).length,distinctPuzzles:new Set(rows.map(r=>r.fingerprint).filter(Boolean)).size,chaptersWithDifferentPuzzles:comparisons.filter(r=>r.distinctPuzzles>1).length,chapterCount:chapters.length,computeP95:percentile(rows.map(r=>r.ms)),comparisons,rows};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,comparisons:undefined,rows:undefined},null,2));
if(report.invalid)process.exitCode=1;
