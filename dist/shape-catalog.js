export const SHAPE_NAMES={classic:'双区住宅',l:'L形两翼',notched:'缺角住宅',narrow:'狭长入口',u:'U形双翼',balcony:'凸出阳台',column:'固定柱位',shaft:'管井住宅',wall:'固定墙住宅',diagonal:'斜切角住宅',courtyard:'天井住宅',offset:'错位双翼'};
export const SHAPE_UNLOCKS={classic:12,l:13,notched:15,narrow:17,u:21,balcony:23,column:25,shaft:27,wall:31,diagonal:33,courtyard:35,offset:37};
export const SHAPE_INTRODUCTIONS=Object.fromEntries(Object.entries(SHAPE_UNLOCKS).map(([family,chapter])=>[chapter,family]));
