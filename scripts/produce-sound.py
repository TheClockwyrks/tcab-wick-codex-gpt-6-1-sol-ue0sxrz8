"""One-time sound design and score authoring with the supplied tools."""
import subprocess,json,wave,struct,math
from pathlib import Path
Path('assets/audio').mkdir(parents=True,exist_ok=True)
def run(tool,*args):subprocess.run([tool,'--config','/tmp/wick-sound.json',*map(str,args)],check=True,stdout=subprocess.DEVNULL)
def config(name,duration,music=False):
 d=dict(sample_rate=22050,channels='stereo',max_duration_ms=duration,seed=17,actions='/tmp/wick-sound-ops.json',preview='/tmp/wick-sound.png',wav='assets/audio/'+name+'.wav')
 if music:d['mid']='assets/audio/music.mid'
 Path('/tmp/wick-sound.json').write_text(json.dumps(d))
for i,(name,freq,dur,wav) in enumerate([('hit',180,70,'triangle'),('kill',480,130,'triangle'),('gem',1046,90,'sine'),('hurt',90,330,'saw'),('level-up',523,700,'sine'),('choose',784,180,'triangle'),('chest',330,600,'triangle'),('evolve',659,1000,'sine'),('pickup',880,180,'sine'),('fallen',110,1600,'triangle'),('dawn',523,1800,'sine'),('menu-move',440,45,'sine'),('menu-confirm',660,140,'triangle'),('hum',55,2400,'sine')]):
 config(name,dur+150)
 run('sfx-synth','init');run('sfx-synth','add-voice','--name','core','--wave',wav,'--freq',freq,'--gain',-26 if name=='hum' else -21,'--dur',dur)
 if name!='hum':run('sfx-synth','set-pitch','--voice','core','--slide-to',freq*(0.4 if name in ['hurt','fallen','hit'] else 1.5),'--over',dur)
 if name in ['level-up','dawn','evolve','chest']:
  for k in range(3):run('sfx-synth','add-voice','--name',f'bell{k}','--wave','sine','--freq',freq*[1,1.25,1.5][k],'--gain',-26,'--start',k*100,'--dur',dur-k*100)
 run('sfx-synth','render')
config('music',33000,True);run('music','init');run('music','set-tempo','--bpm',60)
for tr,inst in [('bass','sine'),('glass','triangle')]:run('music','define-track','--name',tr,'--instrument',inst)
for bar,root in enumerate([45,41,48,43,45,41,48,40]):
 run('music','add-note','--track','bass','--pitch',root,'--t',bar*4,'--dur',3.95,'--velocity',32)
 for k,off in enumerate([12,19,24,19]):run('music','add-note','--track','glass','--pitch',root+off,'--t',bar*4+k,'--dur',0.7,'--velocity',40 if k%2 else 49)
run('music','render')
# Ensure sample-continuous loop boundaries with a short inaudible end taper.
for name in ['hum','music']:
 p='assets/audio/'+name+'.wav'
 with wave.open(p,'rb') as w:params=w.getparams();data=list(struct.unpack('<'+'h'*(w.getnframes()*w.getnchannels()),w.readframes(w.getnframes())))
 ch=params.nchannels;n=len(data)//ch
 for j in range(min(220,n//2)):
  gain=j/220
  for c in range(ch):data[j*ch+c]=int(data[j*ch+c]*gain);data[(n-1-j)*ch+c]=int(data[(n-1-j)*ch+c]*gain)
 with wave.open(p,'wb') as w:w.setparams(params);w.writeframes(struct.pack('<'+'h'*len(data),*data))
