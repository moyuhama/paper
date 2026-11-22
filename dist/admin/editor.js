import {referencePreview} from './preview.js';
import {generationQualityErrors} from '../generation-quality.js';
import {generateLevel,createOpeningLevel,GENERATOR_VERSION} from '../levels.js';
import {validateLevel,evaluateLayout} from '../engine.js';
const $=s=>document.querySelector(s);
function report(text){$('#result').textContent=text;}
function read(){return JSON.parse($('#json').value);}
function show(level){$('#json').value=JSON.stringify(level,null,2);validate();}
function validate(){$('#reference-preview').innerHTML='';try{const level=read(),errors=validateLevel(level);if(errors.length){report(errors.join('\n'));return;}if(!level.reference){report('格式通过。未附参考解，尚未验证有解。');return;}const check=evaluateLayout(level,level.reference);if(!check.errors.length)$('#reference-preview').innerHTML=referencePreview(level);const quality=['0.2.0',GENERATOR_VERSION].includes(level.generatorVersion)?generationQualityErrors(level):null;report([`格式：通过`,`房间：${level.rooms.length}`,`条件：${level.rules.length}`,`参考解：${check.complete?'通过':'失败'}`,...(quality?[`分区与通行：${quality.length?'失败':'通过'}`,...quality]:[]),...check.errors,...check.results.filter(r=>!r.ok).map(r=>'未满足：'+r.text)].join('\n'));}catch(error){report('错误：'+error.message);}}
$('#generate').onclick=()=>{try{show($('#mode').value==='opening'?createOpeningLevel():generateLevel($('#seed').value,$('#mode').value));}catch(e){report(e.message);}};
$('#validate').onclick=validate;
$('#file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2e6)throw new Error('文件超过2MB');const data=JSON.parse(await file.text());show(data.level||data);}catch(error){report(error.message);}};
$('#export').onclick=()=>{try{const level=read(),errors=validateLevel(level);if(errors.length)throw new Error(errors.join('；'));const url=URL.createObjectURL(new Blob([JSON.stringify(level,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='level.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){report(error.message);}};
show(createOpeningLevel());
