import {difficultyFor} from './generation-policy.js';
import {SHAPE_UNLOCKS} from './shape-catalog.js';
import {validateLevel,evaluateLayout,clone} from './engine.js';
import {unlockedFurnitureAt,furnitureIntroducedAt} from './progression.js';
import {CONTENT_VERSION} from './catalog.js';
function verified(level){return !validateLevel(level).length&&evaluateLayout(level,level.reference).complete;}
export function createCommissionGenerator({WorkerClass=globalThis.Worker,fetcher=globalThis.fetch,timeoutMs=1500}={}){
  let fallbackPromise;
  async function fallback(chapter,avoid){
    fallbackPromise??=fetcher(new URL('./data/fallback-levels.json',import.meta.url)).then(response=>{if(!response.ok)throw new Error('委托内容暂时不可用');return response.json();}).catch(error=>{fallbackPromise=null;throw error;});
    const bank=await fallbackPromise;if(bank.contentVersion!==CONTENT_VERSION)throw new Error('委托内容版本不一致，请刷新后重试');
    const allowed=new Set(unlockedFurnitureAt(chapter)),required=furnitureIntroducedAt(chapter);
    const pool=bank.levels.filter(level=>(chapter<=37?level.chapter===chapter:level.chapter>=30&&level.difficulty?.tier===difficultyFor(chapter).tier)&&(level.chapter<12||!level.planning?.shapeFamily||SHAPE_UNLOCKS[level.planning.shapeFamily]<=chapter)&&!avoid.includes(level.generationFingerprint)&&level.reference.objects.every(o=>allowed.has(o.kind))&&required.every(kind=>level.reference.objects.some(o=>o.kind===kind)));
    const source=pool.find(verified);if(!source)throw new Error('暂时没有适合的新委托，请稍后重试');
    const level=clone(source);level.id='story:'+chapter;level.chapter=chapter;level.title='第'+chapter+'份委托';level.progression={newFurniture:required};level.generation={source:'verified-fallback'};return level;
  }
  return async(chapter,{avoidFingerprints=[]}={})=>{
    unlockedFurnitureAt(chapter);
    if(!WorkerClass)return fallback(chapter,avoidFingerprints);
    try{
      return await new Promise((resolve,reject)=>{
        let worker,timer;
        const finish=(error,level)=>{clearTimeout(timer);worker?.terminate();error?reject(error):resolve(level);};
        try{
          worker=new WorkerClass(new URL('./generation-worker.js',import.meta.url),{type:'module'});
          timer=setTimeout(()=>finish(new Error('生成超时')),timeoutMs);
          worker.onmessage=event=>{const level=event.data?.level;if(!level||level.chapter!==chapter||!verified(level)||avoidFingerprints.includes(level.generationFingerprint))finish(new Error('生成结果未通过验证'));else finish(null,level);};
          worker.onerror=()=>finish(new Error('生成暂时不可用'));
          worker.postMessage({chapter,avoidFingerprints});
        }catch(error){finish(error);}
      });
    }catch{return fallback(chapter,avoidFingerprints);}
  };
}
