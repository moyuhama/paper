import {MECHANIC_NAMES} from './mechanics.js';
import {OBJECTS} from './catalog.js';
import {SHAPE_NAMES} from './shape-catalog.js';

const furnitureAdvice={
  bed:'双人床占2×2格。先留出床的位置，再放门；四周至少一侧要能从门口走到。',
  sofa:'双人沙发占2×1格。转向会改变长边方向；不要把通向其他房间的通路堵住。',
  chair:'单人沙发占1格。它也需要可到达的使用位置，不能只塞进一个封闭角落。',
  toilet:'马桶占1格。先给卫生间的门口留空，再安排卫浴物件。',
  stove:'炉具占1格。它和厨房其他家具不能重叠，厨房也要能通向餐厅。',
  sink:'洗碗池占1格。方位要求中的“洗碗池”与卫生间的洗手台是不同物件。',
  shower:'淋浴占1格。门口和家具旁要留出可走到的空格。',
  singleBed:'单人床占1×2格。窄房间可先转向再放；床的长边方向会影响方位条带。',
  wardrobe:'衣柜占1×2格。先检查剩余宽度，别把门后唯一通路堵住。',
  table:'餐桌餐椅作为整体占2×2格。预留整块位置，再安排厨房与餐厅的开放连接。',
  bathtub:'浴缸占1×2格。与淋浴是否同时需要，以这份委托的列表为准。',
  fridge:'冰箱占1格，放在要求指定的厨房内。点击冰箱的方位条件，可在图上查看条带范围。',
  coffeeTable:'茶几占2×1格。先留沙发到门口的通路，再根据方位条件调整位置与长边方向。',
  tvStand:'电视柜占2×1格。先读它与其他物件、窗户的方位条件；转向会改变占地和条带宽度。',
  bedsideTable:'床头柜占1格。它是独立物件，不会随着床自动出现；需要从铅笔列表单独放置。',
  desk:'书桌占2×1格。书房先留桌子的连续空间，再安排门和其他家具。',
  bookcase:'书柜占1×2格。可转向适应窄墙边，仍须保留门口与使用位置。',
  basin:'洗手台占1格，和厨房的洗碗池不同。卫生间面积不大，先预留马桶与洗浴设施的位置。',
  washer:'洗衣机占1格。本题若有家政间，就按家政间的需求放置；不要只看物件外形。',
  shoeCabinet:'鞋柜占1×2格。玄关较窄，入户门内侧必须留空；可以转向后沿侧墙放置。',
  workbench:'工作台占3×1格。先找连续3格的完整空间，转向可改为1×3格；固定墙与斜角不能被跨过。'
};
const shapeAdvice={
  classic:'先安排客厅、餐厅与走廊的公共通路，再给卧室和卫生间留下独立入口。',
  l:'轮廓拐弯处也要连通。房间可以分几次拖画并紧贴追加，不必全都画成矩形。',
  notched:'外墙缺角不是可用面积。先数房间实际占用的格子，再安排靠近缺角的家具。',
  narrow:'入口较长较窄，先留从入户门到走廊的连续空路，再放玄关物件。',
  u:'两翼要通过中间部分相连。先画通路，再把私密房间分到两翼，避免借卧室穿行。',
  balcony:'阳台凸出外轮廓。它也有独立面积和连接要求，不要把它当作画布外的空白。',
  column:'标出的柱位不能画房间或放家具。柱子周围不是建筑外墙，不能借它开窗或设置入户门。',
  shaft:'管井占地不能使用。管井边不能开门窗；先绕开它留通路，再安排周边房间。',
  wall:'固定墙不能拆成门或开放连接。即使墙两侧都属于同一房间，家具也不能跨过墙。',
  diagonal:'斜边上的三角半格按0.5㎡计算。家具要放在完整格内；斜墙上的窗可直接点击墙段编辑。',
  courtyard:'天井是不能使用的内院，周边可按需求开窗，但不能作为入户口。通路需要绕开天井。',
  offset:'上下两翼有错位。先找两部分真正接触的位置，角接触不算房间连通。'
};
export function lessonsForLevel(level,{seen=[],includeSeen=false}={}){
  if(level.chapter===1)return [];
  const lessons=[];
  for(const kind of level.progression?.newFurniture||[]){
    if(!OBJECTS[kind]||!level.rules.some(r=>r.type==='objectCount'&&r.kind===kind&&r.value>0))continue;
    lessons.push({id:'furniture-v1:'+kind,title:'新物件 · '+OBJECTS[kind].name,text:furnitureAdvice[kind],kind});
  }
  const mechanicAdvice={
    multiple:'同一房间可能需要两件同类家具。选中物件后连续放置即可；每件可以独立移动、转向、擦除和撤销。数量要求会显示已放/需要的件数。',
    quantifiers:'“每个”要求所有同类家具都满足；“至少一个”只需其中一件满足。目标若有多件，分别按每件来源家具统计，不能只检查最先放下的那件。',
    useSpace:'有正面要求的家具带绿色小箭头。箭头朝向的一侧须留整排1m深的空地，且能从入户门走到。转向180°也会改变正面；点击条件可查看使用区。',
    distance:'家具距离从两件家具边缘之间的最短直线计算，贴边或角接触为0m。点击距离条件可查看连线与距离；不是从家具中心计算。'
  };
  for(const key of level.mechanics||[]){
    const applicable=key==='multiple'?level.rules.some(r=>r.type==='objectCount'&&r.value>1):key==='quantifiers'?level.rules.some(r=>r.quantifier&&level.rules.some(count=>count.type==='objectCount'&&count.kind===r.source?.kind&&count.roomId===r.source?.roomId&&count.value>1)):level.rules.some(r=>r.type===key);
    if(applicable)lessons.push({id:'mechanic-v1:'+key,title:'新玩法 · '+MECHANIC_NAMES[key],text:mechanicAdvice[key]});
  }
  const family=level.planning?.shapeFamily;
  if(shapeAdvice[family])lessons.push({id:'shape-v1:'+family,title:'户型提示 · '+SHAPE_NAMES[family],text:shapeAdvice[family]});
  return lessons.filter(lesson=>includeSeen||!seen.includes(lesson.id));
}
export function completeLessons(seen,lessons){return [...new Set([...seen,...lessons.map(lesson=>lesson.id)])];}
