import {mechanicsAt,mechanicsIntroducedAt,supportsMechanics} from './mechanics.js';
import {describeStructure,repetitionScore,rankFallbackEntries} from './puzzle-diversity.js';
import {difficultyFor} from './generation-policy.js';
import {SHAPE_UNLOCKS} from './shape-catalog.js';
import {validateLevel,evaluateLayout,clone} from './engine.js';
import {unlockedFurnitureAt,furnitureIntroducedAt} from './progression.js';
import {CONTENT_VERSION} from './catalog.js';
function verified(level,chapter=level.chapter){const allowed=new Set(unlockedFurnitureAt(chapter)),required=furnitureIntroducedAt(chapter);return !validateLevel(level).length&&supportsMechanics(level,chapter)&&level.reference?.objects?.every(o=>allowed.has(o.kind))&&required.every(kind=>level.reference.objects.some(o=>o.kind===kind))&&evaluateLayout(level,level.reference).complete;}
export function createCommissionGenerator({WorkerClass=globalThis.Worker,fetcher=globalThis.fetch,timeoutMs=1500}={}){
  let fallbackPromise;
  const indexURL=new URL('./data/fallback-index.json',import.meta.url);
  async function json(url){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
    try{const response=await fetcher(url,{signal:controller.signal,cache:'no-cache'});if(!response.ok)throw new Error('委托内容暂时不可用');return await response.json();}
    finally{clearTimeout(timer);}
  }
  async function fallback(chapter,avoid,recent){
    fallbackPromise??=json(indexURL).catch(error=>{fallbackPromise=null;throw error;});
    const bank=await fallbackPromise;if(bank.contentVersion!==CONTENT_VERSION)throw new Error('委托内容版本不一致，请刷新后重试');
    const allowed=new Set(unlockedFurnitureAt(chapter)),required=furnitureIntroducedAt(chapter);
    const pool=bank.entries.filter(entry=>(chapter<=66?entry.chapter===chapter:entry.chapter>=30&&entry.tier===difficultyFor(chapter).tier)&&(entry.chapter<12||!entry.family||SHAPE_UNLOCKS[entry.family]<=chapter)&&!avoid.includes(entry.fingerprint)&&mechanicsAt(chapter).every(key=>(entry.mechanics||[]).includes(key)));
    let best,bestScore=Infinity;
    for(const entry of rankFallbackEntries(pool,recent).slice(0,3)){
      if(!/^levels\/\d+\.json$/.test(entry.file))continue;
      const source=await json(new URL(entry.file,indexURL));
      if(!source||source.generationFingerprint!==entry.fingerprint||source.contentVersion!==bank.contentVersion||!verified(source,chapter)||!source.reference.objects.every(o=>allowed.has(o.kind))||!required.every(kind=>source.reference.objects.some(o=>o.kind===kind)))continue;
      const level=clone(source);level.id='story:'+chapter;level.chapter=chapter;level.title='第'+chapter+'份委托';level.progression={newFurniture:required,newMechanics:mechanicsIntroducedAt(chapter)};level.generationStructure=describeStructure(level);const score=repetitionScore(level.generationStructure,recent);level.generation={source:'verified-fallback',similarity:score};
      if(score<bestScore){best=level;bestScore=score;}
      if(score<.93)return level;
    }
    if(best){best.generation.similarityLimited=true;return best;}
    throw new Error('暂时没有适合的新委托，请稍后重试');
  }
  return async(chapter,{avoidFingerprints=[],recentStructures=[]}={})=>{
    unlockedFurnitureAt(chapter);
    if(!WorkerClass)return fallback(chapter,avoidFingerprints,recentStructures);
    try{
      return await new Promise((resolve,reject)=>{
        let worker,timer;
        const finish=(error,level)=>{clearTimeout(timer);worker?.terminate();error?reject(error):resolve(level);};
        try{
          worker=new WorkerClass(new URL('./generation-worker.js',import.meta.url),{type:'module'});
          timer=setTimeout(()=>finish(new Error('生成超时')),timeoutMs);
          worker.onmessage=event=>{const level=event.data?.level;if(!level||level.chapter!==chapter||!verified(level,chapter)||avoidFingerprints.includes(level.generationFingerprint))finish(new Error('生成结果未通过验证'));else finish(null,level);};
          worker.onerror=()=>finish(new Error('生成暂时不可用'));
          worker.postMessage({chapter,avoidFingerprints,recentStructures});
        }catch(error){finish(error);}
      });
    }catch{return fallback(chapter,avoidFingerprints,recentStructures);}
  };
}
