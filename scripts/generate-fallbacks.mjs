import {writeFile} from 'node:fs/promises';
import {createCampaignLevel,GENERATOR_VERSION} from '../dist/levels.js';
import {CONTENT_VERSION} from '../dist/catalog.js';
const levels=[];
for(let chapter=2;chapter<=100;chapter++)levels.push(createCampaignLevel(chapter,{budgetMs:5000}));
await writeFile(new URL('../dist/data/fallback-levels.json',import.meta.url),JSON.stringify({generatorVersion:GENERATOR_VERSION,contentVersion:CONTENT_VERSION,levels}));
console.log(`Saved ${levels.length} verified fallback commissions`);
