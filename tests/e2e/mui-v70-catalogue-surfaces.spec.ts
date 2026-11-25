import {expect,test} from '@playwright/test';
for(const lang of ['en','bn'] as const)for(const theme of ['light','dark'] as const){
 test('catalogue official Paper surfaces retain semantic tags, geometry and read-only rules '+lang+' '+theme,async({page})=>{
  await page.emulateMedia({colorScheme:theme});
  await page.goto('/?action=head_catalogue&lang='+lang);
  const root=page.locator('[data-mui-citizen-region="head-catalogue"]');
  await expect(root).toBeVisible();
  const surface=(id:string)=>root.locator('[data-mui-coverage="MUI-CATALOGUE-PAPER-'+id+'"]');
  async function compareNative(id:string,tag:string){
    const el=surface(id).first();
    await expect(el).toHaveClass(/MuiPaper-root/);
    await expect(el).toBeVisible();
    const result=await el.evaluate((node,tagName)=>{
      const native=document.createElement(tagName);
      for(const a of Array.from(node.attributes))if(a.name!=='class'&&a.name!=='data-mui-coverage')native.setAttribute(a.name,a.value);
      native.className=Array.from(node.classList).filter(c=>!c.startsWith('Mui')&&!c.startsWith('css-')).join(' ');
      for(const child of Array.from(node.childNodes))native.append(child.cloneNode(true));
      const metrics=(e:Element)=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,width:r.width,height:r.height,bg:s.backgroundColor,color:s.color,radius:s.borderTopLeftRadius,border:s.borderTopWidth,padding:s.paddingTop,shadow:s.boxShadow};};
      const actual=metrics(node);node.replaceWith(native);const original=metrics(native);native.replaceWith(node);
      return {actual,original};
    },tag);
    expect(result.actual).toEqual(result.original);
  }
  await compareNative('INTRO','header');await compareNative('FILTERS','section');
  await expect(surface('RECORD')).toHaveCount(20);await compareNative('RECORD','article');await compareNative('PAGINATION','nav');
  await expect(root.locator('[data-mui-coverage="MUI-CATALOGUE-PREVIOUS"]')).toBeDisabled();
  await root.locator('[data-mui-coverage="MUI-CATALOGUE-NEXT"]').click();
  await expect(root.locator('[data-mui-coverage="MUI-CATALOGUE-PREVIOUS"]')).toBeEnabled();
  await root.locator('#v11-head-query').fill('zzzz-no-match');
  await expect(surface('RECORD')).toHaveCount(0);
  await compareNative('EMPTY','section');
  await root.locator('#v11-head-query').fill('19AAAAA');
  await expect(surface('RECORD')).toHaveCount(1);
  await expect(root).toContainText(lang==='bn'?'মালিকের পর্যালোচনা প্রয়োজন':'OWNER REVIEW REQUIRED');
  await expect(root.getByRole('button',{name:lang==='bn'?'পরিশোধ':'Pay',exact:true})).toHaveCount(0);
 });
}
