import {execFileSync} from 'node:child_process';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {basename,dirname} from 'node:path';
const archive=process.argv[2];
if(!archive)throw Error('archive required');
const names=execFileSync('unzip',['-Z1',archive],{encoding:'utf8',maxBuffer:16*1024*1024}).trim().split('\n');
const pngs=names.filter(n=>n.endsWith('.png')&&n.includes('mui-snapshots/'));
const refs=pngs.filter(n=>/^default-.*\.png$|^landing-.*\.png$|^home2-.*\.png$|^home3-.*\.png$/.test(basename(n)));
const read=n=>execFileSync('unzip',['-p',archive,n],{maxBuffer:32*1024*1024});
function decode(buffer){
 if(buffer.readUInt32BE(0)!==0x89504e47)throw Error('not PNG');
 let width,height,bpp;const parts=[];let offset=8;
 while(offset+12<=buffer.length){
  const len=buffer.readUInt32BE(offset),kind=buffer.toString('ascii',offset+4,offset+8),bytes=buffer.subarray(offset+8,offset+8+len);
  if(kind==='IHDR'){width=bytes.readUInt32BE(0);height=bytes.readUInt32BE(4);if(bytes[8]!==8||bytes[12]!==0||![2,6].includes(bytes[9]))throw Error('unsupported PNG format');bpp=bytes[9]===2?3:4;}
  if(kind==='IDAT')parts.push(bytes);offset+=12+len;if(kind==='IEND')break;
 }
 const stride=width*bpp,raw=inflateSync(Buffer.concat(parts)),pixels=Buffer.alloc(stride*height);
 if(raw.length!==(stride+1)*height)throw Error('PNG dimensions mismatch');
 for(let y=0;y<height;y++){
  const mode=raw[y*(stride+1)],pos=y*stride,input=y*(stride+1)+1;if(mode>4)throw Error('bad filter');
  for(let x=0;x<stride;x++){
   const a=x>=bpp?pixels[pos+x-bpp]:0,b=y?pixels[pos+x-stride]:0,c=y&&x>=bpp?pixels[pos+x-stride-bpp]:0;
   let p=0;if(mode===1)p=a;else if(mode===2)p=b;else if(mode===3)p=(a+b)>>1;else if(mode===4){const v=a+b-c,pa=Math.abs(v-a),pb=Math.abs(v-b),pc=Math.abs(v-c);p=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
   pixels[pos+x]=(raw[input+x]+p)&255;
  }
 }
 return {width,height,bpp,pixels};
}
const compare=(a,b)=>{
 const x=decode(a),y=decode(b),byteEqual=a.equals(b);
 if(x.width!==y.width||x.height!==y.height||x.bpp!==y.bpp)return {byteEqual,dimensions:[x.width,x.height,y.width,y.height],pixelCount:null};
 let pixelCount=0,maxChannelDelta=0,minX=x.width,minY=x.height,maxX=-1,maxY=-1;const sample=[];
 for(let i=0;i<x.pixels.length;i+=x.bpp){
  let delta=0;for(let k=0;k<x.bpp;k++)delta=Math.max(delta,Math.abs(x.pixels[i+k]-y.pixels[i+k]));
  if(!delta)continue;
  pixelCount++;maxChannelDelta=Math.max(maxChannelDelta,delta);const index=i/x.bpp,px=index%x.width,py=Math.floor(index/x.width);
  minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);
  if(sample.length<12)sample.push({x:px,y:py,expected:[...x.pixels.subarray(i,i+x.bpp)],actual:[...y.pixels.subarray(i,i+y.bpp)]});
 }
 return {byteEqual,pixelCount,maxChannelDelta,bounds:pixelCount?[minX,minY,maxX,maxY]:null,dimensions:[x.width,x.height],sample};
};
const rows=[];
for(const ref of refs){
 const root=dirname(ref),name=basename(ref),control=root+'/main-control-'+name,candidate=root+'/candidate-'+name;
 if(!pngs.includes(control))continue;
 const reference=read(ref),actual=read(control);
 if(!reference.equals(actual))rows.push({scenario:ref,kind:'unchanged-Main self-control',...compare(reference,actual)});
 if(pngs.includes(candidate)){const ab=read(candidate);if(!reference.equals(ab))rows.push({scenario:ref,kind:'candidate comparison',...compare(reference,ab)});}
}
const aaGroups=new Map();
for(const n of pngs){const match=basename(n).match(/^aa-(\d+)-(.+\.png)$/);if(!match)continue;const k=dirname(n)+'/'+match[2],a=aaGroups.get(k)??[];a.push({name:n,index:Number(match[1])});aaGroups.set(k,a);}
for(const [scenario,frames] of aaGroups){
 if(refs.includes(scenario)||frames.length<2)continue;
 frames.sort((a,b)=>a.index-b.index);
 for(let i=1;i<frames.length;i++)rows.push({scenario,kind:'unreproducible Main A/A',pair:[frames[i-1].index,frames[i].index],...compare(read(frames[i-1].name),read(frames[i].name))});
}
if(!rows.length)throw Error('no mismatched captures found; archive paths require inspection');
console.log(JSON.stringify({priorRun:45680680337,artifact:15054482971,referenceCount:refs.length,comparisonFailures:rows.length,rows},null,2));
