import { chromium } from 'playwright';
import fs from 'node:fs';
import { installStagingLiveBrowserFixture } from './staging-live-browser-fixture.mjs';

const expected=JSON.parse(fs.readFileSync(new URL('../staging/staging-build.json',import.meta.url),'utf8')).build;
const base='https://dylaneggs.github.io/chicken-eggs/staging/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitForDeploy(){for(let i=1;i<=72;i++){try{const r=await fetch(`${base}staging-build.json?year=${Date.now()}-${i}`,{cache:'no-store'});if(r.ok&&(await r.json()).build===expected)return;}catch{}await sleep(5000);}throw new Error(`Staging deployment ${expected} was not visible for yearly forecast test`);}

await waitForDeploy();
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},locale:'en-US',timezoneId:'America/New_York'});
await installStagingLiveBrowserFixture(context);
const errors=[];
try{
  const farm=await context.newPage();
  farm.on('pageerror',e=>errors.push(e.message));farm.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await farm.goto(`${base}?yearseed=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:120000});
  await farm.waitForFunction(()=>window.StagingFinalTestReadyGateV1?.ready?.()===true,null,{timeout:45000});
  const mirror=await farm.evaluate(()=>window.StagingLocalSeedV1?.result);
  if(!mirror?.verified)throw new Error('Year E2E did not start from verified LIVE mirror');

  const customer=await context.newPage();
  const customerErrors=[];customer.on('pageerror',e=>customerErrors.push(e.message));customer.on('console',m=>{if(m.type()==='error')customerErrors.push(m.text());});
  await customer.goto(`${base}view/?year=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:120000});
  await customer.waitForFunction(()=>window.CustomerViewStaging?.getData?.()?.schema==='customer-public-v1'&&window.CustomerYearForecastV1?.calculate,null,{timeout:30000});
  await customer.waitForSelector('#yearForecastCard',{state:'visible',timeout:30000});

  const result=await customer.evaluate(()=>{
    const calc=window.CustomerYearForecastV1.calculate(),card=document.getElementById('yearForecastCard'),value=document.getElementById('yearForecast')?.textContent?.trim()||'';
    const visibleFields=[...document.querySelectorAll('input,textarea,select')].filter(el=>{const sec=el.closest('#customerRequestSection');return !sec||sec.hidden===false;}).length;
    return {calc,value,visible:!!card&&getComputedStyle(card).display!=='none',label:/predicted this year/i.test(card?.innerText||''),visibleFields,firestoreExposed:!!window.FirestoreDB,firebaseUserExposed:!!window.FirebaseUser};
  });
  if(!result.visible||!result.label)throw new Error('Year forecast card is missing');
  if(Number(result.value)!==result.calc.predictedYear)throw new Error(`Year forecast UI mismatch ${result.value} != ${result.calc.predictedYear}`);
  if(result.calc.predictedYear<result.calc.yearCollected||result.calc.yearCollected<=0)throw new Error('Year forecast did not include mirrored year-to-date collections');
  if(result.visibleFields!==0)throw new Error('Customer page has visible editable fields while request form is disabled');
  if(result.firestoreExposed||result.firebaseUserExposed)throw new Error('Customer page exposed private Firebase handles');
  const serious=[...errors,...customerErrors].filter(x=>!/favicon|ResizeObserver/i.test(x));if(serious.length)throw new Error(`Browser errors: ${serious.slice(0,4).join(' | ')}`);
  console.log(`PASS Customer yearly forecast browser E2E — verified LIVE mirror; ${result.calc.yearCollected} collected YTD; ${result.calc.predictedYear} predicted`);
  await customer.close();await farm.close();
}finally{await browser.close();}
