import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateLevel,createCampaignLevel} from '../dist/levels.js';
import {generationQualityErrors} from '../dist/generation-quality.js';
import {clone,evaluateLayout,evaluateRule,integrityErrors,walkabilityErrors,edgeCells,edgeInfo,sharedEdges,boundaryKind,footprint,point} from '../dist/engine.js';

test('第四关不再让五种用途全为9㎡，交通占比受控且有明示通行条件',()=>{
  const l=createCampaignLevel(4),area=id=>l.rules.find(r=>r.type==='area'&&r.roomId===id).value;
  assert.ok(area('hall')<area('bedroom'));assert.ok(area('bath')<area('bedroom'));assert.ok(area('living')>=area('bedroom'));
  assert.ok(area('hall')/l.outline.length<=.18);assert.ok(new Set(l.rules.filter(r=>r.type==='area').map(r=>r.value)).size>=4);
  assert.ok(l.rules.some(r=>r.type==='walkable'&&!r.hidden));assert.ok(l.rules.some(r=>r.type==='connectionCount'&&r.roomId==='bedroom'&&r.targetRoomId==='hall'&&!r.hidden));
  assert.deepEqual(generationQualityErrors(l),[]);
});
test('回归：门数和房间连通仍正确，但卧室改为经卫生间穿行会违反明示门连接',()=>{
  const l=generateLevel('wrong-transit','standard'),layout=clone(l.reference);
  const bedroomDoor=Object.keys(layout.edges).find(k=>layout.edges[k].kind==='door'&&edgeInfo(l,layout,k).rooms.includes('bedroom'));
  delete layout.edges[bedroomDoor];layout.edges[sharedEdges(l,layout,'bedroom','bath')[1]]={kind:'door'};
  for(const r of l.rules.filter(r=>r.type==='globalCount'||r.type==='reachable'))assert.equal(evaluateRule(l,layout,r).ok,true,r.text);
  const direct=l.rules.find(r=>r.type==='connectionCount'&&r.roomId==='bedroom');assert.equal(evaluateRule(l,layout,direct).ok,false);
  assert.equal(evaluateLayout(l,layout).complete,false);
  assert.ok(generationQualityErrors({...l,reference:layout}).some(e=>e.includes('穿行')));
});
test('回归：家具占地合法但挡住厨房门，新题的门口留空条件不通过',()=>{
  const l=generateLevel('blocked-door','standard'),layout=clone(l.reference);
  const key=Object.keys(layout.edges).find(k=>layout.edges[k].kind==='door'&&edgeInfo(l,layout,k).rooms.includes('kitchen'));
  const cell=edgeCells(key).find(c=>layout.cells[c]==='kitchen'),[x,y]=point(cell);
  layout.objects=layout.objects.filter(o=>o.kind!=='stove'&&!footprint(o).includes(cell));layout.objects.push({id:'blocked-stove',kind:'stove',x,y,rotation:0});
  assert.deepEqual(integrityErrors(l,layout),[]);assert.ok(walkabilityErrors(l,layout).some(e=>e.includes('门口')));
  assert.equal(evaluateRule(l,layout,l.rules.find(r=>r.type==='walkable')).ok,false);
});
test('几何外轮廓可达不能替代真实通路：沿开放连接摆一整排家具会被拒绝',()=>{
  const l=generateLevel('blocked-open','standard'),layout=clone(l.reference);
  const keys=sharedEdges(l,layout,'hall','living').filter(k=>boundaryKind(l,layout,k)==='open');
  const cells=keys.map(k=>edgeCells(k).find(c=>layout.cells[c]==='living'));
  const blocked=new Set(cells);layout.objects=layout.objects.filter(o=>!footprint(o).some(c=>blocked.has(c)));
  cells.forEach((c,i)=>{const[x,y]=point(c);layout.objects.push({id:'barrier-'+i,kind:'chair',x,y,rotation:0});});
  assert.deepEqual(integrityErrors(l,layout),[]);assert.equal(evaluateRule(l,layout,{type:'reachable'}).ok,true);
  assert.equal(evaluateRule(l,layout,{type:'walkable'}).ok,false);
});
test('旧版样例未被追加强制通行规则，既有通关结果兼容',()=>{
  for(const mode of ['intro','standard','complex']){
    const old=JSON.parse(readFileSync(new URL(`../examples/${mode}.json`,import.meta.url),'utf8'));
    const l=old.level||old;assert.equal(evaluateLayout(l,l.reference).complete,true);
    assert.equal(l.rules.some(r=>r.type==='walkable'),false);
  }
});
test('第2至40关都通过参考质量筛选，家具渐进解锁不破坏通路',()=>{
  for(let n=2;n<=40;n++){const l=createCampaignLevel(n);assert.deepEqual(generationQualityErrors(l),[],`chapter ${n}`);assert.equal(evaluateLayout(l,l.reference).complete,true);}
});
test('三个规模额外60个种子覆盖镜像与旋转，面积、私密交通、门口和家具使用位置全部有效',()=>{
  const orientations=new Set();
  for(const mode of ['intro','standard','complex'])for(let n=0;n<20;n++){
    const l=generateLevel('quality-'+n,mode);assert.deepEqual(generationQualityErrors(l),[],mode+':'+n);
    orientations.add(JSON.stringify(l.planning.orientation));
  }
  assert.equal(orientations.size,8);
});
