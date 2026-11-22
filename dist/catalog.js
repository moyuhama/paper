export const CONTENT_VERSION='residential-2';
const definitions=[
  ['bed','双人床',2,2,1],['singleBed','单人床',1,2,9],
  ['sofa','双人沙发',2,1,3],['chair','单人沙发',1,1,4],
  ['table','餐桌餐椅',2,2,10],['stove','炉具',1,1,6],
  ['sink','洗碗池',1,1,7],['toilet','马桶',1,1,5],
  ['shower','淋浴',1,1,8],['wardrobe','衣柜',1,2,9],['bathtub','浴缸',1,2,11],
  ['fridge','冰箱',1,1,12],['coffeeTable','茶几',2,1,14],['tvStand','电视柜',2,1,16],
  ['bedsideTable','床头柜',1,1,18],['desk','书桌',2,1,20],['bookcase','书柜',1,2,22],
  ['basin','洗手台',1,1,24],['washer','洗衣机',1,1,26],['shoeCabinet','鞋柜',1,2,28],
  ['workbench','工作台',3,1,30]
];
export const OBJECTS=Object.freeze(Object.fromEntries(definitions.map(([id,name,w,h,chapter])=>[id,Object.freeze({name,w,h,chapter})])));
export const ROOM_CATALOG={
  living:{name:'客厅',color:'#edc8c3',objects:['sofa','chair']},bedroom:{name:'卧室',color:'#ede5b2',objects:['bed']},
  bath:{name:'卫生间',color:'#c9c9e8',objects:['shower','toilet'],advancedObjects:['bathtub']},kitchen:{name:'厨房',color:'#bcdccd',objects:['stove','sink']},
  dining:{name:'餐厅',color:'#bdd9e7',objects:['table']},hall:{name:'走廊',color:'#d5d8c2',objects:[]},
  entry:{name:'玄关',color:'#cde0c0',objects:[]},master:{name:'主卧',color:'#e8dfad',objects:['bed']},
  guest:{name:'客卧',color:'#e8c9b1',objects:['singleBed','wardrobe']},game:{name:'游戏室',color:'#c6dfe1',objects:['chair']},
  study:{name:'书房',color:'#c8dce4',objects:['desk']},laundry:{name:'家政间',color:'#c3ded3',objects:['washer']},
  store:{name:'储物间',color:'#d5cfbe',objects:['wardrobe']},workshop:{name:'工作室',color:'#ddcdbc',objects:['workbench']},
  balcony:{name:'阳台',color:'#d3e4bc',objects:[]}
};
export function roomFurniture(plan,{chapter,rand,expanded=false,basic=false}={}){
  const unlocked=kind=>chapter===undefined||OBJECTS[kind].chapter<=chapter;
  if(!expanded)return Object.fromEntries(plan.roomIds.map(id=>[id,[...ROOM_CATALOG[id].objects,...(!basic?ROOM_CATALOG[id].advancedObjects||[]:[])].filter(unlocked)]));
  const introduced=new Set(Object.keys(OBJECTS).filter(k=>OBJECTS[k].chapter===chapter));
  const bathing=rand()>.5?'shower':'bathtub';
  const cores={living:['sofa'],master:['bed'],bedroom:['bed'],guest:['singleBed'],bath:['toilet',bathing],kitchen:['stove','sink'],dining:['table'],study:['desk'],store:['wardrobe'],laundry:['washer'],workshop:['workbench'],entry:[],hall:[],balcony:[]};
  const optional={living:[introduced.has('coffeeTable')?'coffeeTable':introduced.has('tvStand')?'tvStand':rand()>.5?'coffeeTable':'tvStand'],master:['bedsideTable'],bedroom:['bedsideTable'],guest:['wardrobe'],bath:['basin'],kitchen:['fridge'],study:['bookcase','chair'],entry:['shoeCabinet'],workshop:['chair']};
  const result=Object.fromEntries(plan.roomIds.map(id=>[id,(cores[id]||[]).filter(unlocked)]));
  const pending=plan.roomIds.flatMap(id=>(optional[id]||[]).filter(unlocked).map(kind=>({id,kind,rank:introduced.has(kind)?-10:rand()}))).sort((a,b)=>a.rank-b.rank);
  for(const item of pending){const count=new Set(Object.values(result).flat()).size;if(introduced.has(item.kind)||count<12||Object.values(result).flat().includes(item.kind))result[item.id].push(item.kind);}
  return result;
}
