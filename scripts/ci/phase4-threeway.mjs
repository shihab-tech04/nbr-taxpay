/** Read-only, API-independent reconciliation of an original source, V2 and Office.
 * V2 has precedence for identical cloned records; conflicting ID reuse blocks release.
 * No personal identifiers appear in reports. Does not authorize financial settlement.
 */
import {createHash} from 'node:crypto';
import {reconcile} from './phase4-reconcile.mjs';
const fingerprint=id=>createHash('sha256').update(String(id)).digest('hex').slice(0,12);
const key=row=>typeof row?.id==='string'&&row.id.trim()?row.id.trim():null;

export function reconcileThreeWay(originalRows,v2Rows,officeRows){
  for(const [label,rows] of [['original',originalRows],['v2',v2Rows],['office',officeRows]])
    if(!Array.isArray(rows))throw Error('INVALID_'+label.toUpperCase()+'_EXPORT');
  const originalIds=new Set(originalRows.map(key).filter(Boolean));
  const v2Ids=new Set(v2Rows.map(key).filter(Boolean));
  const historical=reconcile(originalRows,officeRows.filter(r=>originalIds.has(key(r))));
  const v2=reconcile(v2Rows,officeRows.filter(r=>v2Ids.has(key(r))));
  const sourceProblems=[];
  const sourceMap=new Map();
  for(const [name,rows] of [['original',originalRows],['v2',v2Rows]]){
    const seen=new Set();
    for(const row of rows){
      const id=key(row);
      if(!id){sourceProblems.push({system:name,record:null,field:'payment',reason:'MISSING_ID'});continue;}
      if(seen.has(id)){sourceProblems.push({system:name,record:fingerprint(id),field:'payment',reason:'DUPLICATE_ID'});continue;}
      seen.add(id);
      const previous=sourceMap.get(id);
      if(previous){
        if(!reconcile([previous],[row]).parityPassed){
          sourceProblems.push({record:fingerprint(id),field:'payment',reason:'SOURCE_COLLISION'});
          continue;
        }
      }
      sourceMap.set(id,row); // V2 takes precedence only for identical parents.
    }
  }
  const combined=reconcile([...sourceMap.values()],officeRows);
  if(sourceProblems.length){
    combined.issues.push(...sourceProblems);
    combined.parityPassed=false;
    combined.fieldComplete=false;
  }
  return {historical,v2,combined,sourceProblems,
    // Counts are evidence of coverage only; no API or payment-settlement claim.
    releaseVerified:false};
}
