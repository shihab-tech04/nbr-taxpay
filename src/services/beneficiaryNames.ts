/** Internal storage value for an omitted contact name; never a taxpayer identity. */
export const BENEFICIARY_NAME_NOT_PROVIDED='__TAXPAY_BENEFICIARY_NAME_NOT_PROVIDED__';

export function beneficiaryNameForStorage(name:string):string{
  return name.trim()||BENEFICIARY_NAME_NOT_PROVIDED;
}

export function beneficiaryNameWasNotProvided(name:string):boolean{
  return name===BENEFICIARY_NAME_NOT_PROVIDED;
}

export function beneficiaryNameForDisplay(name:string,fallback:string):string{
  return beneficiaryNameWasNotProvided(name)?fallback:name;
}

export function beneficiaryNameForPrefill(name:string):string{
  return beneficiaryNameWasNotProvided(name)?'':name;
}
