import type {Locator,Page} from '@playwright/test';

/** Model the visible searchable selector, rather than driving a removed native select. */
export async function chooseBeneficiaryOption(
  root:Page|Locator,
  id:string,
  selection:string|{label:string}
){
  await root.locator('#'+id).click();
  const options=root.locator('#'+id+'-options [role="option"]');
  if(typeof selection==='string'){
    // Stored values (including UUID list IDs) are the stable selection contract.
    await root.locator('#'+id+'-options [role="option"][data-option-value="'+selection+'"]').click();
  }else{
    await options.filter({hasText:selection.label}).first().click();
  }
}
