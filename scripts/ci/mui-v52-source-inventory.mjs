import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,relative,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {parse} from '@babel/parser';
const root=process.cwd(),register=JSON.parse(readFileSync('src/design-system/mui-v52-coverage.json','utf8'));
const items=[],edges=[],routeCases=[],seen=new Set(),renderEdges=[],routeRoots=[],unresolvedRenderEdges=[];
const raw=new Set(['button','input','select','textarea','table','dialog','a','UiButton','UiInput','UiSelect','UiTextarea','TaxPayDataGrid','TaxPayModal']);
const family=name=>/button|link/i.test(name)?'action':/input|select|textarea|checkbox|radio|switch|picker/i.test(name)?'form':/table|grid/i.test(name)?'record':/dialog|modal|drawer|popover|menu|tooltip/i.test(name)?'overlay':/typography|chip|alert|skeleton|progress|card|paper/i.test(name)?'presentation':'other';
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(resolve(dir,e.name)):/\.(tsx|jsx|ts|js)$/.test(e.name)?[resolve(dir,e.name)]:[]);}
function walk(node,fn,parent){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(n=>walk(n,fn,parent));return;}if(node.type)fn(node,parent);for(const [key,val] of Object.entries(node))if(!['loc','start','end','comments','tokens','leadingComments','trailingComments','extra'].includes(key))walk(val,fn,node);}
const sourceFiles=files(resolve(root,'src'));
const allFiles=new Set(sourceFiles.map(p=>relative(root,p).replaceAll('\\','/')));
const resolveLocal=(file,request)=>{if(!request?.startsWith('.'))return null;const p=relative(root,resolve(root,dirname(file),request)).replaceAll('\\','/');return [p,p+'.tsx',p+'.ts',p+'.jsx',p+'.js',p+'/index.tsx',p+'/index.ts'].find(x=>allFiles.has(x))??null;};
for(const absolute of sourceFiles){
 const file=relative(root,absolute).replaceAll('\\','/'),source=readFileSync(absolute,'utf8'),ast=parse(source,{sourceType:'module',plugins:['typescript','jsx']});
 const names=new Map(),counts=new Map();
 walk(ast,n=>{if(n.type==='ImportDeclaration'){for(const spec of n.specifiers)names.set(spec.local.name,n.source.value);edges.push({from:file,to:n.source.value,kind:'import'});}
 if(n.type==='CallExpression'&&n.callee.type==='Import'&&n.arguments[0]?.type==='StringLiteral')edges.push({from:file,to:n.arguments[0].value,kind:'lazy'});
 if(n.type==='VariableDeclarator'&&n.id.type==='Identifier'&&n.init?.type==='CallExpression'&&(n.init.callee?.property?.name==='lazy'||n.init.callee?.name==='lazy')){
  walk(n.init,q=>{if(q.type==='CallExpression'&&q.callee.type==='Import'&&q.arguments[0]?.type==='StringLiteral')names.set(n.id.name,q.arguments[0].value);});
 }
 if(file==='src/App.tsx'&&n.type==='SwitchCase'&&n.test?.type==='StringLiteral')routeCases.push(n.test.value);
 });
 if(file==='src/App.tsx')walk(ast,n=>{if(n.type!=='SwitchStatement'||n.discriminant?.name!=='currentRoute')return;let labels=[];for(const c of n.cases){labels.push(c.test?.value??'default');if(!c.consequent.length)continue;const roots=new Set();walk(c.consequent,q=>{if(q.type==='JSXOpeningElement'){const tag=source.slice(q.name.start,q.name.end),target=resolveLocal(file,names.get(tag));if(target)roots.add(target);}});for(const route of labels)routeRoots.push({route,roots:[...roots]});labels=[];}});
 walk(ast,n=>{
  if(n.type!=='JSXOpeningElement')return;
  const tag=source.slice(n.name.start,n.name.end),attrs=n.attributes.filter(x=>x.type==='JSXAttribute'),keys=attrs.map(a=>a.name.name),id=attrs.find(a=>a.name.name==='data-mui-coverage')?.value?.value;
  const target=resolveLocal(file,names.get(tag));if(target)renderEdges.push({from:file,to:target,tag,line:n.loc.start.line});else if(/^[A-Z]/.test(tag)&&!names.has(tag))unresolvedRenderEdges.push({file,tag,line:n.loc.start.line,reason:'local symbol, component slot, or dynamic render; requires call-site resolution'});
  const number=(counts.get(tag)||0)+1;counts.set(tag,number);
  const explicit=register.items.find(i=>i.id===id);
  const tagFamily=family(tag),candidate=raw.has(tag)||/^Mui|^Ui/.test(tag)||tagFamily!=='other'||keys.some(k=>['onClick','onChange','onSubmit','role','tabIndex'].includes(k));
  const frozen=/^src\/components\/screens\/(PublicLanding\.tsx|PublicHeroCarousel\.tsx|Home2Layout\.tsx|home2\/|home3\/)/.test(file);
  let classification=frozen?'HOME-FROZEN':candidate?'UNCLASSIFIED':'SEMANTIC_OR_CUSTOM_REVIEW';
  if(explicit){if(explicit.file!==file||explicit.component!==tag||seen.has(id))throw Error('Invalid or duplicate registered consumer '+id);classification=explicit.classification;seen.add(id);}
  const stable=id||'SCAN-'+createHash('sha256').update(file+'|'+tag+'|'+number).digest('hex').slice(0,16);
  items.push({id:stable,file,line:n.loc.start.line,column:n.loc.start.column,tag,importSource:names.get(tag)||null,attributes:keys,family:tagFamily,classification,registered:Boolean(explicit),route:explicit?.route||null,contextStatus:explicit?.contextStatus||null,implementation:explicit?.implementation||null});
 });
}
for(const item of register.items)if(!seen.has(item.id))throw Error('Missing registered consumer '+item.id);
const adj=new Map();for(const e of renderEdges){const set=adj.get(e.from)??new Set();set.add(e.to);adj.set(e.from,set);}
const visit=(roots)=>{const reached=new Set(),todo=[...roots];while(todo.length){const f=todo.pop();if(reached.has(f))continue;reached.add(f);for(const to of adj.get(f)??[])todo.push(to);}return reached;};
const routesByFile=new Map();for(const root of routeRoots){const reached=visit(root.roots);for(const f of reached){const list=routesByFile.get(f)??[];list.push(root.route);routesByFile.set(f,list);}}
const frozenReach=visit(['src/components/screens/PublicLanding.tsx','src/components/screens/Home2Layout.tsx','src/components/screens/home3/Home3Layout.tsx']);
const newFiles=new Set(register.items.filter(i=>i.id.startsWith('MUI-SESSION-NOTICE-')||i.id.startsWith('MUI-CORRECTION-NOTICE-')||i.id.startsWith('MUI-RECOVERED-HISTORY-')||i.id==='MUI-HISTORY-IDENTITY-RETRY'||(i.id.startsWith('MUI-JOURNEY-')||i.id.startsWith('MUI-DASHBOARD-DRAFT-')||i.id.startsWith('MUI-ANALYTICS-'))).map(i=>i.file));
for(const file of newFiles)if(frozenReach.has(file))throw Error('New scoped consumer directly reachable from a frozen homepage root: '+file);
for(const item of items){item.staticRoutes=routesByFile.get(item.file)??[];item.homeReachable=frozenReach.has(item.file);item.reachabilityStatus=item.staticRoutes.length?'STATIC_ONLY_RUNTIME_UNVERIFIED':'UNRESOLVED_OR_NOT_ROUTED';}
const groups={};for(const item of items.filter(x=>x.classification==='UNCLASSIFIED')){const key=item.file+' | '+item.family;groups[key]=(groups[key]||0)+1;}
const summary={sourceFiles:sourceFiles.length,jsxOccurrences:items.length,registeredExplicit:seen.size,homeFrozen:items.filter(x=>x.classification==='HOME-FROZEN').length,unclassifiedCandidates:items.filter(x=>x.classification==='UNCLASSIFIED').length,semanticOrCustomReview:items.filter(x=>x.classification==='SEMANTIC_OR_CUSTOM_REVIEW').length,eligibleDenominator:null,routeCases:[...new Set(routeCases)].sort(),remainingByFileFamily:groups,staticRouteRoots:routeRoots.length,resolvedRenderEdges:renderEdges.length,unresolvedRenderEdges:unresolvedRenderEdges.length,homeReachableFiles:frozenReach.size};
mkdirSync('mui-evidence',{recursive:true});writeFileSync('mui-evidence/source-inventory.json',JSON.stringify({summary,items,importEdges:edges,renderEdges,routeRoots,unresolvedRenderEdges,register},null,2));console.log(JSON.stringify({...summary,remainingByFileFamily:undefined},null,2));
if(process.argv.includes('--require-complete')&&(summary.unclassifiedCandidates||summary.semanticOrCustomReview||register.unresolved.length))throw Error('Coverage incomplete: unresolved source classification or ownership');
