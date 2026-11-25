import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {gzipSync} from 'node:zlib';

// Budget the actual deployed entry HTML and hashed files, not source estimates.
// A UI change cannot silently make all payment/dashboard modules eager again.
const dist=resolve(process.argv[2] ?? 'dist');
const html=readFileSync(join(dist,'index.html'),'utf8');
const assetsPrefix='/nbr-taxpay/assets/';
const refs=(pattern)=>[...html.matchAll(pattern)].map(match=>match[1]);
const scripts=refs(/<script\b[^>]*\bsrc="(\/nbr-taxpay\/assets\/[^"]+\.js)"/g);
const preloads=refs(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="(\/nbr-taxpay\/assets\/[^"]+\.js)"/g);
const styles=refs(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="(\/nbr-taxpay\/assets\/[^"]+\.css)"/g);
if(scripts.length!==1||styles.length!==1)
  throw new Error('Expected one built entry JS and CSS; production artifact shape changed');
if(new Set(preloads).size!==preloads.length)throw new Error('Duplicate startup preload');
const size=(path)=>{
  if(!path.startsWith(assetsPrefix)||path.includes('..'))
    throw new Error('Invalid startup asset reference');
  return gzipSync(readFileSync(join(dist,'assets',path.slice(assetsPrefix.length))),{level:9}).length;
};
const jsBytes=[...scripts,...preloads].reduce((sum,path)=>sum+size(path),0);
const cssBytes=styles.reduce((sum,path)=>sum+size(path),0);
const limits={js:195*1024,css:82*1024,preloads:10};
if(jsBytes>limits.js||cssBytes>limits.css||preloads.length>limits.preloads)
  throw new Error(`Startup budget exceeded: JS ${jsBytes} / ${limits.js} bytes, CSS ${cssBytes} / ${limits.css} bytes, preloads ${preloads.length} / ${limits.preloads}`);
console.log(`PASS: published startup budget JS ${(jsBytes/1024).toFixed(1)} KiB, CSS ${(cssBytes/1024).toFixed(1)} KiB, ${preloads.length} preloads`);
