import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { OtherTaxTaxpayer, OtherTaxAllocation } from './OtherTaxBatchComposer';

interface Props {
  language: 'en' | 'bn';
  primaryTin: string;
  primaryName: string;
  lockedPrimary?: boolean;
  allowAdditional?: boolean;
  allowSyntheticDemoTin?: boolean;
  additional: OtherTaxTaxpayer[];
  allocations: OtherTaxAllocation[];
  invalidId: string | null;
  tinError?: string;
  onPrimaryTin: (value: string) => void;
  onPrimaryName: (value: string) => void;
  onAdditional: (people: OtherTaxTaxpayer[]) => void;
  onAllocations: (lines: OtherTaxAllocation[]) => void;
  onClearError: () => void;
}

export function OtherTaxTaxpayerList({
  language, primaryTin, primaryName, lockedPrimary = false, allowAdditional = true, allowSyntheticDemoTin = false, additional, allocations, invalidId, tinError,
  onPrimaryTin, onPrimaryName, onAdditional, onAllocations, onClearError
}: Props) {
  const bn = language === 'bn';
  const [addedId, setAddedId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const count = additional.length + 1;
  const primaryAssigned = allocations.some(line => line.taxpayerId === 'primary');
  const lockedTinHelp = bn ? 'টিআইএন বদলাতে আগে এই করদাতার নির্বাচিত পেমেন্ট খাত সরান।' : 'To change this TIN, first remove this taxpayer’s selected payment heads.';
  useEffect(() => {
    if (addedId) document.getElementById('other-tax-tin-' + addedId)?.focus();
  }, [addedId]);

  const remove = (id: string) => {
    onAdditional(additional.filter(person => person.id !== id));
    onAllocations(allocations.filter(line => line.taxpayerId !== id));
    setPendingRemoval(null);
    onClearError();
  };
  const edit = (id: string, changes: Partial<OtherTaxTaxpayer>) => {
    onAdditional(additional.map(person => person.id === id ? { ...person, ...changes } : person));
    onClearError();
  };
  return <div className="taxpay-taxpayer-list" data-testid="other-tax-taxpayer-list">
    <p className="taxpay-taxpayer-list__count" aria-live="polite">
      {bn ? 'মোট ' + count + ' জন করদাতা' : count + ' ' + (count === 1 ? 'taxpayer' : 'taxpayers') + ' added'}
    </p>
    <article className="taxpay-taxpayer-row" data-testid="other-tax-primary-taxpayer">
      <div className="taxpay-taxpayer-row__header">
        <h3>{bn ? 'করদাতা ১' : 'Taxpayer 1'} <span>{bn ? 'প্রাথমিক' : 'Default'}</span></h3>
      </div>
      <div className="taxpay-taxpayer-row__fields">
        <div>
          <label htmlFor="guest-tin">{bn ? 'করদাতার টিআইএন' : 'Taxpayer TIN'} *</label>
          <input id="guest-tin" type="text" inputMode="numeric" maxLength={lockedPrimary || allowSyntheticDemoTin ? 13 : 12} autoComplete="off" required
            readOnly={lockedPrimary || primaryAssigned} aria-readonly={lockedPrimary || primaryAssigned || undefined}
            value={primaryTin} placeholder={allowSyntheticDemoTin ? (bn ? '১২ সংখ্যার বা ডেমো টিআইএন' : '12-digit or demo TIN') : bn ? '১২ সংখ্যার টিআইএন' : '12-digit TIN'}
            aria-invalid={Boolean(tinError && invalidId === 'primary') || undefined}
            aria-describedby={[tinError && invalidId === 'primary' ? 'guest-payment-error-tin' : '', primaryAssigned && !lockedPrimary ? 'other-tax-primary-tin-help' : ''].filter(Boolean).join(' ') || undefined}
            onChange={event => { if (!lockedPrimary && !primaryAssigned) { onPrimaryTin(event.target.value.replace(/\D/g, '').slice(0, allowSyntheticDemoTin ? 13 : 12)); onClearError(); } }} />
          {primaryAssigned && !lockedPrimary && <p id="other-tax-primary-tin-help" className="text-xs text-slate-600">{lockedTinHelp}</p>}
        </div>
        <div>
          <label htmlFor="other-tax-primary-name">{bn ? 'করদাতার নাম (ঐচ্ছিক)' : 'Taxpayer name (optional)'}</label>
          <input id="other-tax-primary-name" type="text" autoComplete="off" value={primaryName}
            placeholder={bn ? 'নাম জানা থাকলে লিখুন' : 'Enter name if known'} readOnly={lockedPrimary} aria-readonly={lockedPrimary || undefined}
            onChange={event => { if (!lockedPrimary) onPrimaryName(event.target.value); }} />
        </div>
      </div>
      {tinError && (!invalidId || invalidId === 'primary') &&
        <p id="guest-payment-error-tin" className="payment-form-field-error" role="alert">{tinError}</p>}
    </article>
    {additional.map((person, index) => {
      const assigned = allocations.filter(line => line.taxpayerId === person.id).length;
      const confirming = pendingRemoval === person.id;
      return <article key={person.id} className="taxpay-taxpayer-row" data-testid="other-tax-taxpayer">
        <div className="taxpay-taxpayer-row__header">
          <h3>{bn ? 'করদাতা' : 'Taxpayer'} {index + 2}</h3>
          <button type="button" className="taxpay-taxpayer-row__remove"
            aria-label={(bn ? 'করদাতা ' : 'Remove taxpayer ') + (index + 2) + (bn ? ' মুছুন' : '')}
            title={(bn ? 'করদাতা ' : 'Remove taxpayer ') + (index + 2) + (bn ? ' মুছুন' : '')}
            onClick={() => assigned && !confirming ? setPendingRemoval(person.id) : remove(person.id)}>
            <Trash2 size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="taxpay-taxpayer-row__fields">
          <div>
            <label htmlFor={'other-tax-tin-' + person.id}>{bn ? 'করদাতার টিআইএন' : 'Taxpayer TIN'} *</label>
            <input id={'other-tax-tin-' + person.id} type="text" inputMode="numeric" maxLength={allowSyntheticDemoTin ? 13 : 12}
              value={person.tin} required autoComplete="off" placeholder={allowSyntheticDemoTin ? (bn ? '১২ সংখ্যার বা ডেমো টিআইএন' : '12-digit or demo TIN') : bn ? '১২ সংখ্যার টিআইএন' : '12-digit TIN'}
              readOnly={assigned > 0} aria-readonly={assigned > 0 || undefined}
              aria-invalid={Boolean(tinError && invalidId === person.id) || undefined}
              aria-describedby={[tinError && invalidId === person.id ? 'guest-payment-error-tin' : '', assigned > 0 ? 'other-tax-tin-help-' + person.id : ''].filter(Boolean).join(' ') || undefined}
              onChange={event => { if (!assigned) edit(person.id, { tin: event.target.value.replace(/\D/g, '').slice(0, allowSyntheticDemoTin ? 13 : 12) }); }} />
            {assigned > 0 && <p id={'other-tax-tin-help-' + person.id} className="text-xs text-slate-600">{lockedTinHelp}</p>}
          </div>
          <div>
            <label htmlFor={'other-tax-name-' + person.id}>{bn ? 'করদাতার নাম (ঐচ্ছিক)' : 'Taxpayer name (optional)'}</label>
            <input id={'other-tax-name-' + person.id} type="text" autoComplete="off" value={person.name}
              placeholder={bn ? 'নাম জানা থাকলে লিখুন' : 'Enter name if known'}
              onChange={event => edit(person.id, { name: event.target.value })} />
          </div>
        </div>
        {tinError && invalidId === person.id &&
          <p id="guest-payment-error-tin" className="payment-form-field-error" role="alert">{tinError}</p>}
        {confirming && <div className="taxpay-taxpayer-row__confirmation" role="alert">
          <p>{bn ? 'এই করদাতার ' + assigned + 'টি পেমেন্ট খাতও মুছে যাবে। নিশ্চিত করবেন?' :
            'Removing this taxpayer will also remove ' + assigned + ' assigned payment ' + (assigned === 1 ? 'head' : 'heads') + '. Continue?'}</p>
          <button type="button" onClick={() => remove(person.id)}>{bn ? 'হ্যাঁ, মুছুন' : 'Yes, remove'}</button>
          <button type="button" onClick={() => setPendingRemoval(null)}>{bn ? 'বাতিল' : 'Cancel'}</button>
        </div>}
      </article>;
    })}
    {allowAdditional && <button type="button" className="taxpay-taxpayer-list__add"
      onClick={() => {
        const id = crypto.randomUUID();
        onAdditional([...additional, { id, tin: '', name: '' }]);
        setAddedId(id);
        setPendingRemoval(null);
        onClearError();
      }}>
      <Plus size={18} aria-hidden="true" />
      {bn ? 'আরেকজন করদাতা যোগ করুন' : 'Add another taxpayer'}
    </button>}
  </div>;
}
