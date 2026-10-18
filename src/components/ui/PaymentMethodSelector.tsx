import React from 'react';
import { Building2, CreditCard, Info, Landmark, Smartphone, WalletCards } from 'lucide-react';
import type { ChallanReceipt, Language } from '../../types/tax';

export type PaymentChannel = 'NOW' | 'OTC';
export type PaymentMethodGroup = 'mfs' | 'bank' | 'card';
export type PaymentMethod = ChallanReceipt['paymentMethod'];

export const ONLINE_PAYMENT_METHODS: ReadonlyArray<{ id: PaymentMethod; name: string; group: PaymentMethodGroup }> = [
  { id: 'BKASH', name: 'bKash', group: 'mfs' },
  { id: 'NAGAD', name: 'Nagad', group: 'mfs' },
  { id: 'ROCKET', name: 'Rocket', group: 'mfs' },
  { id: 'INTERNET_BANKING', name: 'Internet Banking', group: 'bank' },
  { id: 'SONALI_E_SHEBA', name: 'Sonali e-Sheba', group: 'bank' },
  { id: 'BEFTN_RTGS', name: 'BEFTN / RTGS', group: 'bank' },
  { id: 'VISA', name: 'Visa', group: 'card' },
  { id: 'MASTERCARD', name: 'Mastercard', group: 'card' },
];

export const paymentMethodLabel = (method: PaymentMethod | null, language: Language): string =>
  method === 'BANK_BRANCH' ? (language === 'bn' ? 'ব্যাংক শাখা' : 'Bank branch') :
  ONLINE_PAYMENT_METHODS.find(option => option.id === method)?.name ?? '—';

interface Props {
  language: Language;
  channel: PaymentChannel | null;
  methodGroup: PaymentMethodGroup | null;
  method: PaymentMethod | null;
  onChannelChange: (channel: PaymentChannel, method: PaymentMethod | null) => void;
  onGroupChange: (group: PaymentMethodGroup) => void;
  onMethodChange: (method: PaymentMethod) => void;
  simulateDecline: boolean;
  onSimulateDeclineChange: (value: boolean) => void;
}

/** All eight public payment services use the same channel and provider controls. */
export function PaymentMethodSelector({ language, channel, methodGroup, method, onChannelChange, onGroupChange, onMethodChange, simulateDecline, onSimulateDeclineChange }: Props) {
  const bn = language === 'bn';
  return <>
    <div className="payment-review__channels" role="group" aria-label={bn ? 'পেমেন্ট চ্যানেল' : 'Payment channel'}>
      <button type="button" aria-label={bn ? 'অনলাইনে পরিশোধ' : 'Pay online'} aria-pressed={channel === 'NOW'} className={`payment-review__channel ${channel === 'NOW' ? 'payment-review__channel--selected' : ''}`} onClick={() => onChannelChange('NOW', null)}><CreditCard size={23} aria-hidden="true" /><span><strong>{bn ? 'অনলাইনে পরিশোধ' : 'Pay online'}</strong><small>{bn ? 'মোবাইল ব্যাংকিং, ইন্টারনেট ব্যাংকিং বা কার্ড' : 'Mobile banking, internet banking or card'}</small></span><span className="payment-review__radio" /></button>
      <button type="button" aria-label={bn ? 'ব্যাংক শাখায় পরিশোধ' : 'Pay at a bank branch'} aria-pressed={channel === 'OTC'} className={`payment-review__channel ${channel === 'OTC' ? 'payment-review__channel--selected' : ''}`} onClick={() => onChannelChange('OTC', 'BANK_BRANCH')}><Building2 size={23} aria-hidden="true" /><span><strong>{bn ? 'ব্যাংক শাখায় পরিশোধ' : 'Pay at a bank branch'}</strong><small>{bn ? 'আগে চালান স্লিপ, পরে ব্যাংকে পরিশোধ' : 'Get a payment slip for the bank'}</small></span><span className="payment-review__radio" /></button>
    </div>
    {channel === 'NOW' && <div className="payment-review__methods">
      <fieldset><legend>{bn ? 'অনলাইন পেমেন্টের ধরন' : 'Select payment type'}</legend>
        <div className="payment-review__method-groups">
          {([{ id: 'mfs' as const, Icon: Smartphone, en: 'Mobile banking', bn: 'মোবাইল ব্যাংকিং' }, { id: 'bank' as const, Icon: Landmark, en: 'Internet banking', bn: 'ইন্টারনেট ব্যাংকিং' }, { id: 'card' as const, Icon: WalletCards, en: 'Cards', bn: 'কার্ড' }]).map(group =>
            <button type="button" key={group.id} aria-pressed={methodGroup === group.id} onClick={() => onGroupChange(group.id)} className={`payment-review__method-group${methodGroup === group.id ? ' payment-review__method-group--selected' : ''}`}><group.Icon size={20} aria-hidden="true" />{bn ? group.bn : group.en}</button>)}
        </div>
      </fieldset>
      {methodGroup && <fieldset className="payment-review__provider-fieldset">
        <legend>{methodGroup === 'mfs' ? (bn ? 'মোবাইল ব্যাংকিং সেবা' : 'Choose mobile banking service') : methodGroup === 'bank' ? (bn ? 'ব্যাংকিং পদ্ধতি' : 'Choose banking option') : (bn ? 'কার্ড নেটওয়ার্ক' : 'Choose card network')}</legend>
        <div className="payment-review__method-list">{ONLINE_PAYMENT_METHODS.filter(option => option.group === methodGroup).map(option => <label key={option.id} className={`payment-review__method ${method === option.id ? 'payment-review__method--selected' : ''}`}>
          <input type="radio" name="guest-gateway-method" aria-label={option.name} checked={method === option.id} onChange={() => onMethodChange(option.id)} />
          <span className={`payment-review__brand payment-review__brand--${option.id.toLowerCase()}`} aria-hidden="true">{option.id === 'MASTERCARD' ? <span className="payment-review__mastercard-mark" /> : ['BKASH', 'NAGAD', 'ROCKET', 'VISA'].includes(option.id) ? option.name : methodGroup === 'bank' ? <Landmark size={18} /> : <CreditCard size={18} />}</span><span>{option.name}</span>
        </label>)}</div>
      </fieldset>}
      <label className="payment-review__fail-toggle"><input type="checkbox" checked={simulateDecline} onChange={event => onSimulateDeclineChange(event.target.checked)} />{bn ? 'প্রত্যাখ্যাত পেমেন্টের ফল দেখুন' : 'Show declined payment outcome'}</label>
    </div>}
    {channel === 'OTC' && <p className="payment-review__bank-note"><Info size={16} aria-hidden="true" />{bn ? 'চালান তৈরি হওয়া মানেই কর পরিশোধ নয়। ব্যাংকের অর্থ ট্রেজারিতে নিষ্পন্ন হলে তবেই কর ক্রেডিট।' : 'Generating a challan does not mean tax is paid. Tax credit follows bank payment and Treasury settlement.'}</p>}
  </>;
}
