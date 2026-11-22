// Stable, bounded random stream IDs. No browser randomness inside generation:
// saving the campaign ID and level snapshot is enough to resume the same run.
export function variationKey(value){
  if(typeof value!=='string'||!value.length)return '';
  let a=2166136261,b=2246822519;
  for(const char of value.slice(0,128)){const c=char.codePointAt(0);a=Math.imul(a^c,16777619);b=Math.imul(b^c,3266489917);}
  return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
}
export function fallbackVariationRank(key,chapter,fingerprint){
  return key?variationKey(key+':'+chapter+':'+fingerprint):'';
}
