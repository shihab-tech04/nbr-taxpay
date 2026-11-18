import React, { useState } from 'react';
import { Search, Trash2, UserRound } from 'lucide-react';
import { TaxpayerTinLookup, TaxpayerTinSearchResultCard } from '../ui/TaxpayerTinLookup';
import { lookupSampleTaxpayer } from '../../services/sampleTaxpayerLookup';
import { demoIncomeTaxTypeForTin } from '../../services/demoIncomeTaxType';
import type { OtherTaxAllocation, OtherTaxTaxpayer } from './OtherTaxBatchComposer';
import '../../styles/taxpay-unified-v3.css';

/**
 * Frozen All Tax Payments v3 Step 1. The existing GuestPayment flow owns all
 * payer, allocation, receipt and SQL/API state. This is presentation only and
 * does not replace the original four-step Pay Tax / Travel Tax components.
 */
interface Props {
  language: 'en' | 'bn';
  primaryTin: string;
  primaryName: string;
  additional: OtherTaxTaxpayer[];
  confirmedTins: Record<string, string>;
  allocations: OtherTaxAllocation[];
  onAddPrimary: (tin: string, name: string) => void;
  onAddAdditional: (person: OtherTaxTaxpayer) => void;
  onRemove: (id: string) => void;
  error?: string;
}

const mask = (tin: string) => tin ? tin.slice(0, 3) + '*'.repeat(Math.max(0, tin.length - 3)) : '';
export function UnifiedTaxpayerWorkspace({
  language, primaryTin, primaryName, additional, confirmedTins,
  allocations, onAddPrimary, onAddAdditional, onRemove, error
}: Props) {
  const bn = language === 'bn';
  const tx = (en: string, bangla: string) => bn ? bangla : en;
  const [draftTin, setDraftTin] = useState('');
  const [searchedTin, setSearchedTin] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const searched = searchedTin === draftTin ? lookupSampleTaxpayer(draftTin) : null;
  const classification = searched ? demoIncomeTaxTypeForTin(searched.tin) : null;
  const selected: OtherTaxTaxpayer[] = [
    ...(primaryTin && confirmedTins.primary === primaryTin
      ? [{id:'primary', tin:primaryTin, name:primaryName}] : []),
    ...additional.filter(p => p.tin && confirmedTins[p.id] === p.tin),
  ];
  const duplicate = selected.some(p => p.tin === draftTin);
  const validTin = /^\d{12}$/.test(draftTin);
  const supportedProfile = Boolean(searched && classification && /^\d{12}$/.test(draftTin));
  const canAdd = supportedProfile && !duplicate;
  const identityType = (kind: string | null) =>
    kind === 'COMPANY' ? tx('Company', 'কোম্পানি') : tx('Individual', 'ব্যক্তি');
  const add = () => {
    if (!searched || !canAdd) return;
    const name = bn ? searched.nameBn : searched.nameEn;
    if (!selected.some(p => p.id === 'primary')) onAddPrimary(searched.tin, name);
    else onAddAdditional({id:crypto.randomUUID(),tin:searched.tin,name});
    setDraftTin(''); setSearchedTin(null);
    setPendingRemoval(null);
  };
  return <div className="payment-form-layout payment-flow-embedded__identity unified-taxpayer-workspace" data-testid="unified-taxpayer-workspace">
    <section className="payment-form-layout__sections unified-taxpayer-workspace__editor">
      <h2 className="unified-taxpayer-workspace__heading">{tx('Add taxpayer', 'করদাতা যোগ করুন')}</h2>
      <p className="unified-taxpayer-workspace__subheading">{tx('Enter a TIN and search.', 'টিআইএন লিখে অনুসন্ধান করুন।')}</p>
      <TaxpayerTinLookup
        language={language} tinId="guest-tin" nameId="unified-taxpayer-name"
        tin={draftTin} name={searched ? (bn ? searched.nameBn : searched.nameEn) : ''}
        onTinChange={value => {setDraftTin(value);setSearchedTin(null);}}
        onClear={() => {setDraftTin('');setSearchedTin(null);}}
        onSearch={() => setSearchedTin(draftTin)} canSearch={validTin}
        maxTinLength={12} suggestedTins={[]} omitNameField submitOnEnter
        searchLabel={tx('Search taxpayer TIN','করদাতার টিআইএন অনুসন্ধান')}
        inputTestId="unified-tin-input" segmentsTestId="unified-v5-tin-blocks"
        className="unified-taxpayer-workspace__shared-lookup"
      />
      <div className="unified-taxpayer-workspace__result" aria-live="polite">
        {!searchedTin && <div className="unified-taxpayer-workspace__empty">
          <Search size={24} aria-hidden="true"/>
          <span>{selected.length ? tx('Search another TIN to add a taxpayer.', 'আরেকজন করদাতা যোগ করতে টিআইএন অনুসন্ধান করুন।') : tx('Search a TIN to view taxpayer information.', 'করদাতার তথ্য দেখতে টিআইএন অনুসন্ধান করুন।')}</span>
        </div>}
        {searchedTin && !searched && <p role="alert" className="unified-taxpayer-workspace__error">{tx('TIN information not found.', 'টিআইএন তথ্য পাওয়া যায়নি।')}</p>}
        {searched && <TaxpayerTinSearchResultCard
          key={searched.tin} language={language} tin={searched.tin}
          name={bn ? searched.nameBn : searched.nameEn}
          classification={classification ? identityType(classification) : undefined}
          duplicateMessage={duplicate ? tx('Taxpayer already added.', 'করদাতা ইতিমধ্যে যোগ করা হয়েছে।') : undefined}
          classificationError={!classification
            ? tx('Income tax type is not confirmed for this sample profile.', 'এই নমুনা প্রোফাইলে আয়করের ধরন নিশ্চিত নয়।')
            : undefined}
          onAdd={add} canAdd={canAdd} testId="unified-taxpayer-search-result"
        />}
      </div>
      {error && <p role="alert" className="unified-taxpayer-workspace__error">{error}</p>}
    </section>
    <aside className="unified-taxpayer-workspace__rail" aria-label={tx('Taxpayers in this payment', 'এই পেমেন্টের করদাতারা')}>
      <h3 className="unified-taxpayer-workspace__rail-title"><UserRound size={17} aria-hidden="true"/>
        {tx('Taxpayers in this payment', 'এই পেমেন্টের করদাতারা')}
        <span aria-live="polite" data-testid="unified-taxpayer-count">{selected.length}</span>
      </h3>
      <div className="unified-taxpayer-workspace__list">
        {!selected.length && <div className="unified-taxpayer-workspace__selected-empty"><UserRound size={18} aria-hidden="true"/><strong>{tx('No taxpayers added', 'কোনো করদাতা যোগ করা হয়নি')}</strong></div>}
        {selected.map((person,index) => {
          const count = allocations.filter(line=>line.taxpayerId===person.id).length;
          const confirming = pendingRemoval === person.id;
          return <div key={person.id} className="unified-taxpayer-workspace__person">
            <div className="unified-taxpayer-workspace__person-main">
              <span className="unified-taxpayer-workspace__avatar" aria-hidden="true">{index+1}</span>
              <div className="unified-taxpayer-workspace__person-copy"><strong>{person.name}{demoIncomeTaxTypeForTin(person.tin) && <span> · {identityType(demoIncomeTaxTypeForTin(person.tin))}</span>}</strong><small>{mask(person.tin)}</small></div>
              <button className="unified-taxpayer-workspace__remove" aria-label={tx('Remove ', 'সরান ') + person.name}
                title={tx('Remove taxpayer', 'করদাতা সরান')} type="button"
                onClick={()=>count ? setPendingRemoval(person.id):onRemove(person.id)}><Trash2 size={17}/></button>
            </div>
            {confirming && <div className="unified-taxpayer-workspace__confirm" role="alert">
              <span>{tx('This also removes the taxpayer’s assigned payment heads. Continue?', 'এই করদাতার নির্বাচিত খাতও বাদ যাবে। এগোবেন?')}</span>
              <button type="button" onClick={()=>{onRemove(person.id);setPendingRemoval(null);}}>{tx('Remove', 'সরান')}</button>
              <button type="button" onClick={()=>setPendingRemoval(null)}>{tx('Cancel', 'বাতিল')}</button>
            </div>}
          </div>;
        })}
      </div>
    </aside>
  </div>;
}
