#!/usr/bin/env node
/** Korbritto line-by-line UI inventory (read-only).
 * npm run audit:ui      -> JSON/Markdown diagnostics
 * npm run audit:ui:check -> nonzero if confirmed inline-style violations remain
 * Requires the existing TypeScript dev dependency.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=process.cwd();
const strict=process.argv.includes('--check');
const ignored=new Set(['.git','node_modules','dist','build','coverage','test-results','playwright-report']);
const files=[];
function visit(d){for(const x of fs.readdirSync(d,{withFileTypes:true})){if(ignored.has(x.name))continue;const p=path.join(d,x.name);if(x.isDirectory())visit(p);else if(/\.(tsx|ts|jsx|css|html)$/.test(x.name))files.push(path.relative(root,p).replaceAll('\\','/'));}}
visit(root);
const source=new Map(files.map(p=>[p,fs.readFileSync(path.join(root,p),'utf8')]));
const routes=new Set([...(source.get('src/services/routeContract.ts')?.match(/export const ROUTES\s*=\s*\[([\s\S]*?)\]/)?.[1]||'').matchAll(/['"]([^'"]+)['"]/g)].map(x=>x[1]));
const report=[];
const add=(file,line,code,severity,detail)=>report.push({file,line,code,severity,detail});
const locate=(s,i)=>s.slice(0,i).split('\n').length;
const allNonCss=[...source].filter(([p])=>!p.endsWith('.css')).map(([,s])=>s).join('\n');
const stats={files:files.length,lines:0,inlineStyle:0,directGenericText:0,cssUnusedCandidates:0,orphanHtml:0};
for(const [file,s] of source){
  stats.lines+=s.split('\n').length;
  if(/\.(tsx|jsx)$/.test(file)){
    const sf=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    const walk=node=>{
      if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
        const tag=node.tagName.getText(sf);
        const props=node.attributes.properties;
        const has=k=>props.some(p=>ts.isJsxAttribute(p)&&p.name.getText(sf)===k);
        const l=sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1;
        if(has('style')){add(file,l,'INLINE_STYLE','error',tag+' has JSX style prop');stats.inlineStyle++;}
        if(tag==='a'&&!has('href'))add(file,l,'LINK_NO_HREF','error','Anchor without href');
        if((tag==='button'||tag==='UiButton')&&!has('onClick')&&!has('disabled')&&!props.some(ts.isJsxSpreadAttribute)){
          const type=props.find(p=>ts.isJsxAttribute(p)&&p.name.getText(sf)==='type');
          if(!type||!type.initializer||type.initializer.getText(sf)!=='"submit"')add(file,l,'BUTTON_HANDLER_REVIEW','review','Check button action or parent form submission');
        }
      }
      if(ts.isJsxElement(node)&&['div','span'].includes(node.openingElement.tagName.getText(sf))){
        for(const ch of node.children)if(ts.isJsxText(ch)&&ch.getText(sf).trim()){
          const l=sf.getLineAndCharacterOfPosition(ch.getStart(sf)).line+1;
          add(file,l,'GENERIC_TEXT','warning','Review direct text in generic container');stats.directGenericText++;
        }
      }
      if(ts.isCallExpression(node)&&/^(navigate|go|onNavigate)$/.test(node.expression.getText(sf))&&node.arguments.length&&ts.isStringLiteral(node.arguments[0])&&!routes.has(node.arguments[0].text)){
        add(file,sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1,'ROUTE_UNREGISTERED','warning',node.arguments[0].text);
      }
      ts.forEachChild(node,walk);
    };walk(sf);
  }
  if(file.endsWith('.css')){
    for(const m of s.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/g))if(Number(m[1])<14)add(file,locate(s,m.index),'TYPE_BELOW_14','warning',m[1]+'px');
    for(const m of s.matchAll(/!important/g))add(file,locate(s,m.index),'CSS_IMPORTANT','review','Justify override');
    if(!file.includes('office-'))for(const m of new Set([...s.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(x=>x[1]))){
      if(!allNonCss.includes(m)){stats.cssUnusedCandidates++;add(file,locate(s,s.indexOf('.'+m)),'UNUSED_SELECTOR_CANDIDATE','review','Dynamic selectors and print usage need review: '+m);}
    }
  }
  if(file.endsWith('.html')){
    for(const m of s.matchAll(/\bstyle\s*=\s*["']/g)){stats.inlineStyle++;add(file,locate(s,m.index),'HTML_INLINE_STYLE','error','Inline style attribute');}
    if(/<style(?:\s|>)/i.test(s))add(file,locate(s,s.search(/<style(?:\s|>)/i)),'EMBEDDED_STYLE','error','Embedded stylesheet');
    if(file!=='index.html'&&![...source].some(([p,other])=>p!==file&&(other.includes(file)||other.includes(path.basename(file))))){stats.orphanHtml++;add(file,1,'ORPHAN_HTML','review','Check external references before removal');}
  }
}
report.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line||a.code.localeCompare(b.code));
const counts={error:report.filter(x=>x.severity==='error').length,warning:report.filter(x=>x.severity==='warning').length,review:report.filter(x=>x.severity==='review').length};
fs.writeFileSync('ui-audit-results.json',JSON.stringify({stats,counts,report},null,2)+'\n');
fs.writeFileSync('ui-audit-results.md','# Korbritto UI source audit\n\n'+JSON.stringify({stats,counts})+'\n\n'+report.map(x=>'- '+x.severity.toUpperCase()+' '+x.file+':'+x.line+' '+x.code+' — '+x.detail).join('\n')+'\n');
console.log(JSON.stringify({stats,counts},null,2));
if(strict&&counts.error)process.exitCode=1;
