import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
  language, primaryTin, primaryName, lockedPrimary = false, singleTaxpayerLayout = false, allowAdditional = true, allowSyntheticDemoTin = false, additional, allocations, invalidId, tinError,
  onPrimaryTin, onPrimarySearch, onPrimaryName, onAdditional, onAllocations, onClearError
}: Props) {
  const bn = language === 'bn';
  const [addedId, setAddedId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [searchedTins, setSearchedTins] = useState<Record<string, string>>({});
  const canSearch = (tin: string) => (allowSyntheticDemoTin || lockedPrimary ? /^\d{12,13}$/ : /^\d{12}$/).test(tin);
  const searchLabel = bn ? 'খুঁজুন' : 'Search';
  const notFoundLabel = bn ? 'টিআইএন তথ্য পাওয়া যায়নি।' : 'TIN information not found.';
  const count = additional.length + 1;
  const primaryAssigned = allocations.some(line => line.taxpayerId === 'primary');
  const simpleSelf = singleTaxpayerLayout && !additional.length;
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
  return <div className={`taxpay-taxpayer-list${simpleSelf ? ' taxpay-taxpayer-list--single' : ''}`} data-testid="other-tax-taxpayer-list">
    {!simpleSelf && <p className="sr-only" role="status" aria-live="polite">
      {bn ? 'মোট ' + count + ' জন করদাতা' : count + ' ' + (count === 1 ? 'taxpayer' : 'taxpayers') + ' added'}
    </p>}
    <article className={`taxpay-taxpayer-row${simpleSelf ? ' taxpay-taxpayer-row--single' : ''}`} data-testid="other-tax-primary-taxpayer">
      <div className="taxpay-taxpayer-row__header">
        <h3>{simpleSelf ? (bn ? 'করদাতার তথ্য' : 'Taxpayer Information') : (bn ? 'করদাতা ১' : 'Taxpayer 1')}</h3>
      </div>
      <div className="taxpay-taxpayer-row__fields taxpay-taxpayer-row__fields--shared">
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
        <div className="taxpay-taxpayer-row__fields taxpay-taxpayer-row__fields--shared">
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
