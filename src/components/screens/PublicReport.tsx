import React,{useState} from 'react';
import {AlertTriangle, CheckCircle2} from 'lucide-react';
import {useTaxState} from '../../services/taxState';

/** Public preview only: never collect real bank details or promise delivery to government services. */
export function PublicReport(){
 const {language}=useTaxState();
 const bn=language==='bn';
 const [category,setCategory]=useState('payment');
 const [details,setDetails]=useState('');
 const [submitted,setSubmitted]=useState(false);
 return <section className={'public-report-page '+(bn?'font-bengali':'')} aria-labelledby="public-report-title">
   <header className="public-guide-intro">
     <p className="citizen-hub-eyebrow">{bn?'সহায়তা':'Support'}</p>
     <h1 id="public-report-title">{bn?'সমস্যা জানান':'Report a problem'}</h1>
     <p>{bn?'পেমেন্ট বা নিরাপত্তা সমস্যার ধরন জানান।':'Describe a payment or security concern.'}</p>
   </header>
   <div className="public-report-card">
     <div className="public-service-dialog__notice" role="note"><AlertTriangle size={17} aria-hidden="true"/>
       {bn?'এটি শুধু ফর্মের নমুনা। কোনো অভিযোগ প্রেরণ বা সরকারি টিকিট তৈরি হয় না।':'This is a form preview. No report is sent and no official ticket is created.'}
     </div>
     {submitted?<div role="status" className="public-report-result">
       <CheckCircle2 size={20} aria-hidden="true"/>
       <div><h2>{bn?'নমুনা ফর্ম সম্পন্ন':'Preview complete'}</h2>
         <p>{bn?'তথ্য কোথাও জমা হয়নি। প্রকৃত সমস্যায় ব্যাংক বা অনুমোদিত কর্তৃপক্ষের সঙ্গে যোগাযোগ করুন।':'Nothing was submitted. Contact your bank or an authorized service for a real issue.'}</p>
         <button type="button" onClick={()=>{setDetails('');setSubmitted(false);}}>{bn?'নতুন ফর্ম':'Start again'}</button>
       </div>
     </div>:<form onSubmit={e=>{e.preventDefault();if(details.trim().length>=10)setSubmitted(true);}}>
       <label htmlFor="public-report-type">{bn?'সমস্যার ধরন':'Issue type'}</label>
       <select id="public-report-type" value={category} onChange={e=>setCategory(e.target.value)}>
         <option value="payment">{bn?'পেমেন্টের সমস্যা':'Payment issue'}</option>
         <option value="reference">{bn?'রেফারেন্স বা রসিদ':'Receipt or reference'}</option>
         <option value="security">{bn?'নিরাপত্তা সমস্যা':'Security concern'}</option>
       </select>
       <label htmlFor="public-report-details">{bn?'সংক্ষিপ্ত বিবরণ':'Short description'}</label>
       <textarea id="public-report-details" rows={4} minLength={10} maxLength={500} required
         value={details} onChange={e=>setDetails(e.target.value)} placeholder={bn?'ব্যক্তিগত বা ব্যাংক তথ্য দেবেন না':'Do not enter personal or bank details'}/>
       <button className="public-report-submit" type="submit">{bn?'নমুনা ফর্ম দেখুন':'Review demo form'}</button>
     </form>}
     <p className="public-report-contact">{bn?'প্রকৃত অর্থ কাটা গেলে ব্যাংক বা পেমেন্ট সেবাদাতার সঙ্গে যোগাযোগ করুন।':'If money was debited, contact your bank or payment provider.'}</p>
   </div>
 </section>;
}
