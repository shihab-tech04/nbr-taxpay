import assert from 'node:assert/strict';
import {test} from 'node:test';
import {projectAccountTaxJourney} from '../src/services/accountTaxJourney';

const owner='00000000-0000-4000-8000-000000000111';
const request={id:'00000000-0000-4000-8000-000000000901',owner_uid:owner,
  category:'ADVANCE_TAX',assessment_year:'2026-27',request_status:'INFO_REQUESTED',
  submitted_at:'2026-10-01T10:00:00Z'};

test('journey follows only recorded application review events in chronology; never manufactures Treasury or credit',()=>{
  const rows=projectAccountTaxJourney(owner,[request],[
    {id:2,request_id:request.id,event_type:'OFFICER_INFO_REQUESTED',status_after:'INFO_REQUESTED',occurred_at:'2026-10-03T10:00:00Z'},
    {id:1,request_id:request.id,event_type:'OFFICER_ACKNOWLEDGED',status_after:'OFFICER_ACKNOWLEDGED',occurred_at:'2026-10-02T10:00:00Z'},
  ]);
  assert.deepEqual(rows.map(r=>r.source),['request','review_event','review_event']);
  assert.deepEqual(rows.map(r=>r.status),['INFO_REQUESTED','OFFICER_ACKNOWLEDGED','INFO_REQUESTED']);
  assert.deepEqual(rows.map(r=>r.assessmentYear),['2026-27','2026-27','2026-27']);
  assert.equal(rows.every(r=>r.reference===request.id),true);
  assert.equal(rows.some(r=>/TREASURY|POSTED|CREDIT_RECOGNIZED/.test(r.label)),false);
});

test('owner mismatch and orphan events fail closed instead of showing another account',()=>{
  assert.throws(()=>projectAccountTaxJourney(owner,[{...request,owner_uid:'00000000-0000-4000-8000-000000000222'}],[]),/Unexpected account journey record/);
  assert.throws(()=>projectAccountTaxJourney(owner,[request],[{
    id:3,request_id:'00000000-0000-4000-8000-000000000999',
    event_type:'UNKNOWN',status_after:'CLOSED',occurred_at:'2026-10-04T10:00:00Z',
  }]),/Unexpected account review event/);
  assert.equal(projectAccountTaxJourney(owner,[],[]).length,0);
});

test('unknown status is explicitly unavailable, not silently approved',()=>{
  const rows=projectAccountTaxJourney(owner,[{...request,request_status:'TREASURY_SETTLED'}],[]);
  assert.equal(rows[0].status,'UNVERIFIED');
});
