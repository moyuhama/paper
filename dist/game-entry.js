// Own only the title→game transition. Ordinary edits never replay it.
export function createGameEntry(root){
  const doc=root.ownerDocument,view=doc?.defaultView;let busy=false;
  return {
    get busy(){return busy;},
    async run(showGame){
      if(busy)return false;
      busy=true;const animations=[],motion=view?.matchMedia?.('(prefers-reduced-motion: reduce)');
      let skip=!!motion?.matches||!!doc?.hidden;
      const finish=()=>{skip=true;for(const animation of animations)try{animation.finish();}catch{}};
      const changed=event=>{if(event.matches)finish();};
      const hidden=()=>{if(doc.hidden)finish();};
      const previousInert=root.inert,previousBusy=root.getAttribute('aria-busy');
      root.inert=true;root.setAttribute('aria-busy','true');root.classList.add('entering-game');
      doc?.addEventListener('visibilitychange',hidden);view?.addEventListener('resize',finish);motion?.addEventListener?.('change',changed);
      function animate(selector,frames,options){
        if(skip)return null;const node=root.querySelector(selector);if(!node?.animate)return null;
        try{const animation=node.animate(frames,{easing:'cubic-bezier(.2,.75,.25,1)',fill:'both',...options});animations.push(animation);return animation;}catch{return null;}
      }
      async function wait(items,limit){
        let timer;try{await Promise.race([Promise.allSettled(items.filter(Boolean).map(a=>a.finished)),new Promise(resolve=>{timer=setTimeout(resolve,limit);})]);}
        finally{clearTimeout(timer);}
      }
      try{
        root.dataset.entryPhase='leaving';
        await wait([animate('.main-menu',[{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(-16px) scale(1.015)'}],{duration:150})],220);
        showGame();root.dataset.entryPhase='arriving';
        const phone=root.querySelector('.phone'),phoneTransform=phone?(view?.getComputedStyle?.(phone)?.transform||'none'):'none';
        await wait([
          animate('.paper',[{opacity:0,transform:'translateY(28px) rotate(-.7deg) scale(.985)'},{opacity:1,transform:'none'}],{duration:480}),
          animate('.desk-rail',[{opacity:0,transform:'translateX(-18px)'},{opacity:1,transform:'none'}],{duration:380,delay:70}),
          animate('.desk-bottom',[{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'none'}],{duration:320,delay:150}),
          animate('.phone-shade',[{opacity:0},{opacity:1}],{duration:180,delay:300}),
          animate('.phone',[{opacity:0,transform:`translateY(28px) ${phoneTransform==='none'?'':phoneTransform}`.trim()},{opacity:1,transform:phoneTransform}],{duration:300,delay:300})
        ],750);
        return true;
      }finally{
        for(const animation of animations)try{animation.cancel();}catch{}
        doc?.removeEventListener('visibilitychange',hidden);view?.removeEventListener('resize',finish);motion?.removeEventListener?.('change',changed);
        root.inert=previousInert;root.classList.remove('entering-game');delete root.dataset.entryPhase;
        if(previousBusy===null)root.removeAttribute('aria-busy');else root.setAttribute('aria-busy',previousBusy);
        busy=false;
      }
    }
  };
}
