import {createCampaignLevel} from './levels.js';
self.onmessage=event=>{
  try{const{chapter,avoidFingerprints,recentStructures}=event.data;self.postMessage({level:createCampaignLevel(chapter,{avoidFingerprints,recentStructures,budgetMs:1150})});}
  catch(error){self.postMessage({error:error.message});}
};
