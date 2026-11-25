import {simulationCategoryLabels} from '../contracts/paymentSimulationContract';
import type {Language} from '../types/tax';

// Read-only Story 1 history contains services beyond the generic simulator's
// seven payable categories. Display the recorded type without broadening
// composer eligibility or inventing a type for unrecognized historical data.
const additional: Record<string,{en:string;bn:string}>={
  GIFT_TAX:{en:'Gift Tax',bn:'দানকর'},
  TRAVEL_TAX:{en:'Travel Tax',bn:'ভ্রমণ কর'},
};
export function recordedPaymentCategoryLabel(category:unknown,language:Language):string{
  if(typeof category==='string'){
    if(Object.hasOwn(simulationCategoryLabels,category))
      return simulationCategoryLabels[category as keyof typeof simulationCategoryLabels][language];
    if(Object.hasOwn(additional,category))return additional[category][language];
  }
  return language==='bn'?'কর ধরন পাওয়া যায়নি':'Payment type unavailable';
}
