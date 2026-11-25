import {simulationCategoryLabels,type SimulationCategory} from '../contracts/paymentSimulationContract';

// Display historical dedicated services without broadening simulator submissions.
export function recordedActivityCategoryLabel(category:unknown,language:'en'|'bn'):string {
  if(typeof category==='string'){
    if(Object.prototype.hasOwnProperty.call(simulationCategoryLabels,category))
      return simulationCategoryLabels[category as SimulationCategory][language];
    if(category==='GIFT_TAX')return language==='bn'?'দানকর':'Gift Tax';
    if(category==='TRAVEL_TAX')return language==='bn'?'ভ্রমণ কর':'Travel Tax';
    if(category.trim())return (language==='bn'?'অপরিচিত পেমেন্ট খাত: ':'Unrecognized payment category: ')+category;
  }
  return language==='bn'?'পেমেন্ট খাত পাওয়া যায়নি':'Payment category unavailable';
}
