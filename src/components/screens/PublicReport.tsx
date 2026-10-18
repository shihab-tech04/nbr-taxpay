import {useState} from 'react';
import {useTaxState} from '../../services/taxState';

export function PublicReport(){
 const {language}=useTaxState();
 const bn=language==='bn';
 const [category,setCategory]=useState('payment');
 const [details,setDetails]=useState('');
 const [reviewing,setReviewing]=useState(false);
 const categories=[
   {value:'payment',en:'Payment issue',bn:'পেমেন্টের সমস্যা'},
   {value:'reference',en:'Receipt or reference',bn:'রেফারেন্স বা রসিদ'},
   {value:'security',en:'Security concern',bn:'নিরাপত্তা সমস্যা'},
 ];
 const categoryLabel=categories.find(item=>item.value===category);
 return <section className={'public-report-page '+(bn?'font-bengali':'')} aria-labelledby="public-report-title">
   <header className="public-report-header">
     <h1 id="public-report-title">{bn?'সমস্যা জানান':'Report a problem'}</h1>
     <p>{bn?'পেমেন্ট, রসিদ বা নিরাপত্তা সংক্রান্ত সমস্যার বিবরণ দিন।':'Describe an issue with a payment, receipt or account security.'}</p>
   </header>
   <div className="public-report-card">
     {reviewing?<section className="public-report-review" aria-labelledby="public-report-review-title">
       <h2 id="public-report-review-title">{bn?'আপনার বিবরণ যাচাই করুন':'Review your details'}</h2>
       <dl>
         <div><dt>{bn?'সমস্যার ধরন':'Issue type'}</dt><dd>{bn?categoryLabel?.bn:categoryLabel?.en}</dd></div>
         <div><dt>{bn?'সংক্ষিপ্ত বিবরণ':'Short description'}</dt><dd>{details.trim()}</dd></div>
       </dl>
       <div className="public-report-actions">
         <button type="button" className="public-report-edit" onClick={()=>setReviewing(false)}>{bn?'বিবরণ সম্পাদনা করুন':'Edit details'}</button>
       </div>
     </section>:<form onSubmit={e=>{e.preventDefault();if(details.trim().length>=10)setReviewing(true);}}>
       <label htmlFor="public-report-type">{bn?'সমস্যার ধরন':'Issue type'}</label>
       <select id="public-report-type" value={category} onChange={e=>setCategory(e.target.value)}>
         {categories.map(item=><option key={item.value} value={item.value}>{bn?item.bn:item.en}</option>)}
       </select>
       <label htmlFor="public-report-details">{bn?'সংক্ষিপ্ত বিবরণ':'Short description'}</label>
       <textarea id="public-report-details" rows={4} minLength={10} maxLength={500} required
         value={details} onChange={e=>setDetails(e.target.value)} placeholder={bn?'সমস্যাটি সংক্ষেপে লিখুন':'Describe what happened'}/>
       <div className="public-report-actions">
         <button className="public-report-submit" type="submit">{bn?'বিবরণ যাচাই করুন':'Review details'}</button>
       </div>
     </form>}
   </div>
 </section>;
}
