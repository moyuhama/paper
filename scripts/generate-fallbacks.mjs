import {mkdir,writeFile,rm} from 'node:fs/promises';
import {createCampaignLevel,GENERATOR_VERSION} from '../dist/levels.js';
import {CONTENT_VERSION} from '../dist/catalog.js';
const directory=new URL('../dist/data/levels/',import.meta.url);await mkdir(directory,{recursive:true});
const entries=[];
for(let chapter=2;chapter<=100;chapter++){
  const level=createCampaignLevel(chapter,{budgetMs:5000}),file=`levels/${chapter}.json`;
  await writeFile(new URL('../dist/data/'+file,import.meta.url),JSON.stringify(level));
  entries.push({chapter,tier:level.difficulty?.tier,family:level.planning?.shapeFamily,mechanics:level.mechanics||[],fingerprint:level.generationFingerprint,file});
}
await writeFile(new URL('../dist/data/fallback-index.json',import.meta.url),JSON.stringify({generatorVersion:GENERATOR_VERSION,contentVersion:CONTENT_VERSION,entries}));
await rm(new URL('../dist/data/fallback-levels.json',import.meta.url),{force:true});
console.log(`Saved ${entries.length} verified commissions with an on-demand index`);
