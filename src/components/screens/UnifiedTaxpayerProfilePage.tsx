import React from 'react';
import {useTaxState} from '../../services/taxState';
import {TaxpayerPageHeading} from '../layout/TaxpayerPageStructure';
import {User1TaxpayerProfile} from './User1TaxpayerProfile';

/** Identical profile shell and field groups for every preview account (user1–user30).
 * The only variables are the authorized owner's account and registration data.
 */
export function UnifiedTaxpayerProfilePage(){
  const {language,previewAccount}=useTaxState();
  const bn=language==='bn';
  return <div data-testid="taxpayer-unified-profile-page"
    className={'taxpayer-workspace mx-auto max-w-7xl space-y-4 pb-12 '+(bn?'font-bengali':'')}>
    <TaxpayerPageHeading title={bn?'করদাতা প্রোফাইল':'Taxpayer profile'}/>
    {previewAccount?<User1TaxpayerProfile key={previewAccount.id} language={language} account={previewAccount}/>:
      <section className="rounded-xl border border-taxpay-border bg-white p-5" role="status">
        {bn?'প্রোফাইল দেখতে সাইন ইন করুন।':'Sign in to view your profile.'}
      </section>}
  </div>;
}
