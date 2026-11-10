#!/usr/bin/env python3
"""Read-only pixel audit of the five current public TaxPay banner objects.
No credentials, CMS operations, database updates or image transformations.
Output is a diagnostic snapshot, never automatic authorization to publish.
"""
import colorsys
import io
import json
from collections import defaultdict
from pathlib import Path
from urllib.request import urlopen
from PIL import Image

BASE="https://eyqhoavnitkrajvyqvxn.supabase.co/storage/v1/object/public/taxpay-banners/"
BANNERS=[
 ("intro","banners/intro/c6bd8f1e-611d-4691-932f-9b6812f46085.jpg","#F7F5E6","#65531B","#6D5F31","#7A651F",22),
 ("return","banners/return/ffa907f6-1ee0-4ebb-86a1-f75392849905.png","#F0F6F9","#1B4D65","#315A6D","#1F5D7A",11),
 ("advance","banners/advance/4ecafe03-442a-4b58-9da8-ca577d34b3a1.png","#FAF1DD","#65501B","#6D5C31","#7A611F",7),
 ("withholding","banners/withholding/1affb273-1f0e-4cdf-bcb4-e06d5c1e15e8.png","#F8E7F6","#651B63","#6D316C","#7A1F78",14),
 ("travel","banners/travel/5a02e106-bcc0-4aba-8021-6520d289c009.png","#F1EBDE","#654D1B","#6D5A31","#7A5D1F",11),
]

def hue(hex_color):
 r,g,b=(int(hex_color[i:i+2],16)/255 for i in (1,3,5))
 h,s,l=colorsys.rgb_to_hls(r,g,b)
 return 360*h if s>=.025 else None
def hue_diff(a,b):
 if a is None or b is None:return None
 d=abs(a-b)
 return round(min(d,360-d),1)
def tohex(r,g,b):
 return f"#{r:02X}{g:02X}{b:02X}"
def contrast(a,b):
 def lum(hexv):
  vals=[int(hexv[i:i+2],16)/255 for i in (1,3,5)]
  lin=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in vals]
  return .2126*lin[0]+.7152*lin[1]+.0722*lin[2]
 x,y=lum(a),lum(b)
 return round((max(x,y)+.05)/(min(x,y)+.05),2)

def audit(name,path,bg,heading,body,outline,version):
 with urlopen(BASE+path,timeout=40) as r:
  imagebytes=r.read()
 im=Image.open(io.BytesIO(imagebytes)).convert("RGBA")
 w,h=im.size
 sample=im.resize((144,max(1,round(144*h/w))))
 W,H=sample.size; pixel=sample.load()
 wash=defaultdict(float); painted=defaultdict(float)
 light_edge=[]
 chromatic_count=0
 for y in range(0,H,2):
  for x in range(0,W,2):
   r,g,b,a=pixel[x,y]
   if a<210:continue
   maxv=max(r,g,b);minv=min(r,g,b)
   if x<int(W*.14) and (maxv+minv)/2>=190:
    light_edge.append((r,g,b))
   hue,saturation,lightness=colorsys.rgb_to_hls(r/255,g/255,b/255)
   delta=(maxv-minv)/255
   if saturation<.065 or lightness<.13 or lightness>.99 or delta<.018:continue
   chromatic_count+=1
   binid=int(hue*12)%12
   if x>W*.18 and x<W*.86 and y<H*.72 and lightness>.45 and lightness<.985 and saturation>.08 and delta>.045:
    wash[binid]+=(saturation**.5)
   if saturation>=.12 and lightness<=.92:
    motifweight=.18 if x<W*.42 else 1.9
    painted[binid]+=motifweight*(delta**1.2)*(.65+saturation*.35)
 def choose(hist):
  if not hist:return None
  bins=[hist.get(i,0) for i in range(12)]
  pairs=[bins[i]+bins[(i+1)%12] for i in range(12)]
  top=max(range(12),key=lambda i:pairs[i])
  return {"approx_hue_degrees":(top*30+30)%360,"strength":round(pairs[top],3),"top_bins":[{"center_hue":(i*30+15)%360,"weight":round(v,2)} for i,v in sorted(enumerate(bins),key=lambda q:-q[1])[:4]]}
 edge=tohex(*[round(sum(a[i] for a in light_edge)/len(light_edge)) for i in range(3)]) if light_edge else None
 ph=hue(heading)
 return {
  "id":name,"version":version,"path":path,"size":list(im.size),"bytes":len(imagebytes),
  "published":{"background":bg,"heading":heading,"body":body,"outline":outline,"hue_degrees":round(ph,1) if ph is not None else None,"contrast":[contrast(bg,c) for c in (heading,body,outline)]},
  "painted_wash":choose(wash),"painted_motif":choose(painted),"light_left_edge":edge,
  "heading_vs_wash_hue_difference":hue_diff(ph,choose(wash)["approx_hue_degrees"]) if wash else None,
  "heading_vs_motif_hue_difference":hue_diff(ph,choose(painted)["approx_hue_degrees"]) if painted else None,
  "heading_vs_edge_hue_difference":hue_diff(ph,hue(edge)) if edge else None,
  "chromatic_pixels":chromatic_count
 }
report={"source":"Current published TaxPay SQL banner snapshot, 2026-11-10","read_only":True,"results":[]}
for banner in BANNERS:
 try:
  item=audit(*banner)
  report["results"].append(item)
  print(json.dumps(item,ensure_ascii=False))
 except Exception as e:
  print("AUDIT ERROR",banner[0],str(e))
  raise
out=Path("banner-pixel-audit.json")
out.write_text(json.dumps(report,indent=2),encoding="utf8")
summary=Path("banner-pixel-audit.md")
summary.write_text("# TaxPay public banner pixel audit\n\n| Banner | Saved heading | Dominant wash hue | Painted motif hue | Hue distance to wash | Left edge |\n|---|---|---|---|---|---|\n"+
 "\n".join("| {id} | {published[heading]} | {painted_wash[approx_hue_degrees]}° | {painted_motif[approx_hue_degrees]}° | {heading_vs_wash_hue_difference}° | {light_left_edge} |".format(**row) for row in report["results"])+"\n",encoding="utf8")
