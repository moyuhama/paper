import {PLAYTEST_STORE,summarizePlaytests} from '../playtest-metrics.js';
const $=selector=>document.querySelector(selector);
let data;
function refresh(){
  try{data=JSON.parse(localStorage.getItem(PLAYTEST_STORE)||'null');}catch{data=null;}
  if(data?.version!==1||!Array.isArray(data.sessions)||!Array.isArray(data.generations)){data={version:1,sessions:[],generations:[]};}
  const s=summarizePlaytests(data),ms=value=>value===null?'暂无样本':Math.round(value)+'ms';
  $('#summary').textContent=`已观察委托：${s.observed}\n从开始观察且已通过：${s.complete}\n中途接入：${s.partial}\n出题样本：${s.generationSamples}\n总等待P95（含Worker/校验/回退下载）：${ms(s.generationP95)}\n已验题回退：${s.fallbacks}\n尚需人工记录：相似感、用途合理性、难度评价及设备型号。`;
  $('#groups').replaceChildren(...s.groups.map(group=>{const node=document.createElement('pre');node.textContent=`第${group.from}～${group.to??'以后'}份委托\n观察${group.observed}份；完整通过${group.complete}份\n完整样本有效用时中位数：${group.medianMs===null?'暂无样本':(group.medianMs/60000).toFixed(1)+'分钟'}\n完整样本求助合计${group.hints}次；失败提交合计${group.failures}次`;return node;}));
}
$('#refresh').onclick=refresh;
$('#download').onclick=()=>{refresh();const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='paper-playtests.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#clear').onclick=()=>{if(confirm('清空当前地址的试玩评测记录？草稿和成绩不受影响。请先关闭玩家标签页，避免其重新保存记录。')){localStorage.removeItem(PLAYTEST_STORE);refresh();}};
window.addEventListener('storage',event=>{if(event.key===PLAYTEST_STORE)refresh();});
refresh();
