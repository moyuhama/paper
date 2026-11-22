import {availableTags,placementIdentity,assignFurnitureTag,instanceName} from './instances.js';
import {frontAnnotationSVG,instanceBadgeSVG,usagePreviewSVG,spatialRuleSVG,ruleExplanation} from './rule-visuals.js';
import {MECHANIC_NAMES} from './mechanics.js';
import {lessonsForLevel,completeLessons} from './tutorials.js';
import {describeStructure} from './puzzle-diversity.js';
import {roomArea,cellArea} from './geometry.js';
import {createCommissionGenerator} from './generation-client.js';
import {createId} from './ids.js';
import {archiveConversation,completedCommissions} from './commission-history.js';
import {renderPlan} from './plan-view.js';
import {beginTouchCamera,updateTouchCamera} from './touch-camera.js';
import {createBoardGestures} from './board-gestures.js';
import {PLAYTEST_STORE,createPlaytestRecorder} from './playtest-metrics.js';
import {furnitureSVG,footprintSVG,objectIcon,structureSVG,cellSVG,edgePath,diagonalBoundarySVG} from './drawing-assets.js';
import {GRID_PIXELS,clampZoom,cameraBox,draggedPan,zoomedPan} from './camera.js';
import {createGameAudio} from './audio.js';
import {OBJECTS,directionBands,selectedObjects,clone,point,cellKey,edgeKey,edgeParts,allEdges,edgeInfo,boundaryKind,footprint,objectRoom,bounds,initialLayout,evaluateLayout,validateLevel,paintRoom,eraseRect,placeBoundary,placeObject,rotateObject} from './engine.js';
import {hintRoom,createOpeningLevel,createCampaignLevel,paletteForLevel} from './levels.js';
import {RATING_VERSION,newAttempt,recordHint,recordFailure,approveAttempt,restoreAttempt,restoreSubmissionRatings} from './rating.js';

const $=selector=>document.querySelector(selector),esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORE='paper-studio:v1';
let saved={};try{saved=JSON.parse(localStorage.getItem(STORE)||'{}');}catch{}
let level,layout,undoStack=[],redoStack=[],tool='room',selectedRoom,selectedObject='bed',rotation=0,eraseFilter='all',hints=3,submissions=[],history=saved.history||[],phone=false,review=null,collapsed=new Set(),drag=null,pan={x:0,y:0},zoom=1,help=false,modal=null;
let campaignId=saved.campaignId||'legacy',conversations=saved.conversations||[],viewingCommission=null,chatScroll=null,mobilePaletteOpen=false;
let taskIndex=saved.taskIndex||1,tutorialStage=saved.tutorialStage||0;
let pendingTag=null;
let selectedId=null,hoverPoint=null,lastDrawTool='room',inspectedRule=null;
let paletteFocus=null,requirementsReset=false,manualGuide=false,showRequirements=true,requirementsScroll=0,portraitHintDismissed=false,viewNeedsFit=true;
const savedVolume=(key,fallback)=>typeof saved.settings?.[key]==='number'&&Number.isFinite(saved.settings[key])?Math.max(0,Math.min(1,saved.settings[key])):fallback;
let screen='menu',settings={showTips:saved.settings?.showTips!==false,showGrid:saved.settings?.showGrid!==false,musicVolume:savedVolume('musicVolume',.5),effectsVolume:savedVolume('effectsVolume',.7)};
const playtest=createPlaytestRecorder({read:()=>JSON.parse(localStorage.getItem(PLAYTEST_STORE)||'null'),write:data=>localStorage.setItem(PLAYTEST_STORE,JSON.stringify(data))});
const gestures=createBoardGestures();let pinch=null,playtestReady=false;
const gameAudio=createGameAudio(settings),generateCommission=createCommissionGenerator({onMeasure:sample=>playtest.generation(sample)});
let preparingCommission=false,generationRequest=0;
let guideDone=saved.guideDone===true,guideStep=guideDone?null:0;
let seenLessons=Array.isArray(saved.seenLessons)?saved.seenLessons:[],contentLessons=[],lessonIndex=0;
try{if(saved.level&&validateLevel(saved.level).length===0){level=saved.level;layout=saved.layout;hints=saved.hints??3;submissions=saved.submissions||[];}}
catch{}
if(!level||!layout){level=createOpeningLevel();layout=initialLayout(level);}
contentLessons=lessonsForLevel(level,{seen:seenLessons});
let attempt=restoreAttempt(saved.attempt,{hintsRemaining:hints,submissions});
submissions=restoreSubmissionRatings(submissions,attempt);
hints=3-attempt.hintsUsed;
selectedRoom=level.chapter===1&&tutorialStage<3?level.rooms[tutorialStage].id:level.rooms[0].id;
if(level.chapter===1&&tutorialStage===3){tool=lastDrawTool='door';paletteFocus='[data-object="bed"]';}
if(level.chapter===1&&tutorialStage===4){tool=lastDrawTool='object';selectedObject='bed';}
function persist(){try{localStorage.setItem(STORE,JSON.stringify({level,layout,hints,submissions,campaignId,conversations,history:history.slice(-50),taskIndex,tutorialStage,guideDone,seenLessons,settings,attempt}));}catch{toast('浏览器存储不可用，当前图纸仍可继续编辑');}}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3200);}
function commit(next,action){
  if(level.chapter===1)advanceOpening(next);
  else if(guideStep===1&&action==='room')guideStep=2;
  else if(guideStep===2&&['door','window','open'].includes(action))guideStep=3;
  else if(guideStep===3&&action==='object')guideStep=4;
if(JSON.stringify(layout)===JSON.stringify(next)){render();return;}playtest.record('edit');undoStack.push(clone(layout));if(undoStack.length>80)undoStack.shift();redoStack=[];layout=next;review=null;gameAudio.play(action==='eraser'?'erase':action==='room'?'pencil':'place');persist();render();}
function archiveCurrentConversation(){conversations=archiveConversation(conversations,{campaignId,level,submissions});}
function pastCommissions(){return completedCommissions(history,conversations,{campaignId,currentLevelId:level.id});}
function loadGameLevel(next,{archive=true}={}){
  if(archive)archiveCurrentConversation();mobilePaletteOpen=false;
  level=next;pendingTag=null;contentLessons=lessonsForLevel(level,{seen:seenLessons});lessonIndex=0;manualGuide=false;guideStep=guideDone?null:0;layout=initialLayout(level);hints=3;attempt=newAttempt();submissions=[];review=null;selectedRoom=level.rooms[0].id;selectedId=null;hoverPoint=null;inspectedRule=null;undoStack=[];redoStack=[];collapsed=new Set();requirementsReset=true;showRequirements=true;viewNeedsFit=true;pan={x:0,y:0};zoom=1;tool=lastDrawTool='room';screen='game';phone=true;modal=null;taskIndex=level.chapter||taskIndex+1;playtest.begin({campaignId,level,fromStart:true});playtestReady=true;persist();render();
}
function advanceOpening(next){
  const before=tutorialStage;
  while(tutorialStage<3){const roomId=level.rooms[tutorialStage].id,target=level.rules.find(r=>r.type==='area'&&r.roomId===roomId).value;if(Object.values(next.cells).filter(id=>id===roomId).length!==target)break;tutorialStage++;}
  if(tutorialStage===3){const check=evaluateLayout(level,next);if(check.results.filter(r=>r.type!=='objectCount').every(r=>r.ok))tutorialStage=4;}
  if(tutorialStage===4&&evaluateLayout(level,next).complete)tutorialStage=5;
  if(before!==tutorialStage){
    if(tutorialStage<3){selectedRoom=level.rooms[tutorialStage].id;tool=lastDrawTool='room';}
    else if(tutorialStage===3)tool=lastDrawTool='door';
    else if(tutorialStage===4){selectedObject='bed';tool=lastDrawTool='object';}
    if(tutorialStage<3)paletteFocus=`[data-room="${selectedRoom}"]`;else if(tutorialStage===3)paletteFocus='[data-object="bed"]';else if(tutorialStage===4)paletteFocus='[data-object="bed"]';
    if(!guideDone)guideStep=0;
  }
}
function icon(kind,extra=''){
  const base='fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
  const shapes={
    room:'<path d="m4 16 11-12 5 5L9 21H3l1-5Zm9-10 5 5M4 16l5 5"/>',eraser:'<path d="m4 14 9-10 7 6-9 10H8l-4-4zM9 9l7 6M11 20h10"/>',hand:'<path d="M7 12V8a2 2 0 0 1 4 0v4-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v8c0 5-3 7-7 7-3 0-4-2-6-4l-3-4a2 2 0 0 1 3-2l2 2"/>',
    door:'<path d="M5 21V3h14v18M5 21h14M5 3l11 4v14M13 13h.1"/>',window:'<path d="M3 8h18M3 16h18M5 8v8M19 8v8M3 12h18"/>',open:'<path d="M2 8v8M22 8v8M3 12h5m8 0h5" stroke-dasharray="2 3"/>',
    object:'<path d="M4 20V9h16v11M2 20h20M6 9V4h12v5M4 15h16"/>',undo:'<path d="M4 9h10a6 6 0 0 1 0 12M4 9l5-5M4 9l5 5"/>',redo:'<path d="M20 9H10a6 6 0 0 0 0 12M20 9l-5-5M20 9l-5 5"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',chevron:'<path d="m8 10 4 4 4-4"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="m9 3 1 3h4l1-3 3 2-1 3 2 3 3 1-1 4h-3l-2 2v3l-4 1-1-3-3-2-3 1-2-3 3-1V9L3 8l2-3 3 1Z"/>',eye:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',eyeClosed:'<path d="M3 9s3 5 9 5 9-5 9-5M5 12l-2 3m6-1-1 3m7-3 1 3m3-5 2 3"/>',rotate:'<path d="M20 9a8 8 0 1 0-1 9M20 4v5h-5"/>',phone:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4M11 19h2"/>',folder:'<path d="M3 7V4h7l2 3h9v14H3V7z"/>',download:'<path d="M12 3v13m-5-5 5 5 5-5M4 18v3h16v-3"/>',check:'<path d="m5 12 4 4 10-11"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v7M12 6h.01"/>',plus:'<path d="M12 4v16M4 12h16"/>'
  };
  return `<svg ${extra} viewBox="0 0 24 24" aria-hidden="true" ${base}>${shapes[kind]||shapes.object}</svg>`;
}
function requirementText(result){
  const rule=level.rules.find(r=>r.id===result.id),actual=typeof result.actual==='number'?result.actual:result.actual==='未绘制房间'?0:null;
  if(actual===null||!Number.isFinite(rule?.value))return result.text;
  if(rule.type==='area')return `面积 ${actual}/${rule.value}㎡`;
  if(['globalCount','boundaryCount','objectCount','openLength','connectionCount'].includes(rule.type)&&rule.value>0){
    return result.text.replace(/(?:×|需有)?\s*([0-9]+)(㎡|m|扇)?$/,(_,n,unit)=>` ${actual}/${rule.value}${unit||''}`);
  }
  return result.text;
}
function groupsHTML(check){
  return [{id:'global',name:'整屋要求',color:'#56634f'},...level.rooms].map(room=>{
    const items=check.results.filter(r=>r.group===room.id&&!level.rules.find(rule=>rule.id===r.id)?.hidden),count=items.filter(r=>r.ok).length,done=count===items.length,closed=collapsed.has(room.id);
    return `<section class="require-group ${done?'done':''}"><button class="group-head" data-collapse="${room.id}" aria-expanded="${!closed}"><span class="fold ${closed?'closed':''}">⌄</span><span class="swatch" style="--room:${room.color}"></span><span>${esc(room.name)}</span><span class="group-count">${count}/${items.length}</span></button>${closed?'':`<ul>${items.map(r=>`<li class="${r.ok?'met':''}"><span class="condition-icon">${r.ok?'✓':'·'}</span>${['direction','useSpace','distance','instances'].includes(r.type)?`<button class="direction-condition ${inspectedRule===r.id?'inspecting':''}" data-inspect="${r.id}" aria-label="${esc(r.text)}" title="在图纸上查看条件范围">${esc(r.text)}<span class="range-link">查看范围</span></button>`:`<span>${esc(requirementText(r))}</span>`}</li>`).join('')}</ul>`}</section>`;
  }).join('');
}
function boardHTML(){
  let svg='<defs><pattern id="direction-hatch" width=".2" height=".2" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0v.2" stroke="#b95b50" stroke-width=".045" opacity=".5"/></pattern></defs>';
  svg+=`<defs><clipPath id="plot-clip">${level.outline.map(c=>cellSVG(level,c)).join('')}</clipPath></defs>`;
  // Room colour is beneath the requirements; walls, labels and furniture are above.
  let roomFills='';
  for(const cell of level.outline){
    const[x,y]=point(cell),room=level.rooms.find(r=>r.id===layout.cells[cell]);
    if(room)roomFills+=cellSVG(level,cell,`fill="${room.color}"`);
    // Blank input belongs below the task controls; wall and furniture strokes remain above.
    svg+=cellSVG(level,cell,'fill="transparent" pointer-events="none"');
  }
  const paperGrid=`<svg id="paper-grid" aria-hidden="true" viewBox="0 0 24 14"><defs><pattern id="paper-meter-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#9b9b7c" stroke-opacity=".32" stroke-width=".018"/></pattern></defs>${roomFills}${settings.showGrid?'<rect id="map-grid" fill="url(#paper-meter-grid)"/>':''}</svg>`;
  for(const key of allEdges(level)){
    const {axis,x,y}=edgeParts(key),info=edgeInfo(level,layout,key),item=layout.edges[key],kind=boundaryKind(level,layout,key);
    if(axis==='d'){svg+=diagonalBoundarySVG(level,key,item);continue;}
    if(!info.boundary&&(!info.rooms.some(Boolean)||info.rooms[0]===info.rooms[1]))continue;
    const line=(color,width,dash='')=>`<path d="M${x} ${y} ${axis==='h'?'h1':'v1'}" stroke="${color}" stroke-width="${width}" fill="none" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
    if(kind==='open'){svg+=line('#faf8ee',.09);continue;}
    svg+=line('#474d40',info.boundary?.105:.065);
    if(kind==='window'){
      svg+=line('#fffdf5',.11)+line('#6c999e',.035);
      if(axis==='h')svg+=`<path d="M${x+.02} ${y-.045}h.96M${x+.02} ${y+.045}h.96" stroke="#6c999e" stroke-width=".018"/>`;
      else svg+=`<path d="M${x-.045} ${y+.02}v.96M${x+.045} ${y+.02}v.96" stroke="#6c999e" stroke-width=".018"/>`;
      if(item.fixed)svg+=`<path d="M${x+(axis==='h'?.37:-.09)} ${y+(axis==='h'?-.09:.37)}l.18 .18m${axis==='h'?'.18 -.18':'-.18 .18'} .18 .18" stroke="#5c898d" stroke-width=".035"/>`;
    }
    if(kind==='door'||kind==='entry'){
      svg+=line('#faf8ee',.12);
      svg+=axis==='h'?`<path d="M${x} ${y}v-.75a.75 .75 0 0 1 .75 .75" fill="none" stroke="#777e67" stroke-width=".025"/>`:`<path d="M${x} ${y}h.75a.75 .75 0 0 1-.75 .75" fill="none" stroke="#777e67" stroke-width=".025"/>`;
      if(kind==='entry')svg+=`<circle cx="${x+(axis==='h'?.1:0)}" cy="${y+(axis==='h'?0:.1)}" r=".07" fill="#506951"/>`;
    }
  }
  svg+=structureSVG(level)+directionOverlay();
  for(const room of level.rooms){
    const cells=Object.keys(layout.cells).filter(c=>layout.cells[c]===room.id);if(!cells.length)continue;
    const rb=bounds(cells),cx=rb.x+rb.w/2,cy=rb.y+rb.h/2;
    // Labels move toward a free cell if the bounding-box center falls outside a concave room.
    const occupied=new Set(layout.objects.flatMap(footprint));const free=cells.filter(c=>!level.geometry?.cellPolygons?.[c]&&!occupied.has(c)&&point(c)[1]<rb.y+rb.h-1);
    const nearest=[...(free.length?free:cells)].sort((a,b)=>{const[p,q]=point(a),[u,v]=point(b);return (p+.5-cx)**2+(q+.5-cy)**2-((u+.5-cx)**2+(v+.5-cy)**2);})[0];
    const [lx,ly]=point(nearest);svg+=`<g class="room-label" pointer-events="none"><text x="${lx+.5}" y="${ly+.42}" text-anchor="middle">${esc(room.name)}</text><text class="area-label" x="${lx+.5}" y="${ly+.8}" text-anchor="middle">${roomArea(level,layout,room.id)}㎡</text></g>`;
  }
  for(const object of layout.objects)svg+=`<g data-object-id="${esc(object.id)}">${furnitureSVG(object.kind,object.x,object.y,object.rotation)}${frontAnnotationSVG(level,layout,object)}${instanceBadgeSVG(object)}</g>`;
  const selected=layout.objects.find(o=>o.id===selectedId);
  if(selected)svg+=footprintSVG(selected,{stroke:'#b4803e',width:.06,dash:'.13 .07'});
  svg+='<g id="drawing-preview" pointer-events="none"></g>';
  return `${paperGrid}<div class="map-input" aria-hidden="true"></div><svg id="blueprint" viewBox="0 0 24 14" role="img" aria-label="户型图纸，当前使用${toolLabel()}工具"><g class="plan-content">${svg}</g></svg>`;
}
function toolLabel(){return {room:'画房间',eraser:'橡皮',hand:'抓手',door:'门',window:'窗',open:'开放连接',object:OBJECTS[selectedObject].name}[tool];}
function selectedFurniture(){return layout.objects.find(o=>o.id===selectedId);}
function drawingHint(){
  if(selectedFurniture())return '已选家具：右键 / R 转向 · 拖动移动 · Esc 取消选择';
  return {room:'先选底部的房间，再在图纸内按住左键拖出矩形；紧贴追加可画不规则房间。',object:'移动鼠标预览家具，右键 / R 转向，左键放下。绿色可放，红色需调整位置。',door:'点击墙边放门：外墙是入户门，两房公共墙是室内门。',window:'点击已画房间的外墙放窗；蓝色斜纹窗为固定元素。',open:'沿两房公共墙点击或拖动，移除隔墙；两侧须先画好房间。',hand:'点击家具选中，再拖动移动；右键 / R 转向。拖动空白处可平移图纸。',eraser:'按住左键拖动擦除所选范围；固定门窗会保留。'}[tool];
}
function compactScreen(){return window.matchMedia('(max-width:600px), (max-width:1100px) and (max-height:600px)').matches;}
function mobilePaletteButtonHTML(){
  if(tool==='hand')return '';
  const name=tool==='object'?OBJECTS[selectedObject].name:tool==='room'?level.rooms.find(r=>r.id===selectedRoom)?.name:{door:'门',window:'窗',open:'开放连接',eraser:'擦除范围'}[tool];
  return `<button class="mobile-palette-trigger" data-action="toggle-palette" aria-label="选择物件" aria-expanded="${mobilePaletteOpen}"><span>${esc(name||'选择物件')}</span>${icon('chevron')}</button>`;
}
function tagButtonHTML(active,selected){
  if(!active||(level.instanceSlots||[]).every(slot=>slot.kind!==active.kind))return '';
  const tag=selected?.tag||(pendingTag??availableTags(level,layout,active.kind)[0]?.tag)||'标';
  return `<button class="tag-button" data-action="furniture-tag" aria-label="家具标记" title="选择或交换家具标记">${esc(tag)}</button>`;
}
function tagModalHTML(){
  const selected=selectedFurniture(),kind=selected?.kind||selectedObject,slots=(level.instanceSlots||[]).filter(slot=>slot.kind===kind);
  return `<div class="modal-shade"><section class="modal instance-dialog" role="dialog" aria-modal="true" aria-label="家具标记"><button class="modal-close icon-button" data-action="close-modal" aria-label="关闭标记选择">${icon('close')}</button><h2>家具标记</h2><p>${selected?'选择A或B；标记已使用时，两件家具会交换标记，位置不变。':'新家具会自动分配未使用的标记，也可以手动指定。'}</p><div class="instance-choices">${slots.map(slot=>{const owner=layout.objects.find(o=>o.tag===slot.tag);return `<button data-instance-choice="${slot.tag}" ${!selected&&owner?'disabled':''}><strong>${slot.tag}</strong><span>${esc(OBJECTS[kind].name)}${owner?' · 已使用':''}</span></button>`;}).join('')}</div><div class="instance-actions">${!selected?'<button data-instance-choice="auto">自动分配</button>':''}<button data-instance-choice="none">${selected?'取消标记':'不标记'}</button><button class="primary" data-action="close-modal">返回</button></div></section></div>`;
}
function toolbarHTML(){
  const palette=paletteForLevel(level,tutorialStage);
  const selected=selectedFurniture(),active=selected|| (tool==='object'?{kind:selectedObject,rotation}:null);
  let options='';
  if(tool==='eraser')options=[['all','全部'],['room','仅房间'],['edge','仅门窗与连接'],['object','仅家具']].map(([key,label])=>`<button class="filter ${eraseFilter===key?'active':''}" data-filter="${key}">${label}</button>`).join('');
  else if(tool!=='hand'){
    options=level.rooms.filter(r=>palette.roomIds.includes(r.id)).map(r=>`<button data-room="${r.id}" class="room-chip ${tool==='room'&&selectedRoom===r.id?'active':''}" style="--room:${r.color}"><span>${esc(r.name)}</span></button>`).join('');
    options+=[['door','门','入户 / 室内'],['window','窗','外墙窗户'],['open','开放连接','移除隔墙']].filter(([key])=>palette.boundaries.includes(key)).map(([key,name,note])=>`<button class="edge-chip ${tool===key?'active':''}" data-tool="${key}">${icon(key)}<span>${name}</span></button>`).join('');
    options+=Object.entries(OBJECTS).filter(([key])=>palette.objectKinds.includes(key)).map(([key,def])=>`<button data-object="${key}" class="object-chip ${tool==='object'&&selectedObject===key?'active':''}">${objectIcon(key,selectedObject===key?rotation:0)}<span>${def.name}</span></button>`).join('');
  }
  return `<div class="toolbelt"><div class="tool-main"><div class="tool-modes">${[['draw','room','铅笔','1'],['erase','eraser','橡皮','2'],['move','hand','抓手','3']].map(([mode,key,label,hotkey])=>`<button class="mode-button ${mode==='draw'?!['eraser','hand'].includes(tool)?'active':'':tool===key?'active':''}" data-mode="${mode}" aria-label="${label}" title="${label}（${hotkey}）">${icon(key)}<span>${label}</span><kbd>${hotkey}</kbd></button>`).join('')}</div>${mobilePaletteButtonHTML()}<span class="palette-strip-label">房间 · 门窗 · 开放连接 · 家具</span><div class="rotation-control">${tagButtonHTML(active,selected)}${active?`<span class="selected-item">${selected?'已选':'待放'}：${esc(instanceName(active))}</span><button class="rotate-button" data-action="rotate" title="右键或R也能旋转">${icon('rotate')}<span>转向 <b data-angle>${active.rotation||0}°</b></span><kbd>R</kbd></button>`:''}</div></div><div class="palette-row"><button class="palette-scroll" data-action="palette-left" aria-label="向左滚动工具带"><kbd>A</kbd></button><div class="tool-options" data-section="${tool==='hand'?'none':tool==='eraser'?'erase':'all'}">${options}</div><button class="palette-scroll" data-action="palette-right" aria-label="向右滚动工具带"><kbd>D</kbd></button></div></div>`;
}
function directionOverlay(){
  const rule=level.rules.find(r=>r.id===inspectedRule);if(!rule)return '';if(rule.type!=='direction')return spatialRuleSVG(level,layout,rule);
  const outer=bounds(level.outline),sources=selectedObjects(layout,rule.source);
  return sources.map(o=>directionBands(footprint(o),rule.direction,outer).map(r=>`<g pointer-events="none"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#direction-hatch)" stroke="#b95b50" stroke-width=".035"/></g>`).join('')+footprintSVG(o,{stroke:'#b95b50',width:.065})).join('');
}
const GUIDE=[
  ['先读需求，再画图纸','目标是在固定外轮廓内安排房间、门窗和家具，满足左侧要求，再通过手机提交。你的现有图纸会保留。','开始操作'],
  ['选房间，拖出矩形','点击底部一个房间，在图纸内按住左键拖动。每格1㎡；紧贴原区域追加，可以画出L形等不规则房间。','了解门窗'],
  ['用门和开放连接通行','在底部物件带找到门、窗或开放连接，在墙边点击放置。开放连接会拆除公共墙；蓝色斜纹是不能删的固定窗。','了解家具'],
  ['先预览，再摆家具','选择家具后，图纸上会出现跟随鼠标的预览。右键或R转90°，左键放下；已放家具用抓手选中后也能转向。','了解交图'],
  ['看反馈，提交设计','绿色划线表示需求已满足；点击方位条件可以查看图上的条带范围。完成后点左侧手机的“提交图纸”，由林工审核。','开始设计']
];
function guideHTML(){
  if(inspectedRule)return '';
  if(!settings.showTips&&!manualGuide)return '';
  if(contentLessons.length){
    const lesson=contentLessons[lessonIndex];
    return `<section class="drawing-coach content-coach" aria-label="委托教学"><button class="coach-close" data-action="lesson-skip" aria-label="收起委托教学">${icon('close')}</button><span class="coach-kicker">林工 · 本次提示 ${lessonIndex+1}/${contentLessons.length}</span><h2>${esc(lesson.title)}</h2><p>${esc(lesson.text)}</p>${lesson.kind?`<div class="rotate-demo">${objectIcon(lesson.kind,0)}<span>${OBJECTS[lesson.kind].w} × ${OBJECTS[lesson.kind].h} m</span></div>`:''}<div class="coach-actions">${lessonIndex?'<button data-action="lesson-back">上一步</button>':''}<button class="primary" data-action="lesson-next">${lessonIndex+1===contentLessons.length?'开始设计':'下一条'}</button></div></section>`;
  }
  if(guideStep===null)return '';
  if(level.chapter===1){
    const steps=[['画卫生间 · 9㎡','选下方的卫生间，拖出9㎡矩形。北侧两扇固定窗须在房间内。'],['画走廊 · 3㎡','选走廊，画出3㎡区域，连接卫生间和卧室。'],['画卧室 · 16㎡','选卧室，拖出16㎡区域。紧贴已有部分追加，可调整房间形状。'],['门窗和床已加入','床与门窗已加入物件带。先摆床或先放门窗都可以，满足全部需求后再交图。'],['摆放双人床','移动鼠标预览，右键或R转向，左键放下。'],['可以交图了','要求已经全部满足。打开手机，把设计稿提交给林工审核。']];
    const mobileTexts=['单指拖出9㎡矩形，包含北侧两扇固定窗。点下方物件名称可切换。','用单指拖出3㎡走廊，连接卫生间和卧室。','单指拖出16㎡卧室；紧贴已有区域追加，可画不规则形状。','点下方物件名称展开列表，门窗、开放连接和床都在其中。','选择双人床，点“转向”调整方向，再点图纸放下；可用抓手移动。','点右上任务手机，提交图纸让林工审核。'];
    const [title,desktopText]=steps[tutorialStage],text=compactScreen()?mobileTexts[tutorialStage]:desktopText;return `<section class="drawing-coach opening-coach" aria-label="操作教学"><h2>${title}</h2><p>${text}</p><div class="coach-actions"><button class="primary" data-action="${tutorialStage===5?'phone':'opening-guide-ok'}">${tutorialStage===5?'提交图纸':'知道了'}</button></div></section>`;
  }
  const [title,desktopText,button]=GUIDE[guideStep],text=compactScreen()?['按要求安排房间、门窗和家具，最后在任务手机提交。','点下方物件名称选择房间，再用单指拖画。每格1㎡；紧贴追加可画不规则形状。','展开下方物件列表，选择门窗或开放连接，再点墙边放置。蓝色斜纹表示固定窗。','选择家具后，可点“转向”再放下；用抓手点选已放家具，也能转向或拖动。','满足的要求会变绿。方位条件可点开查看范围，完成后点右上任务手机提交。'][guideStep]:desktopText;
  return `<section class="drawing-coach" aria-label="操作教学"><button class="coach-close" data-action="guide-skip" aria-label="收起教学">${icon('close')}</button><span class="coach-kicker">林工 · 操作提示 ${guideStep+1}/${GUIDE.length}</span><h2>${title}</h2><p>${text}</p>${guideStep===3?`<div class="rotate-demo">${objectIcon('singleBed',0)}<kbd>R / 右键</kbd>${objectIcon('singleBed',90)}</div>`:''}<div class="coach-actions">${guideStep>0?'<button data-action="guide-back">上一步</button>':'<button data-action="guide-skip">我已熟悉操作</button>'}<button class="primary" data-action="guide-next">${button}</button></div></section>`;
}
function phoneDockHTML(check){return `<aside class="desk-rail"><button class="phone-dock" data-action="phone" aria-label="打开任务手机" title="查看委托、求助和提交图纸"><span class="dock-speaker"></span><span class="dock-screen"><span class="dock-avatar">林</span><strong>林工</strong><span>${check.complete?'图纸画好了吗？':'有一份新委托'}</span></span><span class="dock-home"></span></button></aside>`;}
function ratingHTML(submission){
  const rating=submission.rating;
  if(!rating||rating.stars===null)return `<p class="rating-unknown">评分记录不完整，暂不显示星级。</p>`;
  const stars=rating.stars,icons='★'.repeat(stars)+'☆'.repeat(3-stars);
  return `<div class="stars" role="img" aria-label="${stars}星，满分3星">${icons}</div><span class="rating-total">${stars}/3 星</span><p class="rating-summary">方案通过。</p>${rating.deductions.length?`<ul class="rating-deductions">${rating.deductions.map(d=>`<li>${esc(d.text)}</li>`).join('')}</ul>`:'<p class="rating-clean">首次独立完成，无扣分。</p>'}`;
}
function submissionMessages(items,{historical=false}={}){return items.map(s=>`<div class="message outgoing">设计稿 v${s.version}<small>${s.passed?'审核通过':'已提交审核'}</small></div><div class="message incoming ${s.passed?'success-message':''}">${s.passed?(historical&&(!s.rating||s.rating.stars===null)?'<p>方案已通过审核。</p>':ratingHTML(s)):esc(s.reason)}<small>${s.complete}/${s.total} 项要求满足</small></div>`).join('');}
function previousThreadsHTML(records){return records.map(item=>`<section class="commission-thread"><div class="chat-divider">${esc(item.title)} · 已完成</div><div class="attachment"><small>设计需求</small><strong>${esc(item.title)}</strong><p>${item.level.rooms.length}个房间 · ${item.level.rules.filter(r=>!r.hidden).length}项要求</p><button data-history-id="${esc(item.id)}" aria-label="查看${esc(item.title)}历史图纸">查看图纸</button></div>${submissionMessages(item.submissions,{historical:true})}</section>`).join('');}
function phoneHTML(){
  if(!phone)return '';
  const passed=evaluateLayout(level,layout).complete&&submissions.at(-1)?.passed,previous=pastCommissions();
  const newMechanics=(level.progression?.newMechanics||[]).map(key=>MECHANIC_NAMES[key]).filter(Boolean);
  const introduced=(level.progression?.newFurniture||[]).filter(kind=>OBJECTS[kind]).map(kind=>OBJECTS[kind].name);
  return `<div class="phone-shade" data-action="close-phone"></div><aside class="phone" aria-label="任务手机"><div class="phone-speaker"></div><div class="phone-status"><span>纸上事务所</span><span>●●● ▰</span></div><div class="phone-title"><div class="avatar">林</div><div><strong>林工</strong><small>设计部 · 项目委托</small></div>${previous.length?`<button class="chat-history-link" data-action="past-commissions">往期 ${previous.length}</button>`:''}<button class="icon-button" data-action="close-phone" aria-label="收起手机">${icon('close')}</button></div><div class="chat">${previousThreadsHTML(previous)}<div class="chat-divider current-commission">${esc(level.title)} · 当前委托</div><div class="message incoming">新委托已经发给你。先看需求，图纸画好后交给我审核。${level.planning?.label?`本次户型：${esc(level.planning.label)}。`:''}${Object.keys(level.fixedAreas||{}).length||level.fixedWalls?.length?'图上标出的固定结构不能占用或拆除。':''}${newMechanics.length?`本次新玩法：${esc(newMechanics.join('、'))}。查看图纸后有操作提示。`:''}${introduced.length?`这份委托新增${esc(introduced.join("、"))}，已加入铅笔物件列表。`:""}</div><div class="attachment"><small>设计需求 · ${esc(level.seed)}</small><strong>${esc(level.title)}</strong><p>${level.rooms.length}个房间 · ${level.rules.filter(r=>!r.hidden).length}项要求</p><button data-action="close-phone">查看图纸</button></div>${submissionMessages(submissions)}${passed?`<button class="primary next-task" data-action="next-task" ${preparingCommission?'disabled':''}>${preparingCommission?'正在准备委托…':'领取下一份委托'}</button>`:''}</div><div class="phone-compose"><button class="submit-design primary" data-action="submit">提交设计稿</button><button class="hint-button" data-action="hint" ${hints<=0||attempt.completed?'disabled':''}>求助 ${hints}/3</button><p>提交后由林工审核设计稿</p></div></aside>`;
}
function menuHTML(){
  const hasProgress=Object.keys(layout.cells).length>0||submissions.length>0||(level.chapter||1)>1;
  return `<main class="main-menu"><div class="menu-title" aria-label="纸上事务所"><span class="title-paper title-paper-one">纸上</span><span class="title-paper title-paper-two">事务所<i></i></span></div><nav class="menu-actions" aria-label="主菜单"><button class="menu-start" data-action="${hasProgress?'start-game':'new-game'}">${hasProgress?'继续游戏':'开始游戏'}</button>${hasProgress?'<button data-action="new-game">开始新游戏</button>':''}<button data-action="menu-settings">设置</button></nav><span class="menu-version">网页试玩版 · 0.10.0</span></main>`;
}
function modalHTML(){
  if(!modal)return '';
  if(modal==='furniture-tag')return tagModalHTML();
  if(modal==='game-menu')return `<div class="modal-shade"><section class="modal game-menu-modal" role="dialog" aria-label="游戏菜单"><h2>游戏菜单</h2><button data-action="main-menu">返回主菜单</button><button data-action="menu-settings">设置</button><button data-action="tutorial">当前操作提示</button><button data-action="help">操作说明</button><button class="primary" data-action="close-modal">继续游戏</button></section></div>`;
  if(modal==='history'&&viewingCommission){const item=viewingCommission;return `<div class="modal-shade"><section class="modal history-view" role="dialog" aria-modal="true" aria-label="历史图纸"><header><div><h2>${esc(item.title)}</h2><p>已完成 · 查看历史图纸</p></div><button class="icon-button" data-action="close-history" aria-label="返回当前委托">${icon('close')}</button></header><div class="history-plan">${renderPlan(item.level,item.layout)}</div><button class="primary" data-action="close-history">返回当前委托</button></section></div>`;}
  if(modal==='return-menu')return `<div class="modal-shade"><section class="modal return-dialog" role="dialog" aria-modal="true" aria-labelledby="return-title" aria-describedby="return-message"><button class="modal-close icon-button" data-action="close-modal" aria-label="取消返回主菜单">${icon('close')}</button><h2 id="return-title">返回主菜单</h2><p id="return-message">保存当前进度并返回主菜单？</p><div class="return-actions"><button data-action="close-modal" autofocus>取消</button><button class="primary" data-action="confirm-main-menu">确定</button></div></section></div>`;
  if(modal==='settings')return `<div class="modal-shade"><section class="modal settings-modal" role="dialog" aria-label="设置"><h2>设置</h2>${[['musicVolume','背景音乐'],['effectsVolume','音效']].map(([key,label])=>`<label class="setting-row sound-setting"><span>${label}</span><input type="range" min="0" max="100" step="1" data-volume="${key}" aria-label="${label}音量" value="${Math.round(settings[key]*100)}"><output data-volume-value="${key}">${Math.round(settings[key]*100)}%</output></label>`).join('')}<label class="setting-row"><span>显示操作提示</span><input type="checkbox" data-setting="showTips" ${settings.showTips?'checked':''}></label><label class="setting-row"><span>显示图纸网格</span><input type="checkbox" data-setting="showGrid" ${settings.showGrid?'checked':''}></label><button class="primary" data-action="close-settings">返回</button></section></div>`;
  if(modal==='help')return `<div class="modal-shade"><section class="modal help-modal" role="dialog" aria-modal="true" aria-label="绘图指南"><button class="modal-close icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button><span class="eyebrow">事务所工作手册</span><h2>从读图，到落笔</h2><ol><li><strong>先读条件。</strong> 每个房间的面积、门窗和家具要求会实时划掉。点标题折叠分组。</li><li><strong>拖出房间。</strong> 选择房间后拖出矩形；紧贴追加可形成不规则房间。每格1㎡。</li><li><strong>连接空间。</strong> 在墙边放门、窗或开放连接。门和开放连接都能让房间通达入口。</li><li><strong>摆放家具。</strong> 选择家具后点击放下，R或右键旋转；抓手可拖动。家具须完整位于一个房间。</li><li><strong>理解方位。</strong> 南北沿参考家具的宽度延伸，东西沿高度延伸；目标一格进入条带即可，范围跨越房间。</li><li><strong>交付图纸。</strong> 打开手机主动提交。求助会补画所选房间并消耗一次，撤销不返还次数。</li></ol><p class="touch-manual">触屏：单指拖画；抓手单指移动图纸或家具；双指移动、捏合缩放；点“转向”旋转家具。</p><div class="shortcut-row"><kbd>1</kbd>铅笔 <kbd>2</kbd>橡皮 <kbd>3</kbd>抓手 <kbd>R</kbd>旋转 <kbd>⌘Z</kbd>撤销</div><p class="modal-note">家具占地会随旋转改变；方向条件始终按图纸上的北、南、东、西判断。</p></section></div>`;
  return '';
}
function portraitHintHTML(tutorialVisible=false){return portraitHintDismissed||tutorialVisible?'':`<aside class="portrait-hint" aria-label="横屏建议"><span>${icon('phone')}<strong>横屏更好画</strong></span><button data-action="dismiss-portrait-hint">继续竖屏</button></aside>`;}
function render(){
  interruptBoard('redraw');if(screen==='game'&&!playtestReady){playtest.begin({campaignId,level,completed:attempt.completed});playtestReady=true;}playtest.context(screen==='game'&&!modal&&!document.hidden);
  if(screen==='menu'){$('#app').innerHTML=menuHTML()+modalHTML();return;}
  if(selectedId&&!selectedFurniture())selectedId=null;
  const check=evaluateLayout(level,layout);
  const requirements=$('.requirements');
  if(requirementsReset)requirementsScroll=0;else if(requirements&&!requirements.hidden)requirementsScroll=requirements.scrollTop;
  const scroll=requirementsScroll,palette=$('.tool-options'),paletteScroll=palette?.dataset.section===(tool==='hand'?'none':tool==='eraser'?'erase':'all')?palette.scrollLeft:0;
  const inspect=level.rules.find(r=>r.id===inspectedRule),coach=phone?'':guideHTML();
  $('#app').innerHTML=`<div class="studio game-screen ${mobilePaletteOpen?'palette-open':''}"><main class="desk"><div class="desk-content">${phoneDockHTML(check)}<div class="paper"><section class="drawing-area" aria-label="绘图工作台"><div class="paper-top"><div class="paper-actions"><button class="icon-button mobile-only" data-action="phone" aria-label="任务手机" title="委托与交图">${icon('phone')}</button><button class="icon-button mobile-only" data-action="game-menu" aria-label="游戏菜单" title="游戏菜单">${icon('menu')}</button><button class="icon-button" data-action="menu-settings" aria-label="设置" title="设置">${icon('settings')}</button><button class="help-icon" data-action="tutorial" aria-label="操作提示" title="操作提示">?</button><button class="icon-button" data-action="undo" title="撤销（⌘Z）" ${undoStack.length?'':'disabled'} aria-label="撤销">${icon('undo')}</button><button class="icon-button" data-action="redo" title="重做（⌘⇧Z）" ${redoStack.length?'':'disabled'} aria-label="重做">${icon('redo')}</button></div></div><div class="canvas-wrap">${boardHTML()}<button class="requirements-toggle" data-action="toggle-requirements" aria-label="${showRequirements?'隐藏':'显示'}要求列表" aria-expanded="${showRequirements}" aria-controls="requirements-list" title="${showRequirements?'隐藏':'显示'}要求列表">${icon(showRequirements?'eye':'eyeClosed')}<span>${esc(level.chapter||taskIndex)}</span></button><aside id="requirements-list" class="requirements" aria-label="委托要求" ${showRequirements?'':'hidden'}><div class="requirements-heading"><h1>${esc(level.title)}</h1></div>${groupsHTML(check)}</aside><div class="requirements-scrollbar" role="scrollbar" aria-label="滚动委托要求" aria-controls="requirements-list" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" tabindex="0" hidden><span class="requirements-thumb"></span></div>${coach?`<div class="tutorial-anchor" aria-live="polite" aria-atomic="true">${coach}</div>`:''}${inspect?`<div class="range-explanation"><strong>${esc(inspect.text)}</strong><span>${esc(ruleExplanation(inspect,layout))}</span><button data-action="clear-range" aria-label="关闭条件范围">${icon('close')}</button></div>`:''}<div class="compass" aria-hidden="true"><span>北</span><div>西 <b>✥</b> 东</div><span>南</span></div><div class="scale-mark"><i></i><span>1m</span></div><div class="zoom-controls"><button data-action="zoom-out" aria-label="缩小">−</button><button data-action="zoom-reset" title="重置视图">${Math.round(zoom*100)}%</button><button data-action="zoom-in" aria-label="放大">＋</button></div>${portraitHintHTML(!!coach||!!inspect)}</div></section></div></div><div class="desk-bottom"><button class="return-menu" data-action="main-menu">主菜单</button>${toolbarHTML()}<button class="phone-launch ${check.complete?'ready':''}" data-action="phone" aria-label="任务手机" title="查看委托、求助和提交图纸">${icon('phone')}<span><strong>${check.complete?'交图':'手机'}</strong></span></button></div></main>${phoneHTML()}${modalHTML()}</div>`;
  $('.requirements').scrollTop=scroll;requirementsReset=false;$('.tool-options').scrollLeft=paletteScroll;
  const paletteOverflow=$('.tool-options').scrollWidth>$('.palette-row').clientWidth-6;
  for(const button of document.querySelectorAll('.palette-scroll'))button.hidden=!paletteOverflow;
  if(paletteFocus){$(paletteFocus)?.scrollIntoView({block:'nearest',inline:'nearest'});paletteFocus=null;}
  bindBoard();bindRequirementsScroll();
  syncView();cameraResize.disconnect();cameraResize.observe($('#blueprint'));
  if(tool==='object'&&hoverPoint)showPlacementPreview(hoverPoint);
  if(phone){const chat=$('.chat');chat.scrollTop=chatScroll??chat.scrollHeight;chatScroll=null;}
}
function undo(){if(!undoStack.length)return;playtest.record('undo');redoStack.push(clone(layout));layout=undoStack.pop();review=null;persist();render();}
function redo(){if(!redoStack.length)return;playtest.record('redo');undoStack.push(clone(layout));layout=redoStack.pop();review=null;persist();render();}
function submit(){
  const check=evaluateLayout(level,layout),unmet=check.results.filter(r=>!r.ok),reason=check.errors[0]||(!Object.keys(layout.cells).length?'图纸还是空的，先规划房间吧。':`还有${unmet.length}项未满足：${unmet.slice(0,2).map(r=>r.text).join('；')}。`);
  let rating=null;
  if(check.complete){const approved=approveAttempt(attempt);attempt=approved.attempt;rating=approved.rating;}else attempt=recordFailure(attempt);
  playtest.record(check.complete?'complete':'failure');
  const item={version:submissions.length+1,passed:check.complete,reason,rating,scoringVersion:RATING_VERSION,complete:check.results.filter(r=>r.ok&&!level.rules.find(rule=>rule.id===r.id)?.hidden).length,total:level.rules.filter(r=>!r.hidden).length};submissions.push(item);review=item;if(check.complete&&level.chapter===1){guideDone=true;guideStep=null;}
  if(check.complete&&!history.some(h=>(h.campaignId||'legacy')===campaignId&&h.id===level.id&&h.version===submissions.length)){history.push({id:level.id,campaignId,version:submissions.length,title:level.title,seed:level.seed,rooms:level.rooms.length,level:clone(level),layout:clone(layout),rating:rating?clone(rating):null,at:new Date().toISOString()});}
  gameAudio.play(check.complete?'success':'error');persist();render();
}
document.addEventListener('click',async event=>{
  const soundButton=event.target.closest('button');
  if(soundButton&&!soundButton.disabled){const action=soundButton.dataset.action;if(action!=='submit'&&action!=='rotate')gameAudio.play(action==='phone'||action==='close-phone'||action==='next-task'?'phone':'click');}
  const oldCommission=event.target.closest('[data-history-id]');if(oldCommission){viewingCommission=pastCommissions().find(item=>item.id===oldCommission.dataset.historyId);if(viewingCommission){chatScroll=$('.chat').scrollTop;modal='history';drag=null;render();}return;}
  const collapse=event.target.closest('[data-collapse]');if(collapse){const id=collapse.dataset.collapse;collapsed.has(id)?collapsed.delete(id):collapsed.add(id);render();return;}
  const mode=event.target.closest('[data-mode]');if(mode){mobilePaletteOpen=compactScreen()&&mode.dataset.mode!=='move';tool=mode.dataset.mode==='draw'?lastDrawTool:mode.dataset.mode==='erase'?'eraser':'hand';selectedId=null;hoverPoint=null;render();return;}
  const inspect=event.target.closest('[data-inspect]');if(inspect){inspectedRule=inspectedRule===inspect.dataset.inspect?null:inspect.dataset.inspect;guideStep=null;render();return;}
  const toolButton=event.target.closest('[data-tool]');if(toolButton){mobilePaletteOpen=false;tool=lastDrawTool=toolButton.dataset.tool;selectedId=null;hoverPoint=null;render();return;}
  const room=event.target.closest('[data-room]');if(room){mobilePaletteOpen=false;selectedRoom=room.dataset.room;tool=lastDrawTool='room';selectedId=null;hoverPoint=null;render();return;}
  const object=event.target.closest('[data-object]');if(object){mobilePaletteOpen=false;selectedObject=object.dataset.object;pendingTag=null;tool=lastDrawTool='object';selectedId=null;hoverPoint=null;render();return;}
  const filter=event.target.closest('[data-filter]');if(filter){mobilePaletteOpen=false;eraseFilter=filter.dataset.filter;render();return;}
  const choice=event.target.closest('[data-instance-choice]');if(choice){
    const value=choice.dataset.instanceChoice,selected=selectedFurniture();
    if(selected){const result=assignFurnitureTag(level,layout,selected.id,value==='none'?'':value);if(result.error){toast(result.error);return;}modal=null;commit(result.layout,'object');}
    else{pendingTag=value==='auto'?null:value==='none'?'':value;modal=null;render();}return;
  }
  const action=event.target.closest('[data-action]')?.dataset.action;
  switch(action){
    case'start-game':screen='game';modal=null;if(!Object.keys(layout.cells).length)phone=true;render();break;
    case'main-menu':modal='return-menu';drag=null;hoverPoint=null;render();$('.return-dialog [autofocus]')?.focus();break;
    case'confirm-main-menu':generationRequest++;preparingCommission=false;screen='menu';phone=false;modal=null;hoverPoint=null;drag=null;persist();render();break;
    case'menu-settings':modal='settings';render();break;
    case'new-game':generationRequest++;preparingCommission=false;localStorage.setItem('paper-studio:previous-draft',JSON.stringify({level,layout,hints,submissions,campaignId}));archiveCurrentConversation();campaignId=createId();tutorialStage=0;guideDone=false;guideStep=0;seenLessons=[];loadGameLevel(createOpeningLevel(),{archive:false});break;
    case'close-settings':modal=null;render();break;
    case'undo':undo();break;case'redo':redo();break;
    case'furniture-tag':modal='furniture-tag';render();break;
    case'rotate':rotateCurrent();break;
    case'tutorial':contentLessons=lessonsForLevel(level,{includeSeen:true});lessonIndex=0;guideStep=0;manualGuide=true;phone=false;modal=null;render();break;
    case'lesson-back':lessonIndex=Math.max(0,lessonIndex-1);render();break;
    case'lesson-next':seenLessons=completeLessons(seenLessons,[contentLessons[lessonIndex]]);if(++lessonIndex>=contentLessons.length){contentLessons=[];lessonIndex=0;manualGuide=false;guideStep=null;}persist();render();break;
    case'lesson-skip':seenLessons=completeLessons(seenLessons,contentLessons);contentLessons=[];lessonIndex=0;manualGuide=false;guideStep=null;persist();render();break;
    case'opening-guide-ok':guideStep=null;manualGuide=false;render();break;
    case'guide-next':if(guideStep===GUIDE.length-1){guideStep=null;guideDone=true;persist();}else guideStep++;render();break;
    case'guide-back':guideStep=Math.max(0,guideStep-1);render();break;
    case'guide-skip':guideStep=null;manualGuide=false;guideDone=true;persist();render();break;
    case'clear-range':inspectedRule=null;render();break;
    case'dismiss-portrait-hint':portraitHintDismissed=true;render();break;
    case'toggle-requirements':showRequirements=!showRequirements;render();break;
    case'palette-left':$('.tool-options').scrollBy({left:-300,behavior:'smooth'});break;
    case'palette-right':$('.tool-options').scrollBy({left:300,behavior:'smooth'});break;
    case'toggle-palette':mobilePaletteOpen=!mobilePaletteOpen;render();break;
    case'game-menu':modal='game-menu';drag=null;hoverPoint=null;render();break;
    case'past-commissions':$('.chat').scrollTop=0;break;
    case'phone':phone=!phone;render();break;case'close-phone':phone=false;render();break;
    case'help':modal='help';render();break;
    case'close-modal':modal=null;render();break;
    case'close-history':modal=null;viewingCommission=null;chatScroll=$('.chat')?.scrollTop??chatScroll;render();break;
    case'next-task':{
      if(preparingCommission||!submissions.at(-1)?.passed||!evaluateLayout(level,layout).complete)return;
      preparingCommission=true;const request=++generationRequest,previousId=level.id,previousCampaign=campaignId;render();
      try{
        const avoidFingerprints=[level.generationFingerprint,...history.filter(h=>(h.campaignId||'legacy')===campaignId).map(h=>h.level?.generationFingerprint)].filter(Boolean);
        const recentStructures=[...history.filter(h=>(h.campaignId||'legacy')===campaignId).map(h=>h.level),level].filter(item=>item?.reference).slice(-8).map(describeStructure);
        const next=await generateCommission((level.chapter||1)+1,{avoidFingerprints,recentStructures,variationSeed:campaignId});
        if(request===generationRequest&&screen==='game'&&level.id===previousId&&campaignId===previousCampaign)loadGameLevel(next);
      }catch{if(request===generationRequest)toast('新委托暂未准备好，当前图纸已保存，请重试。');}
      finally{if(request===generationRequest){preparingCommission=false;render();}}
      break;
    }
    case'submit':submit();break;
    case'hint':{
      if(hints<=0||attempt.completed)return;
      const helpedRoomName=level.rooms.find(r=>r.id===selectedRoom)?.name;
      const result=hintRoom(level,layout,selectedRoom);if(result.error){toast(result.error);break;}
      if(JSON.stringify(result.layout)===JSON.stringify(layout)){toast('这个房间已经与参考布局一致，请先在工具带选择另一个房间');break;}
      const helped=recordHint(attempt);if(helped.error){toast(helped.error);break;}attempt=helped.attempt;hints=3-attempt.hintsUsed;playtest.record('hint');commit(result.layout);toast(`林工补画了${helpedRoomName}，剩余${hints}次求助`);break;
    }
    case'zoom-in':setZoom(zoom+.15);break;case'zoom-out':setZoom(zoom-.15);break;case'zoom-reset':pan={x:0,y:0};zoom=1;viewNeedsFit=true;syncView();break;
  }
});
let cameraFrame=0;
let previousBoardSize=null;
const cameraResize=new ResizeObserver(entries=>{const r=entries[0]?.contentRect;if(r&&previousBoardSize&&(r.width!==previousBoardSize.width||r.height!==previousBoardSize.height))interruptBoard('resize');if(r)previousBoardSize={width:r.width,height:r.height};syncView();});
window.matchMedia('(orientation: portrait)').addEventListener('change',()=>{if(window.innerWidth<=1100){interruptBoard('orientation');viewNeedsFit=true;syncView();}});
function syncView(){
  cameraFrame=0;syncRequirementsScroll();const svg=$('#blueprint');if(!svg)return;
  const r=svg.getBoundingClientRect();if(!r.width||!r.height)return;
  const b=bounds(level.outline);
  if(viewNeedsFit){if(window.matchMedia('(max-width:600px), (max-width:1100px) and (max-height:600px)').matches)zoom=clampZoom(Math.max(level.rooms.length>=6?.65:.4,Math.min(1,(r.width-36)/(b.w*GRID_PIXELS),(r.height-64)/(b.h*GRID_PIXELS))));viewNeedsFit=false;}
  const v=cameraBox(r,{x:b.x+b.w/2,y:b.y+b.h/2},pan,zoom);
  for(const layer of [svg,$('#paper-grid')])layer?.setAttribute('viewBox',`${v.x} ${v.y} ${v.w} ${v.h}`);
  const grid=$('#map-grid');if(grid)for(const [key,value]of Object.entries({x:v.x,y:v.y,width:v.w,height:v.h}))grid.setAttribute(key,value);
  const labelSize=Math.max(.29,14/(GRID_PIXELS*zoom));
  svg.style.setProperty('--room-font',labelSize+'px');svg.style.setProperty('--area-font',Math.max(.25,12/(GRID_PIXELS*zoom))+'px');
  for(const label of svg.querySelectorAll('.room-label')){const lines=label.querySelectorAll('text');lines[1].setAttribute('y',Number(lines[0].getAttribute('y'))+labelSize*1.2);}
  const meter=$('.scale-mark i');if(meter)meter.style.width=(GRID_PIXELS*zoom)+'px';
  const percent=$('[data-action="zoom-reset"]');if(percent)percent.textContent=Math.round(zoom*100)+'%';
}
function queueView(){if(!cameraFrame)cameraFrame=requestAnimationFrame(syncView);}
function setZoom(value,client){
  const next=clampZoom(value),svg=$('#blueprint');
  if(client&&svg){const r=svg.getBoundingClientRect();pan=zoomedPan(pan,{x:client.x-r.x-r.width/2,y:client.y-r.y-r.height/2},zoom,next);}
  zoom=next;hoverPoint=null;const preview=$('#drawing-preview');if(preview)preview.innerHTML='';syncView();
}
function startPan(event,svg){
  drag={mode:'pan',pointerId:event.pointerId,client:{x:event.clientX,y:event.clientY},origin:{...pan},zoom};
  svg.setPointerCapture(event.pointerId);svg.classList.add('panning');event.preventDefault();
}
function movePan(event){
  pan=draggedPan(drag.origin,{x:event.clientX-drag.client.x,y:event.clientY-drag.client.y},drag.zoom);queueView();
}
function svgPoint(event){const svg=$('#blueprint'),p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
function closestEdge(p){
  let nearest=null,best=Math.max(.18,18/(GRID_PIXELS*zoom));
  for(const segment of level.geometry?.segments||[]){const{a,b}=segment,dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy))),distance=Math.hypot(p.x-a[0]-t*dx,p.y-a[1]-t*dy);if(distance<best){best=distance;nearest=segment.key;}}
  const x=Math.floor(p.x),y=Math.floor(p.y),dx=p.x-x,dy=p.y-y;const min=Math.min(dx,1-dx,dy,1-dy);const regular=min===dx?edgeKey('v',x,y):min===1-dx?edgeKey('v',x+1,y):min===dy?edgeKey('h',x,y):edgeKey('h',x,y+1),info=edgeInfo(level,layout,regular);return nearest&&(!(info.boundary||info.internal||info.fixed)||best<min)?nearest:regular;}
function rectangle(a,b){const ax=Math.floor(a.x),ay=Math.floor(a.y),bx=Math.floor(b.x),by=Math.floor(b.y);return{x:Math.min(ax,bx),y:Math.min(ay,by),w:Math.abs(ax-bx)+1,h:Math.abs(ay-by)+1};}
function placementCandidate(p,id){return placementIdentity(level,layout,{id,kind:selectedObject,x:Math.floor(p.x),y:Math.floor(p.y),rotation},pendingTag);}
function placeFurnitureAt(p){const identity=placementCandidate(p,'user-'+createId());return identity.error?identity:placeObject(level,layout,identity.object);}
function showPlacementPreview(p){
  const node=$('#drawing-preview');if(!node)return;
  const identity=placementCandidate(p,'__placement-preview__'),object=identity.object||{id:'__placement-preview__',kind:selectedObject,x:Math.floor(p.x),y:Math.floor(p.y),rotation};
  const result=identity.error?identity:placeObject(level,layout,object),valid=!!result.layout;
  node.innerHTML=`<g pointer-events="none">${footprintSVG(object,{fill:valid?'#74a471':'#d78276',stroke:valid?'#497b45':'#b05f54',width:.055,dash:'.12 .07',opacity:.2})}<g opacity=".8">${furnitureSVG(object.kind,object.x,object.y,rotation)}${instanceBadgeSVG(object)}</g>${usagePreviewSVG(level,result.layout||layout,object)}</g>`;
  if($('#placement-status'))$('#placement-status').textContent=valid?`${instanceName(object)} · ${rotation}° · 左键放下 / 右键转向`:result.error+' · 右键 / R 可转向';
}
function rotateCurrent(){
  gameAudio.play('place');
  if(drag?.object){
    drag.object={...drag.object,rotation:((drag.object.rotation||0)+90)%360};
    const b=bounds(footprint(drag.object));drag.offset={x:Math.min(drag.offset.x,b.w-1),y:Math.min(drag.offset.y,b.h-1)};
    previewAt(drag.last);return;
  }
  const selected=selectedFurniture();
  if(selected&&tool==='hand'){
    const result=rotateObject(level,layout,selected.id);if(result.error){toast('无法在当前位置转向：'+result.error);return;}commit(result.layout);toast(`${OBJECTS[selected.kind].name}已转向${((selected.rotation||0)+90)%360}°`);return;
  }
  if(tool==='object'){rotation=(rotation+90)%360;render();return;}
  toast('先选底部的家具，或用抓手点选图上的家具，再转向');
}
function previewAt(p){
  if(!drag)return;drag.last=p;const node=$('#drawing-preview');if(!node)return;
  if(drag.mode==='object'){hoverPoint=p;showPlacementPreview(p);return;}
  if(drag.mode==='room'||drag.mode==='eraser'){
    const r=rectangle(drag.start,p),room=level.rooms.find(r=>r.id===selectedRoom);
    const actualArea=level.outline.filter(c=>{const[x,y]=point(c);return x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h;}).reduce((sum,c)=>sum+cellArea(level,c),0);
    node.innerHTML=`<rect clip-path="url(#plot-clip)" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${drag.mode==='eraser'?'#cf7767':room.color}" opacity=".65" stroke="${drag.mode==='eraser'?'#9b4d41':'#4b6750'}" stroke-width=".05" stroke-dasharray=".12 .08"/><text x="${r.x+r.w/2}" y="${r.y+r.h/2+.1}" font-size=".4" text-anchor="middle" fill="#374633">${actualArea}㎡</text>`;
  }else if(['door','window','open'].includes(drag.mode)){
    drag.edges.add(closestEdge(p));node.innerHTML=[...drag.edges].map(k=>{const{axis,x,y}=edgeParts(k);return `<path d="${edgePath(k)}" stroke="#547758" stroke-width=".14" opacity=".65"/>`;}).join('');
  }else if(drag.object){const object={...drag.object,x:Math.floor(p.x)-drag.offset.x,y:Math.floor(p.y)-drag.offset.y},valid=!!placeObject(level,layout,object).layout;node.innerHTML=`${footprintSVG(object,{fill:valid?'#74a471':'#d78276',stroke:valid?'#497b45':'#b05f54',opacity:.2})}<g opacity=".75">${furnitureSVG(object.kind,object.x,object.y,object.rotation)}${instanceBadgeSVG(object)}</g>${usagePreviewSVG(level,layout,object)}`;}
}
function finish(event){
  if(!drag||drag.pointerId!==event.pointerId)return;if(drag.mode==='pan'){movePan(event);drag=null;$('#blueprint')?.classList.remove('panning');syncView();return;}if(drag.object&&event.button===2)return;const current=drag;drag=null;const p=svgPoint(event);let result;
  if(current.mode==='object'){hoverPoint=null;result=placeFurnitureAt(p);}
  else if(current.mode==='room')result=paintRoom(level,layout,selectedRoom,rectangle(current.start,p));
  else if(current.mode==='eraser')result={layout:eraseRect(level,layout,rectangle(current.start,p),eraseFilter)};
  else if(['door','window','open'].includes(current.mode)){
    current.edges.add(closestEdge(p));let next=layout,error='';for(const key of current.edges){const item=placeBoundary(level,next,key,current.mode);if(item.layout)next=item.layout;else error=item.error;}
    result=next===layout?{error}:{layout:next};
  }else if(current.object)result=placeObject(level,layout,{...current.object,x:Math.floor(p.x)-current.offset.x,y:Math.floor(p.y)-current.offset.y});
  else if(current.mode==='hand'){pan.x+=p.x-current.start.x;pan.y+=p.y-current.start.y;render();return;}
  if(result?.error){gameAudio.play('error');toast(result.error);render();}else if(result?.layout)commit(result.layout,current.mode);else render();
}
function syncRequirementsScroll(){
  const list=$('.requirements'),track=$('.requirements-scrollbar');if(!list||!track)return;
  const maximum=Math.max(0,list.scrollHeight-list.clientHeight);
  track.hidden=list.hidden||maximum<=0;
  if(track.hidden)return;
  const height=list.clientHeight,thumbHeight=Math.min(height,Math.max(32,height*height/list.scrollHeight));
  track.style.left=(list.offsetLeft-4)+'px';track.style.top=list.offsetTop+'px';track.style.height=height+'px';
  const thumb=track.firstElementChild;
  thumb.style.height=thumbHeight+'px';thumb.style.transform=`translateY(${list.scrollTop/maximum*(height-thumbHeight)}px)`;
  track.setAttribute('aria-valuemax',Math.round(maximum));track.setAttribute('aria-valuenow',Math.round(list.scrollTop));
}
function bindRequirementsScroll(){
  const list=$('.requirements'),track=$('.requirements-scrollbar');let moving=null;
  list.addEventListener('scroll',syncRequirementsScroll,{passive:true});
  track.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    event.preventDefault();event.stopPropagation();track.focus();
    const thumb=track.firstElementChild,r=track.getBoundingClientRect(),height=thumb.getBoundingClientRect().height;
    const maximum=list.scrollHeight-list.clientHeight,travel=r.height-height;
    if(travel<=0)return;
    if(event.target!==thumb)list.scrollTop=Math.max(0,Math.min(maximum,(event.clientY-r.top-height/2)/travel*maximum));
    moving={id:event.pointerId,y:event.clientY,scroll:list.scrollTop,maximum,travel};track.setPointerCapture(event.pointerId);syncRequirementsScroll();
  });
  track.addEventListener('pointermove',event=>{if(moving?.id!==event.pointerId)return;event.preventDefault();event.stopPropagation();list.scrollTop=moving.scroll+(event.clientY-moving.y)/moving.travel*moving.maximum;syncRequirementsScroll();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])track.addEventListener(type,event=>{if(moving?.id===event.pointerId){moving=null;event.stopPropagation();}});
  track.addEventListener('keydown',event=>{
    const steps={ArrowUp:-40,ArrowDown:40,PageUp:-list.clientHeight,PageDown:list.clientHeight,Home:-list.scrollHeight,End:list.scrollHeight};
    if(!(event.key in steps))return;event.preventDefault();event.stopPropagation();list.scrollTop+=steps[event.key];syncRequirementsScroll();
  });
}
function bindBoard(){
  const svg=$('#blueprint'),surface=svg.closest('.canvas-wrap');
  const isInterface=target=>!!target.closest('.requirements,.requirements-scrollbar,button,.tutorial-anchor,.range-explanation,.portrait-hint');
  surface.addEventListener('contextmenu',event=>{if(!isInterface(event.target))event.preventDefault();});
  surface.addEventListener('pointerdown',event=>{
    if(isInterface(event.target)||phone||modal||event.button!==0&&event.button!==1&&event.button!==2)return;
    if(event.pointerType==='touch'){
      if(gestures.phase==='camera'){
        if(!pinch){const r=svg.getBoundingClientRect();pinch=beginTouchCamera(gestures.points,pan,zoom,{x:r.x+r.width/2,y:r.y+r.height/2});drag=null;hoverPoint=null;$('#drawing-preview').innerHTML='';}
        svg.classList.add('panning');svg.setPointerCapture(event.pointerId);event.preventDefault();return;
      }
      if(!gestures.canDraw(event.pointerId)){event.preventDefault();return;}
    }
    if(event.button===1){startPan(event,svg);return;}
    const p=svgPoint(event),objectId=event.target.closest('[data-object-id]')?.dataset.objectId;
    if(event.button===0&&tool==='hand'&&!objectId){selectedId=null;startPan(event,svg);return;}
    if(event.button===2&&drag?.object){event.preventDefault();rotateCurrent();return;}
    if(event.button===2&&tool==='hand'&&objectId){event.preventDefault();selectedId=objectId;rotateCurrent();return;}
    if(tool==='object'&&event.button===2){event.preventDefault();hoverPoint=p;rotateCurrent();return;}
    if(tool==='object'&&event.button===0){
      if(event.pointerType==='touch'){drag={mode:'object',pointerId:event.pointerId,start:p,last:p};hoverPoint=p;svg.setPointerCapture(event.pointerId);event.preventDefault();showPlacementPreview(p);return;}
      const result=placeFurnitureAt(p);
      if(result.error){gameAudio.play('error');toast(result.error);}else{hoverPoint=null;commit(result.layout,'object');}return;
    }
    const mode=event.button===1?'hand':event.button===2?'eraser':tool;
    const original=mode==='hand'&&layout.objects.find(o=>o.id===objectId),object=original?clone(original):null;
    if(mode==='hand'){
      selectedId=object?.id||null;
      if(object)selectedRoom=objectRoom(layout,object)||selectedRoom;
    }
    drag={mode,pointerId:event.pointerId,start:p,last:p,edges:new Set(),object,offset:object?{x:Math.floor(p.x)-object.x,y:Math.floor(p.y)-object.y}:null};
    if(['door','window','open'].includes(mode))drag.edges.add(closestEdge(p));
    svg.setPointerCapture(event.pointerId);event.preventDefault();previewAt(p);
  });
  surface.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch'){
      if(pinch&&gestures.phase==='camera'){const next=updateTouchCamera(pinch,gestures.points);pan=next.pan;zoom=next.zoom;queueView();return;}
      if(!gestures.canDraw(event.pointerId))return;
    }
    if(drag&&drag.pointerId!==event.pointerId)return;
    if(!drag&&isInterface(event.target)){hoverPoint=null;$('#drawing-preview').innerHTML='';return;}
    if(drag?.mode==='pan'){movePan(event);return;}
    const p=svgPoint(event);if(drag)previewAt(p);else if(tool==='object'){hoverPoint=p;showPlacementPreview(p);}
  });
  surface.addEventListener('pointerleave',()=>{if(!drag){hoverPoint=null;$('#drawing-preview').innerHTML='';}});
  surface.addEventListener('pointerup',event=>{
    if(event.pointerType==='touch'&&!gestures.canDraw(event.pointerId)){pinch=null;drag=null;hoverPoint=null;$('#drawing-preview').innerHTML='';svg.classList.remove('panning');return;}
    finish(event);
  });
  surface.addEventListener('lostpointercapture',event=>{if(gestures.has(event.pointerId)||drag?.pointerId===event.pointerId)interruptBoard('capture');});
  surface.addEventListener('auxclick',event=>{if(event.button===1)event.preventDefault();});
  surface.addEventListener('wheel',event=>{
    if(phone||modal||drag)return;
    if(event.target.closest('.tutorial-anchor,.range-explanation,.portrait-hint,.zoom-controls,.requirements-toggle'))return;
    const list=$('.requirements'),r=list?.getBoundingClientRect();
    // List scrolling wins inside its rectangle even when the plan is above it.
    if(list&&!list.hidden&&r&&(event.target.closest('.requirements-scrollbar')||event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom)){
      event.preventDefault();
      const unit=event.deltaMode===1?20:event.deltaMode===2?list.clientHeight:1;
      list.scrollTop+=event.deltaY*unit;
      return;
    }
    if(isInterface(event.target))return;
    event.preventDefault();setZoom(zoom*Math.exp(-event.deltaY*.0015),{x:event.clientX,y:event.clientY});
  },{passive:false});
}
function interruptBoard(reason){
  if(drag||pinch){playtest.record('interruption');hoverPoint=null;}
  gestures.interrupt();pinch=null;drag=null;
  const svg=$('#blueprint');svg?.classList.remove('panning');
  const preview=$('#drawing-preview');if(preview)preview.innerHTML='';
}
for(const type of ['pointerdown','keydown','wheel'])document.addEventListener(type,()=>playtest.interact(),{capture:true,passive:true});
document.addEventListener('pointerdown',event=>{
  if(event.pointerType!=='touch')return;
  const eligible=screen==='game'&&!phone&&!modal&&!!event.target.closest('.canvas-wrap')&&!event.target.closest('.requirements,.requirements-scrollbar,button,.tutorial-anchor,.range-explanation,.portrait-hint');
  const phase=gestures.down(event.pointerId,{x:event.clientX,y:event.clientY},eligible);
  if(phase==='blocked')interruptBoard('interface');
},{capture:true});
document.addEventListener('pointermove',event=>{if(event.buttons||event.pointerType==='touch')playtest.interact();if(event.pointerType==='touch')gestures.move(event.pointerId,{x:event.clientX,y:event.clientY});},{capture:true,passive:true});
document.addEventListener('pointerup',event=>{if(event.pointerType==='touch')gestures.up(event.pointerId);});
document.addEventListener('pointercancel',event=>{if(gestures.has(event.pointerId)||drag?.pointerId===event.pointerId){interruptBoard('cancel');gestures.cancel(event.pointerId);}},{capture:true});
window.addEventListener('blur',()=>{interruptBoard('blur');playtest.context(false);});
window.addEventListener('focus',()=>playtest.context(screen==='game'&&!modal&&!document.hidden));
document.addEventListener('visibilitychange',()=>{if(document.hidden)interruptBoard('hidden');playtest.context(screen==='game'&&!modal&&!document.hidden);});
window.addEventListener('pagehide',()=>{interruptBoard('pagehide');playtest.context(false);});
setInterval(()=>playtest.flush(),15000);
function changeVolume(event){const key=event.target.dataset.volume;if(!['musicVolume','effectsVolume'].includes(key))return false;settings[key]=Number(event.target.value)/100;gameAudio.update(settings);const output=document.querySelector(`[data-volume-value="${key}"]`);if(output)output.textContent=event.target.value+'%';persist();return true;}
document.addEventListener('input',changeVolume);
document.addEventListener('change',event=>{if(changeVolume(event)){if(event.target.dataset.volume==='effectsVolume')gameAudio.play('click');}else if(event.target.dataset.setting){settings[event.target.dataset.setting]=event.target.checked;persist();}});
document.addEventListener('keydown',event=>{
  if(screen!=='game')return;
  if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  if(event.key==='Escape'){if(modal){if(modal==='history')chatScroll=$('.chat')?.scrollTop??null;modal=null;viewingCommission=null;render();return;}phone=false;modal=null;drag=null;selectedId=null;hoverPoint=null;inspectedRule=null;render();return;}
  if(modal||phone)return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const step=30/(GRID_PIXELS*zoom);if(event.key==='ArrowLeft')pan.x+=step;if(event.key==='ArrowRight')pan.x-=step;if(event.key==='ArrowUp')pan.y+=step;if(event.key==='ArrowDown')pan.y-=step;syncView();return;}
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();return;}
  if(event.key==='1')tool=lastDrawTool;else if(event.key==='2')tool='eraser';else if(event.key==='3')tool='hand';else if(event.key.toLowerCase()==='r'){event.preventDefault();rotateCurrent();return;}else if(event.key.toLowerCase()==='a'){$('.tool-options').scrollBy({left:-300,behavior:'smooth'});return;}else if(event.key.toLowerCase()==='d'){$('.tool-options').scrollBy({left:300,behavior:'smooth'});return;}else return;
  render();
});
render();persist();
