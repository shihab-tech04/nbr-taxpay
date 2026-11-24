import React,{useEffect} from 'react';
import {useTaxState} from '../../services/taxState';
import {useAccountIdentity} from '../../services/accountIdentity';
import {activePreviewSession} from '../../services/previewAccountSession';
import {parseGiftTaxReuseDraft,type PaymentReuse} from '../../services/paymentReuse';
import {GiftTaxEntryModal} from './GiftTaxEntryModal';
import {validCertificateTransactionId} from '../../services/transactionId';

/** Isolated lazy-loaded entry. Do not add historical-payment validators to the
 * public startup bundle or bypass the live account ownership gate. */
export function GiftTaxReuseEntry({reuse}:{reuse:PaymentReuse}){
 const {previewAccount,setPaymentServiceChoiceOpen}=useTaxState();
 const {user,loading}=useAccountIdentity();
 const draft=!loading&&!user&&previewAccount?.id===reuse.ownerUid&&
  activePreviewSession()?.profileId===reuse.ownerUid&&reuse.service==='GIFT_TAX'&&validCertificateTransactionId(reuse.sourcePaymentId)
   ?parseGiftTaxReuseDraft(reuse.formPayload):null;
 useEffect(()=>{
  if(!loading&&!draft)setPaymentServiceChoiceOpen(false);
 },[loading,Boolean(draft),setPaymentServiceChoiceOpen]);
 if(!draft)return null;
 return <GiftTaxEntryModal signedIn initialReuse={draft} sourcePaymentId={reuse.sourcePaymentId} onClose={()=>setPaymentServiceChoiceOpen(false)}/>;
}
