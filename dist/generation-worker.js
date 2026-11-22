import {createCampaignLevel} from './levels.js';
self.onmessage=event=>{
  try{const{chapter,avoidFingerprints}=event.data;self.postMessage({level:createCampaignLevel(chapter,{avoidFingerprints,budgetMs:1150})});}
  catch(error){self.postMessage({error:error.message});}
};
