"""Original procedural score and sound effects. No source-game audio is used.
Run with Python + numpy, and ffmpeg to encode the background music.
"""
from pathlib import Path
import math, wave, subprocess
import numpy as np

OUT = Path(__file__).resolve().parents[1] / 'dist' / 'audio'
OUT.mkdir(exist_ok=True)
SR=24000
rng=np.random.default_rng(219)
def write(name,a):
    a=np.clip(a,-.92,.92)
    path=OUT/(name+'.wav')
    with wave.open(str(path),'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR)
        f.writeframes((a*32767).astype('<i2').tobytes())
    return path

def key(midi,duration,velocity=1):
    t=np.arange(int(duration*SR))/SR
    hz=440*2**((midi-69)/12)
    # Rounded felt-piano attack and independently decaying upper harmonics.
    attack=1-np.exp(-t/0.008)
    a=sum(amp*np.sin(2*np.pi*hz*harm*t)*np.exp(-t/decay)
          for harm,amp,decay in [(1,.72,1.5),(2,.16,.65),(3,.065,.4),(4,.022,.24)])
    release=np.minimum(1,(duration-t)/.14)
    return a*attack*release*velocity

def mix(dst,sound,at,gain=1,wrap=False):
    start=round(at*SR)
    if wrap:
        idx=(start+np.arange(len(sound)))%len(dst)
        np.add.at(dst,idx,sound*gain)
    elif start<len(dst):
        n=min(len(sound),len(dst)-start);dst[start:start+n]+=sound[:n]*gain

beat=60/86;length=16*4*beat
music=np.zeros(round(length*SR))
chords=[[48,60,64,67,71],[45,60,64,67,71],[50,60,65,69,72],[43,59,64,65,69],
        [48,59,64,67,74],[45,60,64,67,71],[50,60,65,69,72],[43,59,62,65,69]]
melodies=[[76,79,83,79],[76,74,72,71],[69,72,76,74],[71,74,72,69],
          [67,71,76,79],[76,74,72,67],[69,72,74,77],[76,74,71,67],
          [79,83,86,83],[79,76,74,72],[77,76,72,69],[74,76,74,71],
          [72,76,79,76],[74,72,71,67],[69,72,77,74],[71,74,71,67]]
for bar in range(16):
    c=chords[bar%8];base=bar*4*beat
    for pos,note in [(0,c[0]),(2,c[0]+7)]:
        mix(music,key(note,2.2,.07),base+pos*beat,wrap=True)
    for pos in [0,1.5,3]:
        for i,note in enumerate(c[1:]):
            mix(music,key(note,2.2,.035),base+pos*beat+i*.025,wrap=True)
    for i,note in enumerate(melodies[bar]):
        # Deliberate gaps keep the loop quiet while solving.
        if i==3 and bar%4 in [0,2]:continue
        mix(music,key(note,1.8,.058 if i%2==0 else .045),base+(i+.18)*beat,wrap=True)
# A short, circular room response preserves the seam.
dry=music.copy()
for delay,gain in [(.083,.12),(.171,.08),(.29,.04)]:music+=np.roll(dry,round(delay*SR))*gain
path=write('desk-theme',music)
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(path),'-codec:a','libmp3lame','-b:a','96k',str(OUT/'desk-theme.mp3')],check=True)
path.unlink()

def noise(duration):
    n=rng.normal(0,1,round(duration*SR));t=np.arange(len(n))/SR
    # Dry paper texture with softened transients, not white-noise bursts.
    n=np.convolve(n,np.ones(7)/7,mode='same')
    return n,t
n,t=noise(.085);write('click',.22*np.sin(2*np.pi*520*t)*np.exp(-t/0.014)+.035*n*np.exp(-t/.012))
n,t=noise(.2);write('pencil',n*.18*np.sin(np.pi*t/.2)**2*(.65+.35*np.sin(2*np.pi*43*t)))
n,t=noise(.26);write('erase',n*.17*np.sin(np.pi*t/.26)**2*(.7+.3*np.sin(2*np.pi*18*t)))
t=np.arange(round(.14*SR))/SR;write('place',.24*np.sin(2*np.pi*(340*t-430*t*t))*np.exp(-t/.025)*(1-np.exp(-t/.001)))
for name,notes,duration in [('phone',[76,79],.55),('success',[72,76,79,84],1.05),('error',[64,60],.45)]:
    a=np.zeros(round(duration*SR))
    for i,note in enumerate(notes):mix(a,key(note,.5,.14),i*(.13 if name=='success' else .1))
    write(name,a)
print('Generated original 44.65 s music loop and 7 sound effects.')
