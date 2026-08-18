import { chromium } from 'playwright';
import fs from 'node:fs';

const expected=JSON.parse(fs.readFileSync(new URL('../staging/staging-build.json',import.meta.url),'utf8')).build;
const base='https://dylaneggs.github.io/chicken-eggs/staging/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function waitForDeploy(){
  for(let i=1;i<=72;i++){
    try{
      const r=await fetch(`${base}staging-build.json?profit=${Date.now()}-${i}`,{cache:'no-store'});
      if(r.ok){const live=(await r.json()).build||'';if(live===expected)return;console.log(`Profit E2E waiting for staging deploy: live=${live} expected=${expected} ${i}/72`);}
    }catch(error){console.log(`Profit E2E deploy wait: ${error.message} ${i}/72`);}
    await sleep(5000);
  }
  throw new Error(`Staging deployment ${expected} was not visible in time`);
}

await waitForDeploy();
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},locale:'en-US',timezoneId:'America/New_York'});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',msg=>{console.log(`[profit ${msg.type()}] ${msg.text()}`);if(msg.type()==='error')errors.push(msg.text());});

try{
  await page.goto(`${base}?profit=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.__ChickenEggsEnvironment==='staging',null,{timeout:30000});
  await page.waitForFunction(()=>window.FarmSyncSafety?.isReady?.()===true,null,{timeout:30000});
  await page.waitForFunction(()=>window.StagingFullTest?.suite==='v2-visible-business'&&window.StagingBusinessDisplay?.refresh,null,{timeout:30000});

  const before=await page.evaluate(()=>({
    suite:window.StagingFullTest?.suite,
    liveFirestore:!!window.FirestoreDB,
    liveUser:!!window.FirebaseUser,
    readOnly:window.__STAGING_FIREBASE_READONLY__===true
  }));
  console.log('PROFIT SUITE READY',JSON.stringify(before));
  if(before.suite!=='v2-visible-business')throw new Error(`Wrong sandbox suite loaded: ${before.suite}`);
  if(before.liveFirestore||before.liveUser||!before.readOnly)throw new Error('Profit E2E staging safety boundary is not intact');

  const report=await page.evaluate(()=>window.StagingFullTest.run());
  console.log(`VISIBLE PROFIT SUITE ${report.passed}/${report.total} passed; suite=${report.suite}`);
  for(const row of report.results||[])console.log(`${row.pass?'PASS':'FAIL'} ${row.name}${row.detail?` — ${row.detail}`:''}`);

  if(report.suite!=='staging-full-v2-visible-business')throw new Error(`Full test returned obsolete suite ${report.suite||'unknown'}`);
  if(report.failed)throw new Error(`Visible profit sandbox failed ${report.failed} of ${report.total} checks`);

  const required=[
    'Profit/Loss Calculator computes typed values correctly',
    '$5 egg sale increases current-month egg revenue by exactly $5',
    '$5 egg sale improves current-month profit/loss by exactly $5',
    'Home Egg Sales visibly increases by exactly $5',
    'Home Net Profit/Loss visibly improves by exactly $5',
    'Open Profit/Loss Calculator does not freeze business totals',
    'Open Profit/Loss Calculator stays open through business refresh',
    'Business refresh preserves calculator inputs',
    'Business refresh preserves calculator result',
    'Deleting test sale restores current-month revenue and profit',
    'Deleting test sale restores visible Home business totals',
    'Deleting test sale restores the dozen to inventory',
    'Sandbox test restores sale date form field',
    'Sandbox test restores egg date form field'
  ];
  const byName=new Map((report.results||[]).map(row=>[row.name,row]));
  for(const name of required){
    const row=byName.get(name);
    if(!row)throw new Error(`Required visible-profit check is missing: ${name}`);
    if(!row.pass)throw new Error(`Required visible-profit check failed: ${name} — ${row.detail||''}`);
  }

  const ui=await page.evaluate(()=>({
    saleDate:document.getElementById('saleDate')?.value||'',
    eggDate:document.getElementById('eggDate')?.value||'',
    screen:document.querySelector('.screen.active')?.id||'',
    full:window.StagingFullTest.last?.()
  }));
  if(ui.saleDate==='2099-12-31'||ui.eggDate==='2099-12-31')throw new Error(`Sandbox left future test date behind in UI: ${JSON.stringify(ui)}`);
  if(ui.full?.suite!=='staging-full-v2-visible-business')throw new Error('Saved full-test report is not the v2 visible-business suite');

  const serious=errors.filter(x=>!/favicon|ResizeObserver/i.test(x));
  if(serious.length)throw new Error(`Profit browser console/page errors: ${serious.slice(0,5).join(' | ')}`);
  console.log(`PASS Visible profit browser regression — ${report.passed}/${report.total}; calculator math/state, sale revenue, Home profit/loss, inventory reversal, and form restoration verified`);
}finally{
  await browser.close();
}
