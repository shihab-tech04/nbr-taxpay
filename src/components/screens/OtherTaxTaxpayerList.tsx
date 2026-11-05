import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { TaxpayerTinLookup } from '../ui/TaxpayerTinLookup';
import { lookupSampleTaxpayer } from '../../services/sampleTaxpayerLookup';
import type { OtherTaxTaxpayer, OtherTaxAllocation } from './OtherTaxBatchComposer';

interface Props {
  language: 'en' | 'bn';
  primaryTin: string;
  primaryName: string;
  primaryConfirmed?: boolean;
  onPrimaryConfirmed?: () => void;
  onPendingDraftChange?: (pending: boolean) => void;
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
  language, primaryTin, primaryName, primaryConfirmed = false,
  onPrimaryConfirmed, onPendingDraftChange,
  lockedPrimary = false, singleTaxpayerLayout = false, allowAdditional = true,
  allowSyntheticDemoTin = false, additional, allocations, invalidId, tinError,
  onPrimaryTin, onPrimarySearch, onPrimaryName, onAdditional, onAllocations, onClearError,
}: Props) {
  const bn = language === 'bn';
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [searchedTins, setSearchedTins] = useState<Record<string, string>>({});
  // An additional taxpayer remains a local draft until explicitly confirmed.
  // The parent payment/SQL allocation arrays receive confirmed records only.
  const [draft, setDraft] = useState<OtherTaxTaxpayer | null>(null);
  const [editDraft, setEditDraft] = useState<OtherTaxTaxpayer | null>(null);
  const [draftSearchedTin, setDraftSearchedTin] = useState('');
  const canSearch = (tin: string) =>
    (allowSyntheticDemoTin || lockedPrimary ? /^\d{12,13}$/ : /^\d{12}$/).test(tin);
  const notFoundLabel = bn ? 'টিআইএন তথ্য পাওয়া যায়নি।' : 'TIN information not found.';
  const simpleSelf = singleTaxpayerLayout && !additional.length;
  const progressive = allowAdditional && !simpleSelf;
  const count = (progressive && !primaryConfirmed ? 0 : 1) + additional.length;
  const primaryAssigned = allocations.some(line => line.taxpayerId === 'primary');
  const primaryMatch = searchedTins.primary === primaryTin ? lookupSampleTaxpayer(primaryTin) : null;
  const primaryDuplicate = additional.some(person => person.tin === primaryTin);
  const lockedTinHelp = bn
    ? 'টিআইএন বদলাতে আগে এই করদাতার নির্বাচিত পেমেন্ট খাত সরান।'
    : 'To change this TIN, first remove this taxpayer’s selected payment heads.';
  const duplicateLabel = bn
    ? 'এই টিআইএন ইতিমধ্যে যোগ করা হয়েছে। অন্য টিআইএন খুঁজুন।'
    : 'This TIN is already added. Search for a different taxpayer.';

  useEffect(() => {
    if (focusId) document.getElementById('other-tax-tin-' + focusId)?.focus();
  }, [focusId]);

  const closeDraft = () => {
    setDraft(null);
    setEditDraft(null);
    setDraftSearchedTin('');
    setFocusId(null);
    onPendingDraftChange?.(false);
    onClearError();
  };
  const remove = (id: string) => {
    onAdditional(additional.filter(person => person.id !== id));
    onAllocations(allocations.filter(line => line.taxpayerId !== id));
    setPendingRemoval(null);
    onClearError();
  };
  const beginEdit = (person: OtherTaxTaxpayer) => {
    setEditDraft({ ...person });
    setDraftSearchedTin('');
    setFocusId(person.id);
    onPendingDraftChange?.(true);
  };
  const isDuplicate = (tin: string, currentId?: string) =>
    tin === primaryTin || additional.some(person => person.id !== currentId && person.tin === tin);

  const renderLookup = (person: OtherTaxTaxpayer, editing: boolean, assigned: number) => {
    const lookup = draftSearchedTin === person.tin ? lookupSampleTaxpayer(person.tin) : null;
    const duplicate = isDuplicate(person.tin, editing ? person.id : undefined);
    return <>
      <div className="taxpay-taxpayer-row__fields taxpay-taxpayer-row__fields--shared">
        <TaxpayerTinLookup language={language}
          tinId={'other-tax-tin-' + person.id} nameId={'other-tax-name-' + person.id}
          tin={person.tin}
          name={lookup ? (bn ? lookup.nameBn : lookup.nameEn) : person.name}
          maxTinLength={allowSyntheticDemoTin ? 13 : 12}
          tinPlaceholder={allowSyntheticDemoTin
            ? (bn ? '১২ বা ১৩ সংখ্যার টিআইএন' : '12- or 13-digit TIN')
            : (bn ? '১২ সংখ্যার টিআইএন' : '12-digit TIN')}
          readonlyTin={!editing || assigned > 0} canSearch={editing && canSearch(person.tin)}
          invalidTin={Boolean(tinError && invalidId === person.id)}
          tinDescribedBy={tinError && invalidId === person.id ? 'guest-payment-error-tin' : undefined}
          onTinChange={value => {
            if (!editing || assigned) return;
            if (draft?.id === person.id) setDraft({ ...person, tin: value, name: '' });
            if (editDraft?.id === person.id) setEditDraft({ ...person, tin: value, name: '' });
            setDraftSearchedTin('');
            onClearError();
          }}
          onClear={() => {
            if (!editing || assigned) return;
            if (draft?.id === person.id) setDraft({ ...person, tin: '', name: '' });
            if (editDraft?.id === person.id) setEditDraft({ ...person, tin: '', name: '' });
            setDraftSearchedTin('');
            onClearError();
          }}
          onSearch={() => {
            if (!editing || assigned) return;
            setDraftSearchedTin(person.tin);
            onClearError();
          }}
          helper={assigned > 0 ? <p className="text-xs text-slate-600">{lockedTinHelp}</p> : undefined}
          status={editing && draftSearchedTin === person.tin && !lookup
            ? <p className="taxpay-taxpayer-row__lookup-status" role="status">{notFoundLabel}</p> : undefined}
        />
      </div>
      {editing && lookup && duplicate && <p className="taxpay-taxpayer-row__lookup-status" role="alert">{duplicateLabel}</p>}
      {tinError && invalidId === person.id &&
        <p id="guest-payment-error-tin" className="payment-form-field-error" role="alert">{tinError}</p>}
      {editing && <div className="taxpay-taxpayer-row__add-confirm">
        {lookup && !duplicate && <button type="button" className="taxpay-taxpayer-row__confirm"
          onClick={() => {
            const confirmed = { ...person, name: lookup.nameEn };
            if (draft?.id === person.id) onAdditional([...additional, confirmed]);
            else onAdditional(additional.map(item => item.id === person.id ? confirmed : item));
            closeDraft();
          }}><Plus size={18} aria-hidden="true"/>
          {editDraft ? (bn ? 'করদাতা সংরক্ষণ করুন' : 'Save taxpayer') : (bn ? 'করদাতা যোগ করুন' : 'Add taxpayer')}
        </button>}
        <button type="button" className="taxpay-taxpayer-row__cancel" onClick={closeDraft}>
          {bn ? 'বাতিল' : 'Cancel'}
        </button>
      </div>}
    </>;
  };

  return <div className={'taxpay-taxpayer-list' + (simpleSelf ? ' taxpay-taxpayer-list--single' : '')}
    data-testid="other-tax-taxpayer-list">
    {!simpleSelf && <p className="sr-only" role="status" aria-live="polite">
      {bn ? 'মোট ' + count + ' জন করদাতা' : count + ' ' + (count === 1 ? 'taxpayer' : 'taxpayers') + ' added'}
    </p>}
    <article className={'taxpay-taxpayer-row' + (simpleSelf ? ' taxpay-taxpayer-row--single' : '')}
      data-testid="other-tax-primary-taxpayer">
      <div className="taxpay-taxpayer-row__header">
        <h3>{simpleSelf ? (bn ? 'করদাতার তথ্য' : 'Taxpayer Information') : (bn ? 'করদাতা ১' : 'Taxpayer 1')}</h3>
        {progressive && primaryConfirmed && <span className="taxpay-taxpayer-row__added">
          {bn ? 'যোগ করা হয়েছে' : 'Added'}
        </span>}
      </div>
      <div className="taxpay-taxpayer-row__fields taxpay-taxpayer-row__fields--shared">
        <TaxpayerTinLookup language={language} tinId="guest-tin" nameId="other-tax-primary-name"
          tin={primaryTin}
          name={simpleSelf && primaryMatch
            ? (bn ? primaryMatch.nameBn : primaryMatch.nameEn) : primaryMatch
              ? (bn ? primaryMatch.nameBn : primaryMatch.nameEn) : primaryName}
          maxTinLength={lockedPrimary || allowSyntheticDemoTin ? 13 : 12}
          tinPlaceholder={allowSyntheticDemoTin ? (bn ? '১২ বা ১৩ সংখ্যার টিআইএন' : '12- or 13-digit TIN')
            : (bn ? '১২ সংখ্যার টিআইএন' : '12-digit TIN')}
          readonlyTin={lockedPrimary || primaryAssigned} canSearch={canSearch(primaryTin)}
          invalidTin={Boolean(tinError && invalidId === 'primary')}
          tinDescribedBy={[tinError && invalidId === 'primary' ? 'guest-payment-error-tin' : '',
            primaryAssigned && !lockedPrimary ? 'other-tax-primary-tin-help' : ''].filter(Boolean).join(' ')}
          onTinChange={value => {
            if (!lockedPrimary && !primaryAssigned) {
              onPrimaryTin(value); onPrimaryName('');
              setSearchedTins(current => ({ ...current, primary: '' }));
              onClearError();
            }
          }}
          onClear={() => {
            if (!lockedPrimary && !primaryAssigned) {
              onPrimaryTin(''); onPrimaryName('');
              setSearchedTins(current => ({ ...current, primary: '' }));
              onClearError();
            }
          }}
          onSearch={() => {
            onPrimarySearch();
            const match = lookupSampleTaxpayer(primaryTin);
            if (!lockedPrimary) onPrimaryName(match?.nameEn ?? '');
            setSearchedTins(current => ({ ...current, primary: primaryTin }));
            onClearError();
          }}
          helper={primaryAssigned && !lockedPrimary
            ? <p id="other-tax-primary-tin-help" className="text-xs text-slate-600">{lockedTinHelp}</p> : undefined}
          status={Boolean(primaryTin) && searchedTins.primary === primaryTin && !lookupSampleTaxpayer(primaryTin)
            ? <p className="taxpay-taxpayer-row__lookup-status" role="status">{notFoundLabel}</p> : undefined}/>
      </div>
      {tinError && (!invalidId || invalidId === 'primary') &&
        <p id="guest-payment-error-tin" className="payment-form-field-error" role="alert">{tinError}</p>}
      {progressive && primaryMatch && primaryDuplicate &&
        <p className="taxpay-taxpayer-row__lookup-status" role="alert">{duplicateLabel}</p>}
      {progressive && !primaryConfirmed && primaryMatch && !primaryDuplicate &&
        <div className="taxpay-taxpayer-row__add-confirm">
          <button type="button" className="taxpay-taxpayer-row__confirm"
            onClick={() => { onPrimaryConfirmed?.(); onClearError(); }}>
            <Plus size={18} aria-hidden="true"/>{bn ? 'করদাতা যোগ করুন' : 'Add taxpayer'}
          </button>
        </div>}
    </article>
    {additional.map((person, index) => {
      const assigned = allocations.filter(line => line.taxpayerId === person.id).length;
      const removing = pendingRemoval === person.id;
      const currentlyEditing = editDraft?.id === person.id;
      return <article key={person.id} className="taxpay-taxpayer-row" data-testid="other-tax-taxpayer">
        <div className="taxpay-taxpayer-row__header">
          <h3>{bn ? 'করদাতা' : 'Taxpayer'} {index + 2}</h3>
          <span className="taxpay-taxpayer-row__added">{bn ? 'যোগ করা হয়েছে' : 'Added'}</span>
          {!currentlyEditing && assigned === 0 && <button type="button" className="taxpay-taxpayer-row__edit"
            aria-label={(bn ? 'সম্পাদনা করদাতা ' : 'Edit taxpayer ') + (index + 2)}
            onClick={() => beginEdit(person)}><Pencil size={16} aria-hidden="true"/></button>}
          <button type="button" className="taxpay-taxpayer-row__remove"
            aria-label={(bn ? 'করদাতা ' : 'Remove taxpayer ') + (index + 2) + (bn ? ' মুছুন' : '')}
            title={(bn ? 'করদাতা ' : 'Remove taxpayer ') + (index + 2) + (bn ? ' মুছুন' : '')}
            onClick={() => assigned && !removing ? setPendingRemoval(person.id) : remove(person.id)}>
            <Trash2 size={17} aria-hidden="true"/>
          </button>
        </div>
        {renderLookup(currentlyEditing && editDraft ? editDraft : person, currentlyEditing, assigned)}
        {removing && <div className="taxpay-taxpayer-row__confirmation" role="alert">
          <p>{bn ? 'এই করদাতার ' + assigned + 'টি পেমেন্ট খাতও মুছে যাবে। নিশ্চিত করবেন?' :
            'Removing this taxpayer will also remove ' + assigned + ' assigned payment ' +
              (assigned === 1 ? 'head' : 'heads') + '. Continue?'}</p>
          <button type="button" onClick={() => remove(person.id)}>{bn ? 'হ্যাঁ, মুছুন' : 'Yes, remove'}</button>
          <button type="button" onClick={() => setPendingRemoval(null)}>{bn ? 'বাতিল' : 'Cancel'}</button>
        </div>}
      </article>;
    })}
    {draft && <article className="taxpay-taxpayer-row" data-testid="other-tax-taxpayer" data-taxpayer-status="draft">
      <div className="taxpay-taxpayer-row__header">
        <h3>{bn ? 'করদাতা' : 'Taxpayer'} {additional.length + 2}</h3>
      </div>
      {renderLookup(draft, true, 0)}
    </article>}
    {progressive && primaryConfirmed && !draft && !editDraft && <button type="button"
      className="taxpay-taxpayer-list__add" onClick={() => {
        const id = crypto.randomUUID();
        setDraft({ id, tin: '', name: '' });
        setDraftSearchedTin('');
        setFocusId(id);
        setPendingRemoval(null);
        onPendingDraftChange?.(true);
        onClearError();
      }}>
      <Plus size={18} aria-hidden="true"/>
      {bn ? 'আরেকজন করদাতা যোগ করুন' : 'Add another taxpayer'}
    </button>}
  </div>;
}
