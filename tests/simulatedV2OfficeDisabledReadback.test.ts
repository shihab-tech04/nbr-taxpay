import test from 'node:test';
import assert from 'node:assert/strict';
import { persistSimulatedPayment, type StoryPaymentInput } from '../src/services/simulatedPaymentStory';

const paymentId='33333333-3333-4333-8333-333333333333';
const input: StoryPaymentInput={
  idempotencyKey:'11111111-1111-4111-8111-111111111111',
  sessionId:'22222222-2222-4222-8222-222222222222',
  service:'OTHER_TAX_PAYMENT',amountMinor:1850,
  details:{payerMode:'SELF',assessmentYear:'2026-27'},
};

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
}

test('V2 simulation-only SQL acknowledgement is accepted only after exact source readback',async()=>{
  const original=globalThis.fetch;
  const methods:string[]=[];
  globalThis.fetch=(async(url,options)=>{
    methods.push(options?.method||'GET');
    if(options?.method==='POST')return json({
      success:true,id:paymentId,status:'SIMULATED_SUCCESS',mirrored:false,
      officeSyncStatus:'DISABLED',simulationOnly:true,
    });
    assert.match(String(url),new RegExp('/payments/'+paymentId));
    assert.ok(String(url).includes(encodeURIComponent(input.sessionId)));
    return json({success:true,simulationOnly:true,data:{
      id:paymentId,status:'SIMULATED_SUCCESS',
      data:{idempotencyKey:input.idempotencyKey,sessionId:input.sessionId,
        service:input.service,amountMinor:input.amountMinor},
    }});
  }) as typeof fetch;
  try {
    const result=await persistSimulatedPayment(input);
    assert.deepEqual(result,{success:true,id:paymentId,status:'SIMULATED_SUCCESS',
      mirrored:false,simulationOnly:true});
    assert.deepEqual(methods,['POST','GET']);
  }finally{globalThis.fetch=original;}
});

test('V2 disabled Office bridge cannot turn incorrect SQL source readback into success',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=(async(_url,options)=>{
    if(options?.method==='POST')return json({
      success:true,id:paymentId,status:'SIMULATED_SUCCESS',
      mirrored:false,officeSyncStatus:'DISABLED',simulationOnly:true,
    });
    return json({success:true,simulationOnly:true,data:{
      id:paymentId,status:'SIMULATED_SUCCESS',
      data:{idempotencyKey:'44444444-4444-4444-8444-444444444444',
        sessionId:input.sessionId,service:input.service,amountMinor:input.amountMinor},
    }});
  }) as typeof fetch;
  try{
    await assert.rejects(persistSimulatedPayment(input),/SIMULATION_READBACK_MISMATCH/);
  }finally{globalThis.fetch=original;}
});
