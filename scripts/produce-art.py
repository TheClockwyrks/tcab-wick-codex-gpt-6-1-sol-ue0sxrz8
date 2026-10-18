"""One-time original pixel art authoring; builds use the committed PNGs only."""
import json, math, subprocess, os, random
from pathlib import Path
random.seed(17)
ROOT=Path('assets'); OPS=[]
def rect(x,y,w,h,c): OPS.append(dict(op='fill_rect',x=int(x),y=int(y),width=max(1,int(w)),height=max(1,int(h)),color=c))
def line(x1,y1,x2,y2,c): OPS.append(dict(op='line',x0=int(x1),y0=int(y1),x1=int(x2),y1=int(y2),color=c))
def disc(x,y,r,c): OPS.append(dict(op='fill_circle',cx=int(x),cy=int(y),r=max(0,int(r)),color=c))
def ring(x,y,r,c): OPS.append(dict(op='stroke_circle',cx=int(x),cy=int(y),r=max(0,int(r)),color=c))
def poly(points,c):
 for y in range(int(min(p[1] for p in points)),int(max(p[1] for p in points))+1):
  xs=[]
  for a,b in zip(points,points[1:]+points[:1]):
   if (a[1]<=y<b[1]) or (b[1]<=y<a[1]): xs.append(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]))
  xs.sort()
  for a,b in zip(xs[::2],xs[1::2]): rect(math.ceil(a),y,max(1,math.floor(b)-math.ceil(a)+1),1,c)
def save(path,w,h,sheet=False):
 p=ROOT/path;p.parent.mkdir(parents=True,exist_ok=True)
 Path('/tmp/wick-ops.json').write_text(json.dumps(OPS))
 subprocess.run(['draw-sheet' if sheet else 'draw','render','--actions','/tmp/wick-ops.json','--out',str(p),'--width',str(w),'--height',str(h),'--no-layers'],check=True,stdout=subprocess.DEVNULL)
 OPS.clear()
ink='#101a26'; dark='#263243'; mid='#586777'; gold='#d4a65e'; light='#ffe5a0'; teal='#86d6c1'
def lamp(x,y,s=1):
 rect(x+3*s,y,6*s,2*s,gold);rect(x+2*s,y+2*s,8*s,10*s,ink);rect(x+3*s,y+3*s,6*s,7*s,gold);rect(x+4*s,y+4*s,4*s,5*s,light);rect(x+5*s,y+5*s,2*s,3*s,'#fff3d2');rect(x+s,y+12*s,10*s,2*s,gold)
def player(f):
 bob=[0,1,1,0,0,1][f]
 rect(6+[0,1,2,1,0,-1][f],25,4,6,ink);rect(13-[0,1,2,1,0,-1][f],25,4,6,ink);rect(4+(f%2)*2,29,7,2,mid);rect(12-(f%2),29,7,2,mid)
 poly([(6,12+bob),(14,11+bob),(18,26),(3,26)],ink);poly([(7,12+bob),(12,12+bob),(14,24),(5,24)],'#446271');rect(9,15,2,9,'#75959a');rect(6,24,10,2,gold)
 rect(8,5+bob,7,8,'#ba9271');rect(12,7+bob,4,5,'#e6c79b');rect(15,8+bob,1,1,ink);rect(5,4+bob,13,3,ink);rect(8,1+bob,7,4,mid);rect(8,4+bob,7,1,gold)
 rect(7+f,21,1,2,'#9da18a');line(13,15,20,15,gold);line(19,11,19,25,gold);lamp(15,17,0.6)
player(0);save('sprites/lamplighter/idle.png',24,32)
for f in range(6): player(f);save(f'sprites/lamplighter/walk/{f}.png',24,32,True)
names=['moth','bat','rat','gnat','beetle','wisp','spider','crow','shade','hound','mothwing','owl','dark'];sizes=[20,20,24,16,28,20,28,24,32,36,56,72,80]
for name,n in zip(names,sizes):
 for f in range(4):
  c=n/2; b=[0,2,1,-1][f]; col={'moth':'#b7a48c','mothwing':'#d2b781','bat':'#8c7296','crow':'#718ba0','wisp':'#94ded0','dark':'#344052'}.get(name,'#667884')
  if name in ['moth','mothwing','bat','gnat','crow','owl']:
   poly([(c,c-2),(1,c-7+b),(3,c+5-b),(c-3,c+6),(c,c+2)],dark)
   poly([(c,c-2),(n-2,c-7+b),(n-4,c+5-b),(c+3,c+6),(c,c+2)],col)
   poly([(c-2,c-2),(2,c-6+b),(4,c+2),(c-4,c+3)],col)
   if name in ['moth','mothwing','owl']: disc(c*.48,c, max(1,n//12),gold);disc(c*1.5,c,max(1,n//12),gold)
   rect(c-2,c-5,4,n*.46,ink)
   if name=='bat':
    poly([(1,c-7+b),(4,1),(c-3,c+2),(4,c-1),(1,c+5-b)],col);poly([(n-2,c-7+b),(n-5,1),(c+3,c+2),(n-5,c-1),(n-2,c+5-b)],col)
   if name=='crow':poly([(c+1,c-6),(n-1,c-3),(c+3,c)],gold);poly([(c-2,c+2),(c+4,n-1),(c-6,n-3)],ink)
   if name=='owl':
    poly([(c-16,c-12),(c-21,3),(c-5,c-13)],col);poly([(c+16,c-12),(c+21,3),(c+5,c-13)],col)
    for xx in [c-10,c+10]:disc(xx,c-5,9,light);disc(xx,c-5,4,ink)
   if name=='gnat':line(c,0,c,n-1,gold);line(1,c,n-2,c,light)
  elif name in ['rat','hound']:
   poly([(2,c+1),(7,c-5),(n-8,c-5),(n-3,c-10),(n-2,c+5),(8,c+6)],col);line(3,c+2,0,c-4,gold)
   for xx in [7,n-10]: rect(xx+b,c+4,3,6,mid)
  elif name=='spider':
   for i in range(4):
    for side in [-1,1]: line(c+side*3,c-5+i*3,c+side*(10+b),c-11+i*7,mid)
   disc(c,c,6,dark);disc(c,c-4,4,col)
  elif name=='beetle':
   for dy in [-6,0,6]: line(2,c+dy,c,c+dy+3+b,gold);line(c,c+dy+3,n-3,c+dy,gold)
   disc(c,c,9,ink);disc(c,c-1,7,col);line(c,c-8,c,c+7,gold)
  elif name=='wisp':
   poly([(c,1),(n-3,c),(c+4,n-4),(c, n-8+b),(3,n-3),(5,c)],'#416d78');poly([(c,3),(c+4,c),(c,n-4),(c-4,c)],col)
  else:
   poly([(c,2),(c+8,c*.6),(n-5,n-4-b),(c+4,n-9),(c,n-3),(c-5,n-8),(4,n-4+b),(c-8,c*.6)],ink)
   poly([(c,5),(c+5,c*.6),(c+10,n-10),(c,n-15),(c-9,n-8),(c-5,c*.6)],col)
   if name=='dark':
    for side in [-1,1]: poly([(c+side*6,15),(c+side*22,1),(c+side*14,26)],mid)
  if name=='rat':
   disc(n-7,c-6,3,col);disc(n-7,c-6,1,gold);line(1,c+1,0,c-6,gold);line(n-6,c+2,n-1,c+1,mid)
  if name=='hound':
   poly([(n-13,c-4),(n-10,2),(n-5,c-4)],mid);poly([(n-9,c-1),(n-1,c),(n-1,c+4),(n-10,c+5)],col)
   for k in range(4):poly([(7+k*4,c-3),(10+k*4,c-10),(13+k*4,c-3)],mid)
  if name=='mothwing':
   poly([(c-7,c+3),(c-13,n-1),(c-3,n-11),(c,n-3),(c+5,n-11),(c+13,n-1),(c+7,c+3)],col)
   line(c-1,c-6,c-10,2,gold);line(c+1,c-6,c+10,2,gold)
  eyeY=c-2 if name not in ['shade','dark'] else c*.65
  rect(c-3,eyeY,2,2,light);rect(c+2,eyeY,2,2,light)
  if n>40: ring(c,c+1,n//5,gold);rect(c+1,eyeY,3,3,'#ffbd73')
  save(f'sprites/enemies/{name}/{f}.png',n,n,True)
for f in range(4):
 for i in range(9):
  a=i*2.4;r=3+f*2;disc(12+math.cos(a)*r,12+math.sin(a)*r,max(1,3-f//2),[gold,mid,light][i%3])
 save(f'sprites/puff/{f}.png',24,24,True)
for tier,n in [('small',8),('medium',12),('large',16)]:
 c=n//2;poly([(c,0),(n-1,c),(c,n-1),(0,c)],'#3d827e');poly([(c,1),(c,c+2),(1,c)],'#b7ffe1');poly([(c,1),(n-2,c),(c,c+2)],teal);line(c,c+3,c,n-2,'#5eafad');save('sprites/gems/'+tier+'.png',n,n)
for kind in ['chest','bread','draft']:
 if kind=='chest':
  rect(3,8,18,12,ink);rect(4,6,16,7,gold);rect(5,8,14,3,'#f3ce87');rect(4,14,16,6,'#8b633a');rect(6,7,2,13,gold);rect(16,7,2,13,gold);rect(11,12,3,4,light)
 elif kind=='bread':
  disc(12,12,8,'#98613f');rect(4,12,17,6,'#c68f56');disc(12,10,7,'#edbd78');line(8,7,6,12,light);line(13,5,11,11,light);line(17,8,15,12,light)
 else:
  for i in range(3): line(3,6+i*5,18,6+i*5,teal);disc(18,4+i*5,2,teal);rect(3+i*3,7+i*5,6,1,'#d4ffe6')
 save('sprites/pickups/'+kind+'.png',24,24)
rect(0,0,64,64,'#16232c')
for y in range(0,64,16):
 for x in range(-16,64,32):
  xx=x+(16 if y%32 else 0);rect(xx+1,y+1,30,14,random.choice(['#1b2932','#1c2b34','#1a2831']));line(xx+3,y+2,xx+27,y+2,'#23343d');line(xx+30,y+4,xx+30,y+13,'#131f28')
for i in range(30):rect(random.randrange(64),random.randrange(64),1,1,random.choice(['#304048','#263b40','#14232b']))
save('sprites/ground.png',64,64)
weapons=['taper','ember','pin','lantern','halo','oil-splash','spark','shard','sconce','flare','pyre','beacon','hail','chandelier','corona','blaze']
for i,name in enumerate(weapons):
 base=weapons.index(['taper','ember','pin','lantern','halo','oil-splash'][i-10]) if i>=10 else i
 w,h=[(120,40),(16,16),(12,12),(28,28),(160,160),(100,100),(80,80),(16,16),(24,24),(128,128)][base];frames={6:4,8:4,9:6}.get(base,1)
 for f in range(frames):
  c=w/2;d=h/2;co=teal if i>=10 else gold;hi='#e0fff3' if i>=10 else light
  if base==0:
   poly([(0,d),(w*.2,2),(w*.8,5),(w-1,d),(w*.8,h-6),(w*.2,h-3)],co);poly([(4,d),(w*.25,8),(w*.8,10),(w-4,d),(w*.8,h-11),(w*.25,h-9)],hi);poly([(8,d),(w*.4,13),(w*.7,d),(w*.4,26)],'#ffffff')
  elif base in [4,9]:
   r=int(w/2-2-f*3);ring(c,d,r,co);ring(c,d,r-2,hi)
   for k in range(32):
    a=k*math.tau/32;rect(c+math.cos(a)*(r-5),d+math.sin(a)*(r-5),2,2,co)
   if i>=10:ring(c,d,r-9,co)
  elif base==5:
   disc(c,d,w*.45,'#73553e88' if i<10 else '#32796d99')
   for k in range(14):
    a=k*2.4;r=math.sqrt(k/14)*w*.4;ring(c+math.cos(a)*r,d+math.sin(a)*r,3+k%5,co)
  elif base in [3,8]:
   if base==3:
    lamp(c-12,d-12,2)
    if i>=10:
     rect(c-11,d-9,22,2,teal);rect(c-9,d+4,3,7,light);rect(c+7,d+4,3,7,teal);ring(c,d-10,3,teal)
   else:
    for k in range(4):
     a=k*math.pi/2+f*math.pi/8;line(c,d,c+math.cos(a)*10,d+math.sin(a)*10,co);disc(c+math.cos(a)*8,d+math.sin(a)*8,3,hi)
  elif base==6:
   poly([(c+10,0),(c-8,d),(c+4,d),(c-9,h-1),(c+18,d-6),(c+3,d-6)],hi);ring(c,d,int(10+f*7),co)
  else:
   poly([(1,d),(c,1),(w-2,d),(c,h-2)],co);poly([(3,d),(c,3),(w-4,d),(c,h-4)],hi);rect(c-1,d-2,3,3,'#ffffff')
  if base==1:
   poly([(0,d+2),(4,d-1),(2,d-5),(9,d-3),(11,1),(w-1,d),(10,h-2),(5,d+3)],co)
   poly([(4,d),(10,d-3),(w-2,d),(9,d+2)],hi)
   if i>=10:ring(c,d,6,teal)
  if base==2:
   # A thin brass needle with a bright tip.
   OPS.clear();poly([(0,d-1),(w-1,d),(0,d+2),(3,d)],co);line(2,d,w-2,d,hi)
   if i>=10:line(2,d-3,w-3,d-2,teal);line(2,d+3,w-3,d+2,teal)
  if base==7:
   OPS.clear();poly([(c,0),(w-2,5),(w-4,h-3),(3,h-1),(1,7)],'#4b9fba');poly([(c,2),(c+3,6),(c,h-3),(3,h-2)],'#b8f5ef');line(c,3,c,12,'#ffffff')
  save(f'sprites/effects/{name}.png'  if frames==1 else f'sprites/effects/{name}/{f}.png',w,h,frames>1)
# Individually drawn inventory objects, with related evolved forms.
items=weapons+['wick','oil','glass','brass','mirror','bellows','tallow','tinder','soot','lure','lamp-oil']
for i,name in enumerate(items):
 co=teal if name in weapons[10:] else gold
 if name in ['lantern','chandelier']:lamp(6,3,1)
 elif name in ['halo','corona','mirror','lure']:
  ring(12,11,8,co);ring(12,11,6,light);rect(10,18,4,4,co)
  if name=='mirror':disc(11,10,5,'#91babc');line(8,12,13,7,'#e7fff3')
 elif name in ['oil','lamp-oil','oil-splash','blaze']:
  rect(9,2,6,3,co);poly([(9,5),(15,5),(20,12),(18,21),(6,21),(4,12)],mid);rect(7,12,10,7,co);rect(8,8,2,5,light)
 elif name in ['taper','pyre','wick','tallow','tinder']:
  rect(8,10,7,11,co);rect(8,10,2,10,light);poly([(12,1),(16,7),(12,11),(9,7)],'#ffbd70');rect(12,5,2,4,light);rect(5,21,13,2,mid)
 elif name in ['pin','hail','shard','glass']:
  for k in range(1 if name!='hail' else 3):poly([(4+k*4,19),(9+k*4,3),(14+k*4,7)],co);line(5+k*4,17,10+k*4,5,light)
 elif name=='brass':poly([(3,3),(12,6),(21,3),(20,15),(12,22),(4,15)],co);poly([(6,7),(12,9),(18,7),(17,14),(12,18),(7,14)],mid)
 elif name=='bellows':poly([(3,7),(14,4),(19,12),(13,19),(3,16)],co);line(5,9,15,12,mid);line(5,13,14,15,mid);rect(19,11,4,3,light)
 elif name=='soot':
  for k in range(6):disc(6+k*2,14+(k%2)*3,4,mid);rect(6+k*2,12+(k%2)*3,2,2,gold)
 elif name in ['spark','sconce']:poly([(14,1),(5,13),(11,13),(8,23),(20,9),(13,9)],light)
 else:
  disc(12,12,8,co);poly([(12,2),(17,13),(12,21),(6,13)],light);rect(11,10,3,6,'#ffffff')
 if name=='wick':line(3,18,7,11,gold);rect(3,19,4,3,mid)
 if name=='tallow':rect(15,13,4,8,gold);rect(16,10,2,3,light)
 if name=='tinder':line(2,20,20,2,'#d0764d');rect(16,1,5,5,'#ea9657')
 if name=='pyre':poly([(4,20),(4,10),(7,13),(6,6),(10,11),(12,1),(17,11),(20,6),(18,21)],teal);rect(11,12,3,8,light)
 if name=='beacon':ring(12,12,10,teal);line(0,12,23,12,teal);line(12,0,12,23,light)
 if name=='ember':poly([(5,18),(7,4),(11,9),(14,1),(20,15),(15,21)],'#df8d52');poly([(10,18),(12,10),(16,17)],light)
 if name=='flare':
  for k in range(8):
   a=k*math.tau/8;line(12+math.cos(a)*8,12+math.sin(a)*8,12+math.cos(a)*11,12+math.sin(a)*11,light)
 if name=='chandelier':lamp(0,8,.6);lamp(16,8,.6);line(4,6,20,6,teal)
 if name=='corona':ring(12,11,10,teal);line(1,1,5,5,teal);line(19,18,23,22,teal)
 if name=='oil-splash':disc(3,19,2,gold);disc(21,21,1,gold)
 if name=='blaze':poly([(3,21),(5,12),(8,18),(11,8),(15,16),(20,11),(21,21)],teal)
 if name=='lamp-oil':rect(2,7,7,3,gold);line(3,7,3,16,gold);rect(16,2,6,3,light)
 if name=='shard':poly([(13,3),(21,11),(14,21),(7,14)],teal);line(13,5,14,19,light)
 if name=='glass':line(8,20,19,4,teal);line(5,15,17,15,light)
 if name=='lure':line(12,1,12,12,light);line(12,12,17,13,light)
 if name=='spark':line(2,2,6,6,gold);line(18,18,22,22,gold)
 if name=='sconce':rect(2,4,4,18,mid);rect(2,12,13,3,gold);disc(16,8,4,light)
 save('icons/'+name+'.png',24,24)
print('Original sprite collection rendered.')
# The cover: a wrought-iron street lantern in a moth-haunted city.
for i in range(38):
 x=random.randrange(600);y=random.randrange(250,560);w=random.randrange(15,60);h=random.randrange(60,210)
 rect(x,y-h,w,h,'#192b35');rect(x+3,y-h+3,w-6,2,'#2d4248')
 for yy in range(y-h+12,y-5,19):
  if random.random()<.5:rect(x+6,yy,3,6,'#856d45')
for rr in range(165,10,-6):disc(320,215,rr,'#c6984520')
# Monumental roof, glass panels, iron ribs, crown and long weathered pole.
poly([(219,146),(320,96),(421,146),(408,161),(230,161)],ink)
poly([(234,143),(320,103),(408,143)],'#425253');line(244,141,321,113,gold)
rect(310,73,20,26,ink);disc(320,72,13,gold);disc(320,72,8,ink);rect(317,48,6,14,gold)
poly([(236,161),(404,161),(388,299),(251,299)],'#b18a4e')
poly([(248,168),(310,168),(310,287),(260,287)],'#e9b95f');poly([(326,168),(391,168),(377,287),(326,287)],'#f5d58b')
poly([(263,179),(306,174),(306,274),(270,272)],'#ffd780');poly([(331,175),(379,175),(370,273),(331,279)],'#ffe8a2')
for i in range(5):disc(319,242,30-i*5,['#f0b74f','#ffd072','#ffe5a2','#fff1c7','#fffbe2'][i])
poly([(315,248),(303,225),(317,191),(318,214),(329,227),(324,246)],'#fff7c8')
rect(313,161,13,139,ink);rect(315,163,3,130,'#738077');poly([(235,160),(245,160),(264,300),(251,300)],ink);poly([(395,160),(406,160),(389,300),(376,300)],ink)
rect(242,296,154,12,ink);rect(249,297,140,3,gold);poly([(252,309),(387,309),(346,339),(293,339)],dark);line(270,314,369,314,gold)
rect(309,333,24,253,ink);rect(312,337,5,245,mid);rect(317,338,3,246,'#71807b');rect(299,574,44,12,ink);rect(286,585,70,14,dark);rect(275,599,92,9,ink)
for xx in [-1,1]:
 line(320+xx*11,358,320+xx*69,388,mid);line(320+xx*69,388,320+xx*82,370,mid);disc(320+xx*78,368,6,gold)
for i in range(19):
 x=random.randrange(100,530);y=random.randrange(90,400);disc(x,y,2,light);poly([(x,y),(x-8,y-6),(x-6,y+3)],'#ac9f7e');poly([(x,y),(x+7,y-6),(x+5,y+3)],'#c7b892')
save('sprites/cover.png',600,650)
