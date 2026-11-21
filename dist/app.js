import {OBJECTS,clone,point,cellKey,edgeKey,edgeParts,allEdges,edgeInfo,boundaryKind,footprint,objectRoom,bounds,initialLayout,evaluateLayout,validateLevel,paintRoom,eraseRect,placeBoundary,placeObject} from './engine.js';
import {generateLevel,hintRoom} from './levels.js';

const $=selector=>document.querySelector(selector),esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORE='paper-studio:v1';
let saved={};try{saved=JSON.parse(localStorage.getItem(STORE)||'{}');}catch{}
let level,layout,undoStack=[],redoStack=[],tool='room',selectedRoom,selectedObject='bed',rotation=0,eraseFilter='all',hints=3,submissions=[],history=saved.history||[],phone=false,review=null,collapsed=new Set(),drag=null,pan={x:0,y:0},zoom=1,help=false,modal=null;
let taskIndex=saved.taskIndex||1;
try{if(saved.level&&validateLevel(saved.level).length===0){level=saved.level;layout=saved.layout;hints=saved.hints??3;submissions=saved.submissions||[];}}
catch{}
if(!level||!layout){level=generateLevel('第一份委托','intro');layout=initialLayout(level);}
selectedRoom=level.rooms[0].id;
function persist(){try{localStorage.setItem(STORE,JSON.stringify({level,layout,hints,submissions,history:history.slice(-50),taskIndex}));}catch{toast('浏览器存储不可用，当前图纸仍可继续编辑');}}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3200);}
function commit(next){if(JSON.stringify(layout)===JSON.stringify(next)){render();return;}undoStack.push(clone(layout));if(undoStack.length>80)undoStack.shift();redoStack=[];layout=next;review=null;persist();render();}
function startTask(seed,mode){
  try{const next=generateLevel(seed,mode);level=next;layout=initialLayout(level);selectedRoom=level.rooms[0].id;undoStack=[];redoStack=[];hints=3;submissions=[];review=null;collapsed=new Set();pan={x:0,y:0};zoom=1;tool='room';taskIndex++;phone=false;modal=null;persist();render();toast('新委托已准备好');}catch(error){toast(error.message);}
}
function icon(kind,extra=''){
  const base='fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
  const shapes={
    room:'<path d="M4 19V5h16v14H4Z"/><path d="M8 5v14M4 10h4"/>',eraser:'<path d="m4 14 9-10 7 6-9 10H8l-4-4zM9 9l7 6M11 20h10"/>',hand:'<path d="M7 12V8a2 2 0 0 1 4 0v4-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v8c0 5-3 7-7 7-3 0-4-2-6-4l-3-4a2 2 0 0 1 3-2l2 2"/>',
    door:'<path d="M5 21V3h14v18M5 21h14M5 3l11 4v14M13 13h.1"/>',window:'<path d="M3 8h18M3 16h18M5 8v8M19 8v8M3 12h18"/>',open:'<path d="M2 8v8M22 8v8M3 12h5m8 0h5" stroke-dasharray="2 3"/>',
    object:'<path d="M4 20V9h16v11M2 20h20M6 9V4h12v5M4 15h16"/>',undo:'<path d="M4 9h10a6 6 0 0 1 0 12M4 9l5-5M4 9l5 5"/>',redo:'<path d="M20 9H10a6 6 0 0 0 0 12M20 9l-5-5M20 9l-5 5"/>',
    rotate:'<path d="M20 9a8 8 0 1 0-1 9M20 4v5h-5"/>',phone:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4M11 19h2"/>',folder:'<path d="M3 7V4h7l2 3h9v14H3V7z"/>',download:'<path d="M12 3v13m-5-5 5 5 5-5M4 18v3h16v-3"/>',check:'<path d="m5 12 4 4 10-11"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v7M12 6h.01"/>',plus:'<path d="M12 4v16M4 12h16"/>'
  };
  return `<svg ${extra} viewBox="0 0 24 24" aria-hidden="true" ${base}>${shapes[kind]||shapes.object}</svg>`;
}
function furnitureSVG(kind,x,y,rotation=0,scale=1){
  const def=OBJECTS[kind],w=def.w,h=def.h;
  const shapes={
    bed:`<rect x=".08" y=".08" width="1.84" height="1.84" rx=".08"/><path d="M.08 .7h1.84M1 .12v.52"/><rect x=".2" y=".18" width=".65" height=".36" rx=".04"/><rect x="1.15" y=".18" width=".65" height=".36" rx=".04"/>`,
    singleBed:'<rect x=".08" y=".08" width=".84" height="1.84" rx=".07"/><path d="M.08 .65h.84"/><rect x=".2" y=".2" width=".6" height=".3" rx=".04"/>',
    sofa:'<rect x=".05" y=".1" width="1.9" height=".8" rx=".12"/><path d="M.3 .2v.62M1.7 .2v.62M.3 .34h1.4M1 .34v.5"/>',
    chair:'<rect x=".08" y=".08" width=".84" height=".84" rx=".12"/><path d="M.26 .2v.6M.74 .2v.6M.26 .3h.48"/>',
    table:'<rect x=".4" y=".3" width="1.2" height="1.4" rx=".08"/><path d="M.08 .55h.25v.35H.08zM.08 1.1h.25v.35H.08zM1.67 .55h.25v.35h-.25zM1.67 1.1h.25v.35h-.25zM.75 .05h.5v.2h-.5zM.75 1.75h.5v.2h-.5z"/>',
    stove:'<rect x=".1" y=".1" width=".8" height=".8" rx=".06"/><circle cx=".32" cy=".32" r=".12"/><circle cx=".68" cy=".32" r=".12"/><circle cx=".32" cy=".68" r=".12"/><circle cx=".68" cy=".68" r=".12"/>',
    sink:'<rect x=".08" y=".08" width=".84" height=".84" rx=".06"/><rect x=".22" y=".3" width=".56" height=".48" rx=".09"/><path d="M.5 .15v.26"/>',
    toilet:'<rect x=".23" y=".08" width=".54" height=".25" rx=".04"/><ellipse cx=".5" cy=".59" rx=".29" ry=".29"/><ellipse cx=".5" cy=".58" rx=".18" ry=".17"/>',
    shower:'<rect x=".08" y=".08" width=".84" height=".84" rx=".04"/><path d="M.15 .82.82 .15M.16 .18h.25v.13"/><circle cx=".7" cy=".7" r=".04"/>',
    wardrobe:'<rect x=".08" y=".08" width=".84" height="1.84"/><path d="M.08 1h.84M.4 .86h.2M.4 1.14h.2"/>',
    bathtub:'<rect x=".08" y=".08" width=".84" height="1.84" rx=".4"/><rect x=".2" y=".24" width=".6" height="1.45" rx=".3"/>'
  };
  const rw=rotation%180?h:w;
  const tr=rotation===90?`translate(${h} 0) rotate(90)`:rotation===180?`translate(${w} ${h}) rotate(180)`:rotation===270?`translate(0 ${w}) rotate(270)`:'';
  return `<g transform="translate(${x} ${y}) scale(${scale})" class="furniture"><g transform="${tr}" fill="#fffdf3" stroke="#5a6058" stroke-width=".035" stroke-linejoin="round">${shapes[kind]||''}</g></g>`;
}
function objectIcon(kind){return `<svg viewBox="0 0 2.4 2.4" aria-hidden="true">${furnitureSVG(kind,.15,.15,0,.95)}</svg>`;}
function groupsHTML(check){
  return [{id:'global',name:'整屋要求',color:'#56634f'},...level.rooms].map(room=>{
    const items=check.results.filter(r=>r.group===room.id),count=items.filter(r=>r.ok).length,done=count===items.length,closed=collapsed.has(room.id);
    return `<section class="require-group ${done?'done':''}"><button class="group-head" data-collapse="${room.id}" aria-expanded="${!closed}"><span class="fold ${closed?'closed':''}">⌄</span><span class="swatch" style="--room:${room.color}"></span><span>${esc(room.name)}</span><span class="group-count">${count}/${items.length}</span></button>${closed?'':`<ul>${items.map(r=>`<li class="${r.ok?'met':''}"><span class="condition-icon">${r.ok?'✓':'·'}</span><span>${esc(r.text)}</span>${r.ok?'':`<small title="当前值">${esc(r.actual)}</small>`}</li>`).join('')}</ul>`}</section>`;
  }).join('');
}
function boardHTML(){
  const b=bounds(level.outline),pad=.7;let svg='';
  for(const cell of level.outline){const[x,y]=point(cell),room=level.rooms.find(r=>r.id===layout.cells[cell]);svg+=`<rect x="${x}" y="${y}" width="1" height="1" fill="${room?.color||'#faf8ee'}"/>`;}
  // Grid remains visible above room fills.
  for(const cell of level.outline){const[x,y]=point(cell);svg+=`<rect x="${x}" y="${y}" width="1" height="1" fill="none" stroke="#838674" stroke-opacity=".16" stroke-width=".015"/>`;}
  for(const key of allEdges(level)){
    const {axis,x,y}=edgeParts(key),info=edgeInfo(level,layout,key),item=layout.edges[key],kind=boundaryKind(level,layout,key);
    if(!info.outer&&(!info.rooms.some(Boolean)||info.rooms[0]===info.rooms[1]))continue;
    const line=(color,width,dash='')=>`<path d="M${x} ${y} ${axis==='h'?'h1':'v1'}" stroke="${color}" stroke-width="${width}" fill="none" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
    if(kind==='open'){svg+=line('#faf8ee',.09);continue;}
    svg+=line('#474d40',info.outer?.085:.055);
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
  for(const room of level.rooms){
    const cells=Object.keys(layout.cells).filter(c=>layout.cells[c]===room.id);if(!cells.length)continue;
    const rb=bounds(cells),cx=rb.x+rb.w/2,cy=rb.y+rb.h/2;
    // Labels move toward a free cell if the bounding-box center falls outside a concave room.
    const occupied=new Set(layout.objects.flatMap(footprint));const free=cells.filter(c=>!occupied.has(c)&&point(c)[1]<rb.y+rb.h-1);
    const nearest=[...(free.length?free:cells)].sort((a,b)=>{const[p,q]=point(a),[u,v]=point(b);return (p+.5-cx)**2+(q+.5-cy)**2-((u+.5-cx)**2+(v+.5-cy)**2);})[0];
    const [lx,ly]=point(nearest);svg+=`<g class="room-label" pointer-events="none"><text x="${lx+.5}" y="${ly+.42}" text-anchor="middle">${esc(room.name)}</text><text class="area-label" x="${lx+.5}" y="${ly+.8}" text-anchor="middle">${cells.length}㎡</text></g>`;
  }
  for(const object of layout.objects)svg+=`<g data-object-id="${esc(object.id)}">${furnitureSVG(object.kind,object.x,object.y,object.rotation)}</g>`;
  svg+='<g id="drawing-preview" pointer-events="none"></g>';
  return `<svg id="blueprint" viewBox="${b.x-pad-pan.x} ${b.y-pad-pan.y} ${(b.w+pad*2)/zoom} ${(b.h+pad*2)/zoom}" role="img" aria-label="户型图纸，当前使用${toolLabel()}工具"><g>${svg}</g></svg>`;
}
function toolLabel(){return {room:'画房间',eraser:'橡皮',hand:'抓手',door:'门',window:'窗',open:'开放连接',object:OBJECTS[selectedObject].name}[tool];}
function toolbarHTML(){
  const tabs=[['room','房间','1'],['door','门',''],['window','窗',''],['open','开放连接',''],['object','家具','']];
  let options='';
  if(tool==='room')options=level.rooms.map(r=>`<button data-room="${r.id}" class="room-chip ${selectedRoom===r.id?'active':''}" style="--room:${r.color}">${esc(r.name)}</button>`).join('');
  else if(tool==='object')options=Object.entries(OBJECTS).map(([key,def])=>`<button data-object="${key}" class="object-chip ${selectedObject===key?'active':''}">${objectIcon(key)}<span>${def.name}</span></button>`).join('');
  else if(tool==='eraser')options=[['all','全部'],['room','仅房间'],['edge','仅门窗与连接'],['object','仅家具']].map(([key,label])=>`<button class="filter ${eraseFilter===key?'active':''}" data-filter="${key}">${label}</button>`).join('');
  else options=`<p class="tool-description">${{door:'点击墙边放门：外墙为入户门，公共墙为室内门。',window:'点击外墙放窗。蓝色斜纹窗是固定元素。',open:'沿两个房间的公共墙点击或拖动，移除隔墙。',hand:'拖动家具调整位置，拖动空白处平移图纸。'}[tool]||''}</p>`;
  return `<div class="toolbelt"><div class="tool-main"><div class="tool-modes">${[['room','铅笔','1'],['eraser','橡皮','2'],['hand','抓手','3']].map(([key,label,hotkey])=>`<button class="mode-button ${tool===key||key==='room'&&['door','window','open','object'].includes(tool)?'active':''}" data-tool="${key}" title="${label}（${hotkey}）">${icon(key)}<span>${label}</span><kbd>${hotkey}</kbd></button>`).join('')}</div><span class="belt-divider"></span><div class="type-tabs">${tabs.map(([key,label])=>`<button data-tool="${key}" class="type-tab ${tool===key?'active':''}">${icon(key)}<span>${label}</span></button>`).join('')}</div><button class="rotate-button" data-action="rotate" ${tool!=='object'?'disabled':''} title="旋转（R）">${icon('rotate')}<span>旋转 ${rotation}°</span></button></div><div class="tool-options">${options}</div></div>`;
}
function phoneHTML(){
  if(!phone)return '';
  const passed=review?.passed;
  return `<div class="phone-shade" data-action="close-phone"></div><aside class="phone" aria-label="任务手机"><div class="phone-speaker"></div><div class="phone-status"><span>纸上事务所</span><span>●●● ▰</span></div><div class="phone-title"><div class="avatar">林</div><div><strong>林工</strong><small>设计部 · 项目委托</small></div><button class="icon-button" data-action="close-phone" aria-label="收起手机">${icon('close')}</button></div><div class="chat"><div class="message incoming">新委托已经发给你。先看需求，图纸画好后交给我审核。</div><div class="attachment"><small>设计需求 · ${esc(level.seed)}</small><strong>${esc(level.title)}</strong><p>${level.rooms.length}个房间 · ${level.rules.length}项要求</p><button data-action="close-phone">查看图纸</button></div>${submissions.map(s=>`<div class="message outgoing">设计稿 v${s.version}<small>${s.passed?'审核通过':'已提交审核'}</small></div><div class="message incoming ${s.passed?'success-message':''}">${s.passed?'<div class="stars">★★★</div>方案通过，所有条件都满足了。':esc(s.reason)}<small>${s.complete}/${s.total} 项要求满足</small></div>`).join('')}${passed?`<button class="primary next-task" data-action="next-task">领取下一份委托</button>`:''}</div><div class="phone-compose"><button class="submit-design primary" data-action="submit">提交设计稿</button><button class="hint-button" data-action="hint" ${hints<=0?'disabled':''}>求助 ${hints}/3</button><p>主动提交后审核 · 原型暂以全部满足评为三星</p></div></aside>`;
}
function modalHTML(){
  if(!modal)return '';
  if(modal==='tasks')return `<div class="modal-shade"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button><span class="eyebrow">下一张图纸</span><h2 id="modal-title">一份新的空间谜题</h2><p>相同委托编号会得到相同任务。新任务会替换当前图纸，请先导出需要保留的草稿。</p><label>委托编号<input id="seed-input" maxlength="80" value="${esc('委托-'+(taskIndex+1))}" autocomplete="off"></label><label>任务规模<select id="mode-input"><option value="intro">入门 · 3个房间</option><option value="standard" ${level.mode==='standard'?'selected':''}>常规 · 6个房间</option><option value="complex" ${level.mode==='complex'?'selected':''}>复杂 · 9个房间</option></select></label><div class="modal-actions"><button data-action="random-seed">换个编号</button><button class="primary" data-action="generate">接下委托</button></div><small class="modal-note">当前生成器基于可控分区模板，验证有解；题目丰富度与难度仍在迭代。</small></section></div>`;
  if(modal==='history')return `<div class="modal-shade"><section class="modal" role="dialog" aria-modal="true" aria-label="项目档案"><button class="modal-close icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button><span class="eyebrow">已完成的委托</span><h2>项目档案</h2>${history.length?`<div class="history-list">${[...history].reverse().map((h,i)=>`<button data-history="${history.length-1-i}"><span><strong>${esc(h.title)}</strong><small>${esc(h.seed)} · ${h.rooms}个房间</small></span><span class="stars">★★★</span></button>`).join('')}</div>`:'<p>完成第一份委托后，图纸会保存在这里。</p>'}<p class="modal-note">点击档案导出当时的图纸；当前草稿不会被替换。</p></section></div>`;
  if(modal==='help')return `<div class="modal-shade"><section class="modal help-modal" role="dialog" aria-modal="true" aria-label="绘图指南"><button class="modal-close icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button><span class="eyebrow">事务所工作手册</span><h2>从读图，到落笔</h2><ol><li><strong>先读条件。</strong> 每个房间的面积、门窗和家具要求会实时划掉。点标题折叠分组。</li><li><strong>拖出房间。</strong> 选择房间后拖出矩形；紧贴追加可形成不规则房间。每格1㎡。</li><li><strong>连接空间。</strong> 在墙边放门、窗或开放连接。门和开放连接都能让房间通达入口。</li><li><strong>摆放家具。</strong> 选择家具后点击放下，R或右键旋转；抓手可拖动。家具须完整位于一个房间。</li><li><strong>理解方位。</strong> 南北沿参考家具的宽度延伸，东西沿高度延伸；目标一格进入条带即可，范围跨越房间。</li><li><strong>交付图纸。</strong> 打开手机主动提交。求助会补画所选房间并消耗一次，撤销不返还次数。</li></ol><div class="shortcut-row"><kbd>1</kbd>铅笔 <kbd>2</kbd>橡皮 <kbd>3</kbd>抓手 <kbd>R</kbd>旋转 <kbd>⌘Z</kbd>撤销</div><p class="modal-note">当前是开发原型：家具采用整格吸附，窗仅置于外墙，区域覆盖需先擦除，评分暂为全满足三星。其余原作细节仍在核验。</p></section></div>`;
  return '';
}
function render(){
  const check=evaluateLayout(level,layout),done=check.results.filter(r=>r.ok).length,percent=Math.round(done/check.results.length*100);
  const scroll=$('.requirements')?.scrollTop||0;
  $('#app').innerHTML=`<div class="studio"><header class="topbar"><div class="brand"><span class="brand-mark">纸</span><div><strong>纸上事务所</strong><small>让每一平方米，各得其所。</small></div></div><div class="task-label"><span>项目委托</span><strong>${esc(level.seed)}</strong><span class="prototype-tag">开发原型</span></div><nav><button data-action="history">${icon('folder')}<span>项目档案</span></button><button data-action="tasks">${icon('plus')}<span>新委托</span></button><button class="icon-button" data-action="help" aria-label="绘图指南">${icon('info')}</button></nav></header><main class="desk"><div class="paper"><aside class="requirements"><div class="requirements-heading"><span class="eyebrow">DESIGN BRIEF</span><h1>${esc(level.title)}</h1><p>${level.rooms.length}个房间，等待你的安排。</p><div class="progress-heading"><span>需求完成</span><strong>${done}<span> / ${check.results.length}</span></strong></div><div class="progress-track"><i style="width:${percent}%"></i></div></div>${groupsHTML(check)}<div class="brief-note">${esc(level.brief)}</div></aside><section class="drawing-area" aria-label="绘图工作台"><div class="paper-top"><span>住宅平面设计 <small>单位：m</small></span><div class="paper-actions"><button class="icon-button" data-action="undo" title="撤销（⌘Z）" ${undoStack.length?'':'disabled'} aria-label="撤销">${icon('undo')}</button><button class="icon-button" data-action="redo" title="重做（⌘⇧Z）" ${redoStack.length?'':'disabled'} aria-label="重做">${icon('redo')}</button><span></span><button class="icon-button" data-action="export" title="导出关卡和草稿" aria-label="导出草稿">${icon('download')}</button><label class="import-control" title="导入关卡或草稿">导入<input id="import-file" type="file" accept="application/json,.json"></label></div></div><div class="canvas-wrap">${boardHTML()}<div class="compass" aria-hidden="true"><span>北</span><div>西 <b>✥</b> 东</div><span>南</span></div><div class="scale-mark"><i></i><span>1m × 1m</span></div><div class="zoom-controls"><button data-action="zoom-out" aria-label="缩小">−</button><button data-action="zoom-reset" title="重置视图">${Math.round(zoom*100)}%</button><button data-action="zoom-in" aria-label="放大">＋</button></div></div><div class="drawing-footer"><span class="tool-status"><i></i>${toolLabel()}${tool==='room'?' · '+esc(level.rooms.find(r=>r.id===selectedRoom).name):''}</span><span>${tool==='room'?'拖动绘制 · 右键拖动擦除':tool==='object'?'点击放置 · R / 右键旋转':tool==='hand'?'拖家具移动 · 拖空白平移':'点击或拖动墙边'}</span></div></section></div><div class="desk-bottom"><div class="desk-note"><span class="note-pin"></span><strong>图纸没问题，<br>还得住得进去。</strong><span>每一条线，都是一个决定。</span></div>${toolbarHTML()}<button class="phone-launch ${check.complete?'ready':''}" data-action="phone">${icon('phone')}<span><strong>${check.complete?'交付这张图纸':'联系林工'}</strong><small>${check.complete?'条件已满足，提交审核':'提交设计 / 求助 '+hints+'/3'}</small></span></button></div></main><footer class="app-footer"><span>已在本机自动保存</span><span>${check.errors.length?esc(check.errors[0]):'蓝色斜纹为固定窗 · 任意满足需求的布局都可提交'}</span><button data-action="help">操作指南</button></footer>${phoneHTML()}${modalHTML()}</div>`;
  if($('.requirements'))$('.requirements').scrollTop=scroll;
  bindBoard();
  const board=$('#blueprint'),scale=board.getScreenCTM()?.a||30,labelSize=Math.max(.28,14/scale);
  board.style.setProperty('--room-font',labelSize+'px');board.style.setProperty('--area-font',Math.max(.25,12/scale)+'px');
  for(const label of board.querySelectorAll('.room-label')){const lines=label.querySelectorAll('text');lines[1].setAttribute('y',Number(lines[0].getAttribute('y'))+labelSize*1.2);}
  if(phone){const chat=$('.chat');chat.scrollTop=chat.scrollHeight;}
}
function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function undo(){if(!undoStack.length)return;redoStack.push(clone(layout));layout=undoStack.pop();review=null;persist();render();}
function redo(){if(!redoStack.length)return;undoStack.push(clone(layout));layout=redoStack.pop();review=null;persist();render();}
function submit(){
  const check=evaluateLayout(level,layout),unmet=check.results.filter(r=>!r.ok),reason=check.errors[0]||(!Object.keys(layout.cells).length?'图纸还是空的，先规划房间吧。':`还有${unmet.length}项未满足：${unmet.slice(0,2).map(r=>r.text).join('；')}。`);
  const item={version:submissions.length+1,passed:check.complete,reason,complete:check.results.filter(r=>r.ok).length,total:check.results.length};submissions.push(item);review=item;
  if(check.complete&&!history.some(h=>h.id===level.id&&h.version===submissions.length)){history.push({id:level.id,version:submissions.length,title:level.title,seed:level.seed,rooms:level.rooms.length,level:clone(level),layout:clone(layout),at:new Date().toISOString()});}
  persist();render();
}
document.addEventListener('click',event=>{
  const collapse=event.target.closest('[data-collapse]');if(collapse){const id=collapse.dataset.collapse;collapsed.has(id)?collapsed.delete(id):collapsed.add(id);render();return;}
  const toolButton=event.target.closest('[data-tool]');if(toolButton){tool=toolButton.dataset.tool;render();return;}
  const room=event.target.closest('[data-room]');if(room){selectedRoom=room.dataset.room;tool='room';render();return;}
  const object=event.target.closest('[data-object]');if(object){selectedObject=object.dataset.object;tool='object';render();return;}
  const filter=event.target.closest('[data-filter]');if(filter){eraseFilter=filter.dataset.filter;render();return;}
  const historical=event.target.closest('[data-history]');if(historical){const h=history[+historical.dataset.history];download({format:'paper-studio-save',level:h.level,layout:h.layout},'纸上事务所-历史图纸.json');return;}
  const action=event.target.closest('[data-action]')?.dataset.action;
  switch(action){
    case'undo':undo();break;case'redo':redo();break;
    case'rotate':rotation=(rotation+90)%360;render();break;
    case'phone':phone=!phone;render();break;case'close-phone':phone=false;render();break;
    case'tasks':case'history':case'help':modal=action;render();break;
    case'close-modal':modal=null;render();break;
    case'random-seed':$('#seed-input').value='委托-'+Math.random().toString(36).slice(2,9).toUpperCase();break;
    case'generate':startTask($('#seed-input').value.trim()||'新委托',$('#mode-input').value);break;
    case'next-task':modal='tasks';phone=false;render();break;
    case'submit':submit();break;
    case'hint':{
      if(hints<=0)return;
      const result=hintRoom(level,layout,selectedRoom);if(result.error){toast(result.error);break;}
      if(JSON.stringify(result.layout)===JSON.stringify(layout)){toast('这个房间已经与参考布局一致，请先在工具带选择另一个房间');break;}
      hints--;commit(result.layout);toast(`林工补画了${level.rooms.find(r=>r.id===selectedRoom).name}，剩余${hints}次求助`);break;
    }
    case'export':download({format:'paper-studio-save',level,layout,hints,submissions},'纸上事务所-关卡与草稿.json');toast('关卡与草稿已导出');break;
    case'zoom-in':zoom=Math.min(2,zoom+.15);render();break;case'zoom-out':zoom=Math.max(.7,zoom-.15);render();break;case'zoom-reset':zoom=1;pan={x:0,y:0};render();break;
  }
});
document.addEventListener('change',async event=>{
  if(event.target.id!=='import-file')return;
  const file=event.target.files[0];if(!file)return;
  try{
    if(file.size>2_000_000)throw new Error('文件过大，请导入2MB以内的关卡');
    const data=JSON.parse(await file.text()),next=data.level||data,errors=validateLevel(next);
    if(errors.length)throw new Error(errors.join('；'));
    if(next.outline.length>900||next.rooms.length>30||next.rules.length>500)throw new Error('当前原型暂支持900格、30个房间、500项条件以内的任务');
    if(next.reference&&!evaluateLayout(next,next.reference).complete)throw new Error('关卡附带的参考布局未通过条件验证');
    if(data.layout){const check=evaluateLayout(next,data.layout);if(check.errors.length)throw new Error(check.errors[0]);}
    level=next;layout=data.layout||initialLayout(next);selectedRoom=level.rooms[0].id;hints=Math.max(0,Math.min(3,data.hints??3));submissions=data.submissions||[];undoStack=[];redoStack=[];review=null;collapsed=new Set();pan={x:0,y:0};zoom=1;persist();render();toast('已导入关卡，使用同一规则引擎');
  }catch(error){toast('导入失败：'+error.message);}
});
function svgPoint(event){const svg=$('#blueprint'),p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
function closestEdge(p){const x=Math.floor(p.x),y=Math.floor(p.y),dx=p.x-x,dy=p.y-y;const min=Math.min(dx,1-dx,dy,1-dy);return min===dx?edgeKey('v',x,y):min===1-dx?edgeKey('v',x+1,y):min===dy?edgeKey('h',x,y):edgeKey('h',x,y+1);}
function rectangle(a,b){const ax=Math.floor(a.x),ay=Math.floor(a.y),bx=Math.floor(b.x),by=Math.floor(b.y);return{x:Math.min(ax,bx),y:Math.min(ay,by),w:Math.abs(ax-bx)+1,h:Math.abs(ay-by)+1};}
function preview(event){
  if(!drag)return;const p=svgPoint(event);drag.last=p;
  const node=$('#drawing-preview');if(!node)return;
  if(drag.mode==='room'||drag.mode==='eraser'){
    const r=rectangle(drag.start,p),room=level.rooms.find(r=>r.id===selectedRoom);
    node.innerHTML=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${drag.mode==='eraser'?'#cf7767':room.color}" opacity=".6" stroke="${drag.mode==='eraser'?'#9b4d41':'#4b6750'}" stroke-width=".05" stroke-dasharray=".12 .08"/><text x="${r.x+r.w/2}" y="${r.y+r.h/2+.1}" font-size=".3" text-anchor="middle" fill="#374633">${r.w*r.h}㎡</text>`;
  }else if(['door','window','open'].includes(drag.mode)){
    drag.edges.add(closestEdge(p));node.innerHTML=[...drag.edges].map(k=>{const{axis,x,y}=edgeParts(k);return `<path d="M${x} ${y}${axis==='h'?'h1':'v1'}" stroke="#547758" stroke-width=".14" opacity=".65"/>`;}).join('');
  }else if(drag.object){node.innerHTML=`<g opacity=".6">${furnitureSVG(drag.object.kind,Math.floor(p.x)-drag.offset.x,Math.floor(p.y)-drag.offset.y,drag.object.rotation)}</g>`;}
}
function finish(event){
  if(!drag)return;const current=drag;drag=null;
  const p=svgPoint(event);let result;
  if(current.mode==='room')result=paintRoom(level,layout,selectedRoom,rectangle(current.start,p));
  else if(current.mode==='eraser')result={layout:eraseRect(level,layout,rectangle(current.start,p),eraseFilter)};
  else if(['door','window','open'].includes(current.mode)){
    current.edges.add(closestEdge(p));let next=layout,error='';for(const key of current.edges){const item=placeBoundary(level,next,key,current.mode);if(item.layout)next=item.layout;else error=item.error;}
    result=next===layout?{error}:{layout:next};
  }else if(current.object){result=placeObject(level,layout,{...current.object,x:Math.floor(p.x)-current.offset.x,y:Math.floor(p.y)-current.offset.y});}
  else if(current.mode==='hand'){pan.x+=p.x-current.start.x;pan.y+=p.y-current.start.y;render();return;}
  if(result?.error){toast(result.error);render();}else if(result?.layout)commit(result.layout);else render();
}
function bindBoard(){
  const svg=$('#blueprint');
  svg.addEventListener('contextmenu',event=>event.preventDefault());
  svg.addEventListener('pointerdown',event=>{
    if(phone||modal)return;
    const p=svgPoint(event);
    if(tool==='object'&&event.button===2){rotation=(rotation+90)%360;render();return;}
    if(tool==='object'&&event.button===0){const result=placeObject(level,layout,{id:'user-'+crypto.randomUUID(),kind:selectedObject,x:Math.floor(p.x),y:Math.floor(p.y),rotation});result.error?toast(result.error):commit(result.layout);return;}
    if(event.button!==0&&event.button!==2&&event.button!==1)return;
    const mode=event.button===1?'hand':event.button===2?'eraser':tool;
    const objectId=event.target.closest('[data-object-id]')?.dataset.objectId,object=mode==='hand'&&layout.objects.find(o=>o.id===objectId);
    drag={mode,start:p,last:p,edges:new Set(),object,offset:object?{x:Math.floor(p.x)-object.x,y:Math.floor(p.y)-object.y}:null};
    if(['door','window','open'].includes(mode))drag.edges.add(closestEdge(p));
    svg.setPointerCapture(event.pointerId);event.preventDefault();preview(event);
  });
  svg.addEventListener('pointermove',event=>{if(drag)preview(event);});svg.addEventListener('pointerup',finish);
  svg.addEventListener('pointercancel',()=>{drag=null;render();});
}
document.addEventListener('keydown',event=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  if(event.key==='Escape'){phone=false;modal=null;drag=null;render();return;}
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();return;}
  if(event.key==='1')tool='room';else if(event.key==='2')tool='eraser';else if(event.key==='3')tool='hand';else if(event.key.toLowerCase()==='r')rotation=(rotation+90)%360;else return;
  render();
});
render();persist();
