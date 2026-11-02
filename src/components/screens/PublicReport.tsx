import {useRef,useState} from 'react';
import {useTaxState} from '../../services/taxState';
import {supabase} from '../../services/supabaseClient';

type ReportAck={reference:string;trackingToken:string;status:string};

export function PublicReport(){
 const {language}=useTaxState();
 const bn=language==='bn';
 const [category,setCategory]=useState('payment');
 const [details,setDetails]=useState('');
 const [reviewing,setReviewing]=useState(false);
 const [pending,setPending]=useState(false);
 const [error,setError]=useState('');
 const [ack,setAck]=useState<ReportAck|null>(null);
 const submissionKey=useRef<string>(crypto.randomUUID());
 const categories=[
   {value:'payment',en:'Payment issue',bn:'পেমেন্টের সমস্যা'},
   {value:'reference',en:'Receipt or reference',bn:'রেফারেন্স বা রসিদ'},
   {value:'security',en:'Security concern',bn:'নিরাপত্তা সমস্যা'},
 ];
 const categoryLabel=categories.find(item=>item.value===category);
 const edit=()=>{setReviewing(false);setError('');};
 const submit=async()=>{
   if(pending||ack)return;
   setError('');
   if(!supabase){
     setError(bn?'এখন রিপোর্ট পাঠানো যাচ্ছে না। পরে আবার চেষ্টা করুন।':'Reporting is temporarily unavailable. Please try again later.');
     return;
   }
   setPending(true);
   try{
     const {data,error:serviceError}=await supabase.functions.invoke('taxpay-public-report',{
       body:{category,details:details.trim(),submissionKey:submissionKey.current}
     });
     if(serviceError||!data||typeof data.reference!=='string'||typeof data.trackingToken!=='string')
       throw new Error('Report not accepted');
     setAck(data as ReportAck);
   }catch{
     setError(bn?'রিপোর্ট পাঠানো যায়নি। তথ্য ঠিক রেখে আবার চেষ্টা করুন।':'Report not sent. Your details are still here; please retry.');
   }finally{setPending(false);}
 };
 const reset=()=>{setAck(null);setReviewing(false);setCategory('payment');setDetails('');setError('');submissionKey.current=crypto.randomUUID();};
 return <section className={'public-report-page '+(bn?'font-bengali':'')} aria-labelledby="public-report-title">
   <header className="public-report-header">
     <h1 id="public-report-title">{bn?'সমস্যা জানান':'Report a problem'}</h1>
     <p>{bn?'পেমেন্ট, রসিদ বা নিরাপত্তা সংক্রান্ত সমস্যার বিবরণ দিন।':'Describe an issue with a payment, receipt or account security.'}</p>
   </header>
   <div className="public-report-card">
     {ack?<section className="public-report-review" aria-labelledby="public-report-success-title">
       <h2 id="public-report-success-title">{bn?'রিপোর্ট জমা হয়েছে':'Report submitted'}</h2>
       <p role="status">{bn?'আপনার রেফারেন্স নম্বরটি সংরক্ষণ করুন।':'Save this reference for follow-up.'}</p>
       <p><strong className="font-mono-plex">{ack.reference}</strong></p>
       <p>{bn?'রিপোর্ট জমা হওয়া মানে পেমেন্ট যাচাই বা নিষ্পত্তি হওয়া নয়।':'Submitting a report does not verify or settle a payment.'}</p>
       <div className="public-report-actions"><button className="public-report-edit" type="button" onClick={reset}>{bn?'নতুন রিপোর্ট':'New report'}</button></div>
     </section>:reviewing?<section className="public-report-review" aria-labelledby="public-report-review-title">
       <h2 id="public-report-review-title">{bn?'আপনার বিবরণ যাচাই করুন':'Review your details'}</h2>
       <dl>
         <div><dt>{bn?'সমস্যার ধরন':'Issue type'}</dt><dd>{bn?categoryLabel?.bn:categoryLabel?.en}</dd></div>
         <div><dt>{bn?'সংক্ষিপ্ত বিবরণ':'Short description'}</dt><dd>{details.trim()}</dd></div>
       </dl>
       <p>{bn?'ব্যাংক পিন, পাসওয়ার্ড বা ওটিপি লিখবেন না।':'Do not share passwords, PINs or one-time codes.'}</p>
       {error&&<p role="alert" className="public-report-error">{error}</p>}
       <div className="public-report-actions">
         <button type="button" className="public-report-edit" disabled={pending} onClick={edit}>{bn?'বিবরণ সম্পাদনা করুন':'Edit details'}</button>
         <button type="button" className="public-report-submit" disabled={pending} onClick={()=>void submit()}>{pending?(bn?'পাঠানো হচ্ছে…':'Sending…'):(bn?'রিপোর্ট জমা দিন':'Submit report')}</button>
       </div>
     </section>:<form onSubmit={e=>{e.preventDefault();if(details.trim().length>=10)setReviewing(true);}}>
       <label htmlFor="public-report-type">{bn?'সমস্যার ধরন':'Issue type'}</label>
       <select id="public-report-type" value={category} onChange={e=>{setCategory(e.target.value);submissionKey.current=crypto.randomUUID();}}>
         {categories.map(item=><option key={item.value} value={item.value}>{bn?item.bn:item.en}</option>)}
       </select>
       <label htmlFor="public-report-details">{bn?'সংক্ষিপ্ত বিবরণ':'Short description'}</label>
       <textarea id="public-report-details" rows={4} minLength={10} maxLength={500} required
         value={details} onChange={e=>{setDetails(e.target.value);submissionKey.current=crypto.randomUUID();}} placeholder={bn?'সমস্যাটি সংক্ষেপে লিখুন':'Describe what happened'}/>
       <div className="public-report-actions">
         <button className="public-report-submit" type="submit">{bn?'বিবরণ যাচাই করুন':'Review details'}</button>
       </div>
     </form>}
   </div>
 </section>;
}
