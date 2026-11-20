"""Fail-closed WS3 merge choices. Run only after picking protected Main for eight conflict paths."""
from pathlib import Path
def edit(path, pairs):
    p=Path(path); s=p.read_text(encoding='utf-8')
    for before, after in pairs:
        count=s.count(before)
        if count!=1: raise ValueError(f"Merge drift {path}: {count} matches for {before[:65]}")
        s=s.replace(before,after,1)
    p.write_text(s,encoding='utf-8')

edit('.github/workflows/phase7-auth-recipient-sql.yml',[
 ("      - ws5/v95-integrated-release-candidate-20261115",
  "      - release/taxpay-correction-notifications-20261101\n      - ws5/v95-integrated-release-candidate-20261115")
])
edit('src/components/screens/AccountCenter.tsx',[
 ("correctionMakerAcknowledged: 'Correction request acknowledged',","correctionOfficeInitiated: 'Office initiated a correction review', correctionMakerAcknowledged: 'Correction request acknowledged',"),
 ("correctionMakerAcknowledged: 'সংশোধনের অনুরোধ গ্রহণ করা হয়েছে',","correctionOfficeInitiated: 'অফিস থেকে সংশোধন পর্যালোচনা শুরু হয়েছে', correctionMakerAcknowledged: 'সংশোধনের অনুরোধ গ্রহণ করা হয়েছে',"),
 ("CORRECTION_MAKER_ACKNOWLEDGED:t.correctionMakerAcknowledged,","CORRECTION_OFFICE_INITIATED:t.correctionOfficeInitiated,\n                              CORRECTION_MAKER_ACKNOWLEDGED:t.correctionMakerAcknowledged,")
])
p='src/components/screens/CorrectionInquiries.tsx'
edit(p,[
 ('reason:string; requested_outcome:string; change_kind:','reason:string; requested_outcome:string; evidence_note?:string|null; change_kind:'),
 ('office_review_state:string|null; office_review_revision:number|null; office_review_updated_at:string|null;', "office_review_state:string|null; office_review_revision:number|null; office_review_updated_at:string|null;\n origin_system?:'TAXPAY_SQL'|'OFFICE_SQL';"),
 ("outcome:'What outcome are you requesting?',","outcome:'What outcome are you requesting?',evidenceNote:'Supporting evidence or document details (optional, not verified)',"),
 ("outcome:'কী ফলাফল চান?',","outcome:'কী ফলাফল চান?',evidenceNote:'সহায়ক প্রমাণ বা নথির বিবরণ (ঐচ্ছিক, যাচাই করা হয়নি)',"),
 ("historyActions:{SUBMITTED:'Inquiry submitted',","historyActions:{SUBMITTED:'Inquiry submitted',OFFICE_INITIATED:'Office initiated correction review',"),
 ("historyActions:{SUBMITTED:'অনুসন্ধান জমা হয়েছে',","historyActions:{SUBMITTED:'অনুসন্ধান জমা হয়েছে',OFFICE_INITIATED:'অফিস থেকে সংশোধন পর্যালোচনা শুরু হয়েছে',"),
 (" const [reason,setReason]=useState('');"," const [reason,setReason]=useState('');\n const [evidenceNote,setEvidenceNote]=useState('');"),
 ("  if(idError||!sameAuthenticatedOwner(who.user?.id,authenticatedUserId))throw new Error(labels.auth);\n  // F-094", """  if(idError||!sameAuthenticatedOwner(who.user?.id,authenticatedUserId))throw new Error(labels.auth);
  // Office-initiated cases are claimed only by an authenticated owner
  // passing the SQL ownership guard. Earlier schemas may lack this RPC.
  const {error:officeClaimError}=await supabase.rpc('taxpay_claim_office_initiated_corrections',{p_limit:20});
  if(officeClaimError && !(officeClaimError.code==='PGRST202' &&
    /taxpay_claim_office_initiated_corrections/i.test(officeClaimError.message??'')))throw officeClaimError;
  // F-094"""),
 ("      ...row,case_kind:row.case_kind??'CORRECTION_REVIEW',\n      office_review_state","      ...row,case_kind:row.case_kind??'CORRECTION_REVIEW',\n      evidence_note:row.evidence_note??null,origin_system:row.origin_system??'TAXPAY_SQL',\n      office_review_state"),
 ("!/case_kind|office_review_state|office_review_revision|office_review_updated_at/i.test(result.error.message??'')","!/evidence_note|origin_system|case_kind|office_review_state|office_review_revision|office_review_updated_at/i.test(result.error.message??'')"),
 ("     requested_outcome:desiredOutcome.trim(),","     requested_outcome:desiredOutcome.trim(),\n     ...(evidenceNote.trim()?{evidence_note:evidenceNote.trim()}:{}),"),
 ("setOriginalReference('');setReason('');setDesiredOutcome('');","setOriginalReference('');setReason('');setEvidenceNote('');setDesiredOutcome('');"),
 ("[r.original_reference,r.reason,r.requested_outcome,r.evidence_state,","[r.original_reference,r.reason,r.requested_outcome,r.evidence_note??'',r.evidence_state,"),
 ('''   <label className="block text-sm font-semibold text-slate-800">{labels.select}''','''   <label className="block text-sm font-semibold text-slate-800">{labels.evidenceNote}
    <UiTextarea maxLength={2000} rows={3} value={evidenceNote}
     onChange={e=>setEvidenceNote(e.target.value)} className="mt-2"
     data-testid="correction-supporting-evidence"/>
   </label>
   <label className="block text-sm font-semibold text-slate-800">{labels.select}'''),
 ('''<p className="text-sm font-semibold text-taxpay-muted">{r.case_kind==='UNSOLICITED_PAYMENT_REPORT'?labels.caseUnsolicited:labels.caseCorrection}</p>''','''<p className="text-sm font-semibold text-taxpay-muted">{r.origin_system==='OFFICE_SQL'?labels.historyActions.OFFICE_INITIATED:(r.case_kind==='UNSOLICITED_PAYMENT_REPORT'?labels.caseUnsolicited:labels.caseCorrection)}</p>'''),
 ('''                <p>{labels.outcomeLabel}: {r.requested_outcome}</p>
                {r.change_kind''','''                <p>{labels.outcomeLabel}: {r.requested_outcome}</p>
                {r.evidence_note&&<p className="whitespace-pre-wrap break-words">{labels.evidenceNote}: {r.evidence_note}</p>}
                {r.change_kind''')
])
# Replace the version-projection line without inserting script-language tokens
# into JavaScript template-string compilation.
s=Path(p).read_text(encoding='utf-8')
lines=[line for line in s.splitlines() if 'const projections=[' in line]
if len(lines)!=1: raise ValueError("Projection line drift")
t=chr(96);d=chr(36);base=t+d+'{base}';office=d+'{office}'+t
new="  const projections=["+','.join([
    base+',evidence_note,case_kind,origin_system'+office,
    base+',evidence_note,case_kind'+office,
    base+',case_kind'+office,
    base+office,
    base+',case_kind'+t,
    'base'
])+"] as const;"
s=s.replace(lines[0],new,1)
Path(p).write_text(s,encoding='utf-8')
