// Audio survives game renders. User settings, never media.volume readback, decide playback.
export function createGameAudio(initialSettings,environment={}) {
  const doc=environment.document||document;
  const AudioCtx=environment.AudioContext||globalThis.AudioContext||globalThis.webkitAudioContext;
  let settings=initialSettings,activated=false,mixer=null;
  const volume=value=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
  const musicLevel=()=>volume(settings.musicVolume),effectsLevel=()=>volume(settings.effectsVolume);
  const root=doc.createElement('div');root.hidden=true;root.id='game-audio';doc.body.append(root);
  const media=(name,src)=>{const el=doc.createElement('audio');el.preload='auto';el.dataset.sound=name;el.src=new URL(src,import.meta.url).href;root.append(el);return el;};
  const music=media('music','./audio/desk-theme.mp3');music.loop=true;
  const pools=new Map(['click','pencil','erase','place','phone','success','error'].map(name=>[name,[media(name,`./audio/${name}.wav`),media(name,`./audio/${name}.wav`)]]));
  function stopMusic(){music.muted=true;music.pause();}
  function setMediaLevel(el,level){
    el.muted=level===0;
    // iOS can ignore volume writes. GainNodes handle all non-zero levels when available.
    try{el.volume=mixer?1:level;}catch{}
    if(level===0)el.pause();
  }
  function applyLevels(){
    const bg=musicLevel(),fx=effectsLevel();
    if(mixer){mixer.music.gain.value=bg;mixer.effects.gain.value=fx;}
    setMediaLevel(music,bg);
    for(const pool of pools.values())for(const el of pool)setMediaLevel(el,fx);
  }
  function ensureMixer(){
    if(!mixer&&AudioCtx){
      const context=new AudioCtx(),musicGain=context.createGain(),effectsGain=context.createGain();
      // Set gains before connecting: a saved zero must never briefly play at full volume.
      musicGain.gain.value=musicLevel();effectsGain.gain.value=effectsLevel();
      musicGain.connect(context.destination);effectsGain.connect(context.destination);
      context.createMediaElementSource(music).connect(musicGain);
      for(const pool of pools.values())for(const el of pool)context.createMediaElementSource(el).connect(effectsGain);
      mixer={context,music:musicGain,effects:effectsGain};applyLevels();
    }
    if(mixer&&mixer.context.state!=='running')mixer.context.resume().catch(()=>{});
  }
  function startMusic(){
    if(!musicLevel()){stopMusic();return;}
    if(!activated||doc.hidden)return;
    music.muted=false;
    if(music.paused)music.play().catch(()=>{});
  }
  function update(next){settings=next;applyLevels();startMusic();}
  function unlock(event){if(!event.isTrusted)return;activated=true;ensureMixer();startMusic();}
  doc.addEventListener('pointerdown',unlock,{capture:true});
  doc.addEventListener('keydown',unlock,{capture:true});
  doc.addEventListener('visibilitychange',()=>{
    if(doc.hidden){music.pause();for(const pool of pools.values())for(const el of pool)el.pause();}
    else {applyLevels();startMusic();}
  });
  music.addEventListener('play',()=>{if(!musicLevel()||doc.hidden)stopMusic();});
  function play(name){
    if(!activated||doc.hidden||!effectsLevel())return;
    const pool=pools.get(name);if(!pool)return;
    const el=pool.find(item=>item.paused||item.ended)||pool[0];
    el.currentTime=0;el.play().catch(()=>{});
  }
  update(settings);
  return {play,update};
}
