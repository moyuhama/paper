// One lifetime across board redraws. Interrupted contacts must lift before a
// fresh stroke can begin; an unrelated pointer can never finish that stroke.
export function createBoardGestures(){
  const contacts=new Map();let phase='idle';
  return {
    down(id,point,eligible=true){
      contacts.set(id,{...point,eligible});
      if(contacts.size===1)phase=eligible?'single':'blocked';
      else if(contacts.size===2&&phase==='single'&&[...contacts.values()].every(p=>p.eligible))phase='camera';
      else if(phase!=='camera')phase='blocked';
      return phase;
    },
    move(id,point){if(contacts.has(id))Object.assign(contacts.get(id),point);},
    up(id){if(!contacts.has(id))return;contacts.delete(id);phase=contacts.size?'blocked':'idle';},
    cancel(id){if(!contacts.has(id))return;contacts.delete(id);phase=contacts.size?'blocked':'idle';},
    interrupt(){if(contacts.size)phase='blocked';},
    canDraw(id){return phase==='single'&&contacts.has(id);},
    has(id){return contacts.has(id);},
    get phase(){return phase;},
    get points(){return [...contacts.values()].slice(0,2);}
  };
}
