import React, {useState} from 'react';
import {useTaxState} from '../../services/taxState';
import {useAccountIdentity} from '../../services/accountIdentity';
import {TaxPayModal} from '../ui/TaxPayModal';

/** UI-only Gift Tax entry. There is no configured Gift Tax payment head.
 * NEVER create a challan, draft, financial charge, or tax credit here. */
export function GiftTaxEntryModal({onClose}: {onClose: () => void}) {
  const {language, previewAccount} = useTaxState();
  const {user} = useAccountIdentity();
  const signedIn = Boolean(user || previewAccount);
  const bn = language === 'bn';
  const tr = (en: string, bd: string) => bn ? bd : en;
  const [step, setStep] = useState<1|2|3>(1);
  const [payer, setPayer] = useState<'self'|'other'>('self');
  const [tin, setTin] = useState('');
  const [year, setYear] = useState('2025-2026');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [errors, setErrors] = useState<{tin?: string; amount?: string}>({});
  const needsTin = !signedIn || payer === 'other';
  const field = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600';
  const secondary = 'min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50';
  const primary = 'min-h-11 rounded-lg bg-[#2C5EAD] px-5 py-2 text-sm font-semibold text-white hover:bg-[#244d9b]';
  function review() {
    const next: {tin?: string; amount?: string} = {};
    if (needsTin && !/^\d{12}$/.test(tin)) next.tin = tr('Enter a valid 12-digit taxpayer TIN.', 'করদাতার বৈধ ১২ সংখ্যার টিআইএন লিখুন।');
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || !Number.isFinite(Number(amount)) || Number(amount) <= 0)
      next.amount = tr('Enter an amount above zero, with up to two decimal places.', 'শূন্যের বেশি পরিমাণ লিখুন (সর্বোচ্চ দুই দশমিক স্থান)।');
    setErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() => document.getElementById(next.tin ? 'gift-tax-tin' : 'gift-tax-amount')?.focus());
    } else setStep(2);
  }
  const line = (label: string, value: React.ReactNode) => <div className="flex flex-wrap justify-between gap-2 border-b border-slate-200 py-3 last:border-b-0"><dt className="text-sm text-slate-600">{label}</dt><dd className="max-w-full break-words text-right text-sm font-semibold text-slate-900">{value}</dd></div>;
  return <TaxPayModal
    title={step === 2 ? tr('Review Gift Tax', 'দান করের তথ্য পর্যালোচনা') : tr('Gift Tax', 'দান কর')}
    ariaLabel={tr('Gift Tax', 'দান কর')}
    service="gift"
    closeIconLabel={tr('Close Gift Tax', 'দান কর বন্ধ করুন')}
    onClose={onClose}
    onBack={step === 2 ? () => setStep(1) : undefined}
    backLabel={tr('Edit Gift Tax details', 'দান করের তথ্য সম্পাদনা')}
    initialFocusSelector={step === 1 ? '[data-gift-tax-first-field]' : undefined}
    footer={step === 1 ? <>
      <button type="button" className={secondary} onClick={onClose}>{tr('Cancel', 'বাতিল')}</button>
      <button type="button" className={primary} onClick={review}>{tr('Continue', 'এগিয়ে যান')}</button>
    </> : step === 2 ? <>
      <button type="button" className={secondary} onClick={() => setStep(1)}>{tr('Edit', 'সম্পাদনা')}</button>
      <button type="button" className={primary} onClick={() => setStep(3)}>{tr('Finish review', 'পর্যালোচনা শেষ করুন')}</button>
    </> : <button type="button" className={primary} onClick={onClose}>{tr('Done', 'সম্পন্ন')}</button>}>
    {step === 1 && <div className="space-y-5" data-testid="gift-tax-entry-form">
      <p className="text-sm text-slate-600">{tr('Enter Gift Tax payment details.', 'দান কর পরিশোধের তথ্য দিন।')}</p>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{signedIn ? tr('Signed-in taxpayer', 'লগইন করা করদাতা') : tr('Walk-in payment', 'লগইন ছাড়া পেমেন্ট')}</div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-900">{tr('Payment for', 'যার জন্য পরিশোধ')} *</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" data-gift-tax-first-field aria-pressed={payer==='self'} className={secondary} onClick={() => {setPayer('self'); setErrors({});}}>{tr('Myself','নিজের জন্য')}</button>
          <button type="button" aria-pressed={payer==='other'} className={secondary} onClick={() => {setPayer('other'); setErrors({});}}>{tr('Another taxpayer','অন্য করদাতার জন্য')}</button>
        </div>
      </fieldset>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {needsTin && <div className="sm:col-span-2">
          <label htmlFor="gift-tax-tin" className="mb-1.5 block text-sm font-semibold">{tr('Taxpayer TIN','করদাতার টিআইএন')} *</label>
          <input id="gift-tax-tin" className={field} inputMode="numeric" autoComplete="off" maxLength={12} placeholder={tr('12-digit TIN','১২ সংখ্যার টিআইএন')} value={tin} aria-invalid={Boolean(errors.tin)} aria-describedby={errors.tin ? 'gift-tax-tin-error' : undefined} onChange={e => {setTin(e.target.value.replace(/\D/g,'').slice(0,12)); setErrors(v=>({...v,tin:undefined}));}}/>
          {errors.tin && <p role="alert" id="gift-tax-tin-error" className="text-sm text-red-700">{errors.tin}</p>}
        </div>}
        <div>
          <label htmlFor="gift-tax-year" className="mb-1.5 block text-sm font-semibold">{tr('Assessment year','করবর্ষ')} *</label>
          <select id="gift-tax-year" className={field} value={year} onChange={e=>setYear(e.target.value)}>
            <option value="2025-2026">2025–2026</option><option value="2026-2027">2026–2027</option>
          </select>
        </div>
        <div>
          <label htmlFor="gift-tax-amount" className="mb-1.5 block text-sm font-semibold">{tr('Amount to pay (৳)','পরিশোধের পরিমাণ (৳)')} *</label>
          <input id="gift-tax-amount" className={field} inputMode="decimal" placeholder="5000" value={amount} aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? 'gift-tax-amount-error' : undefined} onChange={e=>{setAmount(e.target.value);setErrors(v=>({...v,amount:undefined}));}}/>
          {errors.amount && <p role="alert" id="gift-tax-amount-error" className="text-sm text-red-700">{errors.amount}</p>}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="gift-tax-remarks" className="mb-1.5 block text-sm font-semibold">{tr('Remarks (optional)','মন্তব্য (ঐচ্ছিক)')}</label>
          <textarea id="gift-tax-remarks" rows={3} className={field} value={remarks} onChange={e=>setRemarks(e.target.value)}/>
        </div>
      </div>
    </div>}
    {step===2 && <div data-testid="gift-tax-review" className="space-y-3">
      <p className="text-sm text-slate-600">{tr('Check the details before continuing.','পরবর্তী ধাপের আগে তথ্য যাচাই করুন।')}</p>
      <dl className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
        {line(tr('Payment for','যার জন্য পরিশোধ'),payer==='self'?tr('Myself','নিজের জন্য'):tr('Another taxpayer','অন্য করদাতার জন্য'))}
        {needsTin && line(tr('Taxpayer TIN','করদাতার টিআইএন'),tin)}
        {line(tr('Assessment year','করবর্ষ'),year.replace('-','–'))}
        {line(tr('Amount to pay','পরিশোধের পরিমাণ'),'৳ '+Number(amount).toLocaleString(bn?'bn-BD':'en-BD',{maximumFractionDigits:2}))}
        {line(tr('Remarks','মন্তব্য'),remarks.trim()||'—')}
      </dl>
    </div>}
    {step===3 && <div data-testid="gift-tax-review-complete" className="space-y-3 text-center">
      <h3 className="text-lg font-semibold">{tr('Gift Tax details reviewed','দান করের তথ্য পর্যালোচনা সম্পন্ন')}</h3>
      <p className="text-sm leading-6 text-slate-600">{tr('Gift Tax payment is not enabled yet. No money was charged and no challan was created.','দান করের পেমেন্ট এখনো চালু হয়নি। কোনো টাকা কাটা হয়নি এবং কোনো চালান তৈরি হয়নি।')}</p>
    </div>}
  </TaxPayModal>;
}
