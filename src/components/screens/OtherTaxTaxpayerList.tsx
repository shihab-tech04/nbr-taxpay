import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { TaxpayerTinLookup } from '../ui/TaxpayerTinLookup';
import { lookupSampleTaxpayer } from '../../services/sampleTaxpayerLookup';
import type { OtherTaxTaxpayer, OtherTaxAllocation } from './OtherTaxBatchComposer';

interface Props {
  language: 'en' | 'bn';
  primaryTin: string;
  primaryName: string;
  lockedPrimary?: boolean;
  singleTaxpayerLayout?: boolean;
  allowAdditional?: boolean;
  allowSyntheticDemoTin?: boolean;
  confirmedTins: Record<string, string>;
  onConfirmTaxpayer: (id: string, tin: string) => void;
  additional: OtherTaxTaxpayer[];
  allocations: OtherTaxAllocation[];
  invalidId: string | null;
  tinError?: string;
  onPrimaryTin: (value: string) => void;
  onPrimarySearch: () => void;
  onPrimaryName: (value: string) => void;
  onAdditional: (people: OtherTaxTaxpayer[]) => void;
  onAllocations: (lines: OtherTaxAllocation[]) => void;
  onClearError: () => void;
}

export function OtherTaxTaxpayerList({
  language, primaryTin, primaryName, lockedPrimary = false, singleTaxpayerLayout = false, allowAdditional = true, allowSyntheticDemoTin = false, confirmedTins, onConfirmTaxpayer, additional, allocations, invalidId, tinError,
  onPrimaryTin, onPrimarySearch, onPrimaryName, onAdditional, onAllocations, onClearError
}: Props) {
  const bn = language === 'bn';
  const [addedId, setAddedId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [searchedTins, setSearchedTins] = useState<Record<string, string>>({});
  const canSearch = (tin: string) => (allowSyntheticDemoTin || lockedPrimary ? /^\d{12,13}$/ : /^\d{12}$/).test(tin);
  const searchLabel = bn ? 'খুঁজুন' : 'Search';
  const notFoundLabel = bn ? 'টিআইএন তথ্য পাওয়া যায়নি।' : 'TIN information not found.';
  const primaryAssigned = allocations.some(line => line.taxpayerId === 'primary');
  const simpleSelf = singleTaxpayerLayout && !additional.length;
  const lockedTinHelp = bn ? 'টিআইএন বদলাতে আগে এই করদাতার নির্বাচিত পেমেন্ট খাত সরান।' : 'To change this TIN, first remove this taxpayer’s selected payment heads.';
  const confirmed = (id: string, tin: string) => Boolean(tin) && confirmedTins[id] === tin;
  const duplicate = (id: string, tin: string) => Boolean(tin) &&
    (id !== 'primary' && primaryTin === tin || additional.some(person => person.id !== id && person.tin === tin));
  const primaryConfirmed = confirmed('primary', primaryTin);
  const count = allowAdditional
    ? (primaryConfirmed ? 1 : 0) + additional.filter(person => confirmed(person.id, person.tin)).length
    : additional.length + 1;
  const summary = (tin: string, fallbackName: string) => {
    const match = lookupSampleTaxpayer(tin);
    const displayName = match ? (bn ? match.nameBn : match.nameEn)
      : fallbackName || (bn ? 'দেওয়া হয়নি' : 'Not provided');
    return <dl className="taxpay-taxpayer-row__summary" data-testid="confirmed-taxpayer-summary">
      <div><dt>{bn ? 'করদাতার নাম' : 'Taxpayer name'}</dt><dd>{displayName}</dd></div>
      <div><dt>{bn ? 'টিআইএন' : 'TIN'}</dt><dd>{tin}</dd></div>
    </dl>;
  };
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
  return <div className={`taxpay-taxpayer-list${simpleSelf ? ' taxpay-taxpayer-list--single' : ''}`} data-testid="other-tax-taxpayer-list">
    {!simpleSelf && <p className="sr-only" role="status" aria-live="polite">
      {bn ? 'মোট ' + count + ' জন করদাতা' : count + ' ' + (count === 1 ? 'taxpayer' : 'taxpayers') + ' added'}
    </p>}
    <article className={`taxpay-taxpayer-row${simpleSelf ? ' taxpay-taxpayer-row--single' : ''}`} data-testid="other-tax-primary-taxpayer">
      <div className="taxpay-taxpayer-row__header">
        <h3>{simpleSelf ? (bn ? 'করদাতার তথ্য' : 'Taxpayer Information') : (bn ? 'করদাতা ১' : 'Taxpayer 1')}</h3>
        {allowAdditional && primaryConfirmed && <button type="button" className="taxpay-taxpayer-row__edit"
          onClick={() => { onConfirmTaxpayer('primary', ''); onPrimaryName(''); setSearchedTins(current => ({...current, primary: ''})); onClearError(); }}>
          <Pencil size={15} aria-hidden="true"/>{bn ? 'সম্পাদনা' : 'Edit'}
        </button>}
      </div>
      {allowAdditional && primaryConfirmed ? summary(primaryTin, primaryName) : <div className="taxpay-taxpayer-row__fields taxpay-taxpayer-row__fields--shared">
        <TaxpayerTinLookup language={language} tinId="guest-tin" nameId="other-tax-primary-name"
          tin={primaryTin}
          name={simpleSelf && searchedTins.primary === primaryTin && lookupSampleTaxpayer(primaryTin)
            ? (bn ? lookupSampleTaxpayer(primaryTin)!.nameBn : lookupSampleTaxpayer(primaryTin)!.nameEn) : primaryName}
          maxTinLength={lockedPrimary || allowSyntheticDemoTin ? 13 : 12}
          tinPlaceholder={allowSyntheticDemoTin ? (bn ? '১২ বা ১৩ সংখ্যার টিআইএন' : '12- or 13-digit TIN') : (bn ? '১২ সংখ্যার টিআইএন' : '12-digit TIN')}
          readonlyTin={lockedPrimary || primaryAssigned} canSearch={canSearch(primaryTin)}
          invalidTin={Boolean(tinError && invalidId === 'primary')}
          tinDescribedBy={[tinError && invalidId === 'primary' ? 'guest-payment-error-tin' : '', primaryAssigned && !lockedPrimary ? 'other-tax-primary-tin-help' : ''].filter(Boolean).join(' ')}
          onTinChange={value => { if (!lockedPrimary && !primaryAssigned) { onPrimaryTin(value); onPrimaryName(''); setSearchedTins(current => ({...current, primary: ''})); onClearError(); } }}
          onClear={() => { if (!lockedPrimary && !primaryAssigned) { onPrimaryTin(''); onPrimaryName(''); setSearchedTins(current => ({...current, primary: ''})); onClearError(); } }}
          onSearch={() => { onPrimarySearch(); const match=lookupSampleTaxpayer(primaryTin); if(!lockedPrimary)onPrimaryName(match?.nameEn ?? ''); setSearchedTins(current=>({...current, primary:primaryTin})); onClearError(); }}
          helper={primaryAssigned && !lockedPrimary ? <p id="other-tax-primary-tin-help" className="text-xs text-slate-600">{lockedTinHelp}</p> : undefined}
          status={Boolean(primaryTin) && searchedTins.primary === primaryTin && !lookupSampleTaxpayer(primaryTin)
            ? <p className="taxpay-taxpayer-row__lookup-status" role="status">{notFoundLabel}</p> : undefined}/>
      </div>}
      {allowAdditional && !primaryConfirmed && searchedTins.primary === primaryTin &&
        canSearch(primaryTin) && !duplicate('primary', primaryTin) &&
        <div className="taxpay-taxpayer-row__confirm-add"><button type="button" className="taxpay-taxpayer-row__add"
          onClick={() => { onConfirmTaxpayer('primary', primaryTin); onClearError(); }}>
          <Plus size={18} aria-hidden="true"/>{bn ? 'করদাতা যোগ করুন' : 'Add taxpayer'}
        </button></div>}
      {allowAdditional && !primaryConfirmed && searchedTins.primary === primaryTin && duplicate('primary', primaryTin) &&
        <p className="taxpay-taxpayer-row__lookup-status" role="status">{bn ? 'করদাতা ইতিমধ্যে যোগ করা হয়েছে।' : 'Taxpayer already added.'}</p>}
      {tinError && (!invalidId || invalidId === 'primary') &&
        <p id="guest-payment-error-tin" className="payment-form-field-error" role="alert">{tinError}</p>}
    </article>
    {additional.map((person, index) => {
      const assigned = allocations.filter(line => line.taxpayerId === person.id).length;
      const confirming = pendingRemoval === person.id;
      const personConfirmed = confirmed(person.id, person.tin);
      return <article key={person.id} className="taxpay-taxpayer-row" data-testid="other-tax-taxpayer">
        <div className="taxpay-taxpayer-row__header">
          <h3>{bn ? 'করদাতা' : 'Taxpayer'} {index + 2}</h3>
          {personConfirmed && <button type="button" className="taxpay-taxpayer-row__edit"
            onClick={() => { onConfirmTaxpayer(person.id, ''); edit(person.id, {name: ''});
              setSearchedTins(current => ({...current, [person.id]: ''})); }}>
            <Pencil size={15} aria-hidden="true"/>{bn ? 'সম্পাদনা' : 'Edit'}
          </button>}
          <button type="button" className="taxpay-taxpayer-row__remove"
            aria-label={(bn ? 'করদাতা ' : 'Remove taxpayer ') + (index + 2) + (bn ? ' মুছুন' : '')}
            title={(bn ? 'করদাতা ' : 'Remove taxpayer ') + (index + 2) + (bn ? ' মুছুন' : '')}
            onClick={() => assigned && !confirming ? setPendingRemoval(person.id) : remove(person.id)}>
            <Trash2 size={17} aria-hidden="true" />
          </button>
        </div>
        {personConfirmed ? summary(person.tin, person.name) : <div className="taxpay-taxpayer-row__fields taxpay-taxpayer-row__fields--shared">
          <TaxpayerTinLookup language={language} tinId={'other-tax-tin-' + person.id} nameId={'other-tax-name-' + person.id}
            tin={person.tin}
            name={searchedTins[person.id] === person.tin && lookupSampleTaxpayer(person.tin)
              ? (bn ? lookupSampleTaxpayer(person.tin)!.nameBn : lookupSampleTaxpayer(person.tin)!.nameEn) : person.name}
            maxTinLength={allowSyntheticDemoTin ? 13 : 12}
            tinPlaceholder={allowSyntheticDemoTin ? (bn ? '১২ বা ১৩ সংখ্যার টিআইএন' : '12- or 13-digit TIN') : (bn ? '১২ সংখ্যার টিআইএন' : '12-digit TIN')}
            readonlyTin={assigned > 0} canSearch={canSearch(person.tin)}
            invalidTin={Boolean(tinError && invalidId === person.id)}
            tinDescribedBy={[tinError && invalidId === person.id ? 'guest-payment-error-tin' : '', assigned > 0 ? 'other-tax-tin-help-' + person.id : ''].filter(Boolean).join(' ')}
            onTinChange={value => { if (!assigned) { edit(person.id,{tin:value,name:''}); setSearchedTins(current=>({...current,[person.id]:''})); } }}
            onClear={() => { if (!assigned) { edit(person.id,{tin:'',name:''}); setSearchedTins(current=>({...current,[person.id]:''})); } }}
            onSearch={() => { const match=lookupSampleTaxpayer(person.tin); edit(person.id,{name:match?.nameEn ?? ''}); setSearchedTins(current=>({...current,[person.id]:person.tin})); }}
            helper={assigned > 0 ? <p id={'other-tax-tin-help-' + person.id} className="text-xs text-slate-600">{lockedTinHelp}</p> : undefined}
            status={Boolean(person.tin) && searchedTins[person.id] === person.tin && !lookupSampleTaxpayer(person.tin)
              ? <p className="taxpay-taxpayer-row__lookup-status" role="status">{notFoundLabel}</p> : undefined} />
        </div>}
        {!personConfirmed && searchedTins[person.id] === person.tin &&
          canSearch(person.tin) && !duplicate(person.id, person.tin) &&
          <div className="taxpay-taxpayer-row__confirm-add"><button type="button" className="taxpay-taxpayer-row__add"
            onClick={() => { onConfirmTaxpayer(person.id, person.tin); onClearError(); }}>
            <Plus size={18} aria-hidden="true"/>{bn ? 'করদাতা যোগ করুন' : 'Add taxpayer'}
          </button></div>}
        {!personConfirmed && searchedTins[person.id] === person.tin && duplicate(person.id, person.tin) &&
          <p className="taxpay-taxpayer-row__lookup-status" role="status">{bn ? 'করদাতা ইতিমধ্যে যোগ করা হয়েছে।' : 'Taxpayer already added.'}</p>}
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
    {allowAdditional && primaryConfirmed && additional.every(person => confirmed(person.id, person.tin)) && <button type="button" className="taxpay-taxpayer-list__add"
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
