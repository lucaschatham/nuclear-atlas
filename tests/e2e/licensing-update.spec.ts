import {expect,test} from '@playwright/test';
const cases=[
 ['Long Mott / Dow Seadrift','Construction Permit Application','https://www.nrc.gov/reactors/new-reactors/advanced/who-were-working-with/applicant-projects/long-mott'],
 ['Clinch River BWRX-300','Construction Permit Application','https://www.nrc.gov/reactors/new-reactors/advanced/who-were-working-with/applicant-projects/clinch-river'],
 ['Kemmerer Power Station Unit 1 / Natrium','Construction Permit','https://www.nrc.gov/node/2156776'],
 ['Darlington New Nuclear: first BWRX-300','Construction Licence','https://www.cnsc-ccsn.gc.ca/eng/reactors/new-reactor-power-plant-projects/new-reactor-power-plant-facilities/darlington-new-nuclear-project/'],
 ['Hermes non-electric test reactor','Construction Permit','https://www.nrc.gov/reactors/non-power/new-facility-licensing/hermes-kairos'],
];
test('five licensing additions expose action, source, and approximate geography',async({page},testInfo)=>{
 for(const [name,action,url] of cases){
  await page.goto('/?stage=build-license&view=table&q='+encodeURIComponent(name));
  const row=page.locator('[data-slot=table-body] tr').filter({hasText:name});
  await expect(row).toHaveCount(1);
  await expect(row.getByText(action,{exact:true}).first()).toBeVisible();
  await row.getByRole('button',{name:'Inspect '+name,exact:true}).click();
  const inspector=testInfo.project.name==='mobile'?page.getByRole('dialog',{name:'Evidence record'}):page.locator('aside[aria-label="Evidence details"]');
  await expect(inspector.getByRole('heading',{name,exact:true})).toBeVisible();
  await expect(inspector.getByText(action,{exact:true})).toBeVisible();
  await expect(inspector.locator('a').filter({hasText:'Open source'}).filter({has:page.locator('svg')}).first()).toBeVisible();
  await expect(inspector.locator(`a[href="${url}"]`)).toHaveCount(1);
  await expect(inspector.getByText(/Approximate area:/)).toBeVisible();
  if(name.startsWith('Long Mott')) await expect(inspector.getByText('Application date',{exact:true})).toBeVisible();
  if(testInfo.project.name==='mobile') await page.keyboard.press('Escape');
  await page.getByLabel('Map view',{exact:true}).click();
  await expect(page.locator('.atlas-evidence-marker')).toHaveCount(1);
 }
});
test('licensing updates remain discoverable from changelog with mixed-date disclosure',async({page})=>{
 await page.goto('/changelog/');
 const link=page.getByRole('link',{name:'Five verified construction licensing records'});
 await expect(link).toHaveAttribute('href',/stage=build-license/);
 await link.click();
 await expect(page.locator('[data-slot=table-body] tr').filter({hasText:'Long Mott'})).toHaveCount(1);
 await page.goto('/about/');
 await expect(page.getByText('Baseline snapshot: August 26, 2026',{exact:false})).toBeVisible();
 await expect(page.getByText(/Five licensing records were reviewed on September 15, 2026/)).toBeVisible();
});
