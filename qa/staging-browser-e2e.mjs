import { chromium } from 'playwright';
import fs from 'node:fs';

const base='https://dylaneggs.github.io/chicken-eggs/staging/';
const manifest=JSON.parse(fs.readFileSync(new URL('../staging/staging-build.json',import.meta.url),'utf8'));
const expectedBuild=String(manifest.build||'');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function waitForDeploy(){
  for(let attempt=1;attempt<=60;attempt++){
    try{
      const r=await fetch(`${base}staging-build.json?e2e=${Date.now()}-${attempt}`,{cache:'no-store'});
      if(r.ok){const j=await r.json();if(String(j.build||'')===expectedBuild)return;}
    }catch{}
    await sleep(5000);
  }
  throw new Error(`Staging build ${expectedBuild} was not deployed within 5 minutes`);
}

await waitForDeploy();
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},locale:'en-US',timezoneId:'America/New_York'});

// Simulate the already-synced LIVE app state in same-origin browser storage.
// This proves the exact LIVE->STAGING browser mirror without making CI read or
// write the real Firestore project.
await context.addInitScript(()=>{
  if(location.hostname!=='dylaneggs.github.io'||!location.pathname.startsWith('/chicken-eggs/staging/'))return;
  const t=Date.now();
  const fixture={
    chickenEggEntriesV102:JSON.stringify([{id:'qa-live-eggs-1',type:'eggs',date:'2026-08-21',eggs:8,at:t}]),
    chickenEggSettingsV102:JSON.stringify({hens:1,roosters:0,dozenPrice:4,packPrice:6,farmName:'QA Live Mirror Farm'}),
    chickenEggApp2V1:JSON.stringify({version:1,customers:[],orders:[],expenses:[],chores:[],saleMeta:{},birdListings:[],flock:[{id:'qa-live-hen',name:'Mirror Hen',breed:'QA Breed',sex:'Hen',status:'Active',hatchDate:'2026-01-01'}]}),
    chickenEggInventoryV2:JSON.stringify({version:6,authorityVersion:6,dozens:2,packs18:0,loose:3,adjustments:[],recoveryMarkers:{},updatedAt:t}),
    chickenEggBusinessV1:JSON.stringify({version:1,expenses:[],updatedAt:t}),
    chickenEggDeluxeV1:JSON.stringify({version:1,birdPhotoUrls:{qa:'data:image/png;base64,SHOULD_BE_STRIPPED'}})
  };
  for(const [key,value] of Object.entries(fixture)){
    if(localStorage.getItem(key)==null)localStorage.setItem(key,value);
  }
});

const errors=[];
function watch(page,label){
  page.on('pageerror',e=>{const detail=String(e?.stack||e?.message||e);errors.push(`${label} pageerror: ${detail}`);console.log(`[${label} pageerror] ${detail}`);});
  page.on('console',m=>{if(m.type()==='error')errors.push(`${label} console: ${m.text()}`);else if(['warning','log'].includes(m.type()))console.log(`[${label} ${m.type()}] ${m.text()}`);});
  page.on('dialog',async d=>{console.log(`[${label} dialog] ${d.message().slice(0,180)}`);await d.accept();});
}

const page=await context.newPage();watch(page,'farm');
try{
  await page.goto(`${base}?e2e=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.__ChickenEggsEnvironment==='staging',null,{timeout:30000});
  await page.waitForFunction(()=>window.StagingFinalTestReadyGateV1?.ready?.()===true,null,{timeout:45000});

  const safety=await page.evaluate(()=>({
    environment:window.__ChickenEggsEnvironment,
    readOnly:window.__STAGING_FIREBASE_READONLY__,
    firestoreExposed:!!window.FirestoreDB,
    firebaseUserExposed:!!window.FirebaseUser,
    storage:window.StagingStorageSandbox?.diagnostics?.(),
    seed:window.StagingSandbox?.seedInfo?.(),
    mirror:window.StagingLocalSeedV1?.result,
    mirrorBadge:document.getElementById('stagingLiveMirrorState')?.textContent||'',
    testReady:window.StagingFinalTestReadyGateV1?.ready?.()||false,
    syncVersion:window.FarmSyncSafety?.version||''
  }));
  console.log('STAGING SAFETY',JSON.stringify(safety));
  if(safety.environment!=='staging'||safety.readOnly!==true||safety.firestoreExposed||safety.firebaseUserExposed)throw new Error('Staging safety boundary failed');
  if(!safety.mirror?.verified||!safety.mirror?.coreVerified||safety.mirror?.skipped!==0||safety.mirror?.mismatchedKeys?.length)throw new Error(`LIVE browser mirror did not verify: ${JSON.stringify(safety.mirror)}`);
  if(!safety.seed?.completed||!safety.testReady)throw new Error('Staging did not reach verified ready state');
  if(!/LIVE mirror verified/i.test(safety.mirrorBadge)||!/0 Firebase reads/i.test(safety.mirrorBadge))throw new Error(`Mirror proof badge missing: ${safety.mirrorBadge}`);
  if(safety.syncVersion!=='STAGING-LIVE-BROWSER-MIRROR-6')throw new Error(`Unexpected staging sync version: ${safety.syncVersion}`);

  const mirrorExact=await page.evaluate(()=>{
    const prefix='__chicken_eggs_staging__::';
    const keys=['chickenEggEntriesV102','chickenEggSettingsV102','chickenEggApp2V1','chickenEggInventoryV2','chickenEggBusinessV1'];
    return keys.map(k=>({key:k,live:localStorage.getItem(k),stage:(()=>{const old=window.__ChickenEggsStagingMode;window.__ChickenEggsStagingMode=false;try{return localStorage.getItem(prefix+k);}finally{window.__ChickenEggsStagingMode=old;}})()})).map(x=>({key:x.key,match:x.live===x.stage}));
  });
  if(mirrorExact.some(x=>!x.match))throw new Error(`Core LIVE mirror mismatch: ${JSON.stringify(mirrorExact)}`);

  // Reverify the current LIVE mirror immediately before the destructive suite,
  // then run only inside the temporary memory overlay.
  const full=await page.evaluate(async()=>{
    const mirror=await window.StagingTestMemoryRunnerV1.refreshVerifiedLiveMirror();
    const overlay=window.StagingStorageSandbox.beginMemoryOverlay();
    if(!overlay?.active)throw new Error('Memory overlay did not start');
    try{
      const result=await window.StagingFullTest.run();
      return {result,mirror};
    }finally{window.StagingStorageSandbox.endMemoryOverlay(true);}
  });
  console.log(`FULL SANDBOX RESULT ${full.result.passed}/${full.result.total} passed; mirror ${full.mirror.copied}/${full.mirror.eligible}`);
  for(const r of full.result.results||[])console.log(`${r.pass?'PASS':'FAIL'} ${r.name}${r.detail?` — ${r.detail}`:''}`);
  if(full.result.failed)throw new Error(`Full sandbox test had ${full.result.failed} failures`);
  if(!full.mirror?.verified)throw new Error('Full test did not use a verified LIVE mirror');

  const backup=await page.evaluate(()=>window.StagingBackupTest.run());
  console.log(`BACKUP RESTORE RESULT ${backup.passed}/${backup.total} passed`);
  if(backup.failed)throw new Error(`Backup restore test had ${backup.failed} failures`);

  const expectedCustomer=await page.evaluate(()=>{
    const app=JSON.parse(localStorage.getItem('chickenEggApp2V1')||'{}');
    const flock=(Array.isArray(app.flock)?app.flock:[]).filter(b=>b&&!/^(sold|removed|rehomed|deceased|inactive)$/i.test(String(b.status||'Active').trim()));
    return {available:window.InventorySystemV6.available(),flockCount:flock.length,seedAt:window.StagingSandbox?.seedInfo?.()?.importedAt||0};
  });

  // Launch Customer Preview through the real staging button so the verified
  // mirror guard is tested too; direct navigation would bypass that protection.
  const customer=await context.newPage();watch(customer,'customer');
  await customer.goto(`${base}?previewLaunch=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:120000});
  await customer.waitForFunction(()=>window.StagingFinalTestReadyGateV1?.ready?.()===true,null,{timeout:45000});
  await customer.locator('#stagingSafetyBanner a.st-customer').click();
  await customer.waitForURL(/\/staging\/view\//,{timeout:30000});
  await customer.waitForFunction(()=>window.CustomerViewStaging?.getData?.()?.schema==='customer-public-v1'&&window.CustomerRequestViewV1&&window.StagingCustomerRequestUITestV1,null,{timeout:30000});

  const customerState=await customer.evaluate(()=>{
    const data=window.CustomerViewStaging.getData();
    const forbidden=new Set(['customers','orders','expenses','saleMeta','notes','contact','buyer','paid','dozenPrice','packPrice','price','revenue','profit','latitude','longitude','history']);
    const found=[];
    const walk=(value,path='root')=>{if(!value||typeof value!=='object')return;for(const [key,child] of Object.entries(value)){if(forbidden.has(key))found.push(`${path}.${key}`);walk(child,`${path}.${key}`);}};
    walk(data);
    const visibleInputs=[...document.querySelectorAll('input,textarea,select')].filter(el=>{const sec=el.closest('#customerRequestSection');return !sec||sec.hidden===false;}).length;
    return {
      environment:window.CustomerViewStaging.environment,schema:data.schema,
      available:data.availability.eggs,flockCount:data.flock.length,facts:data.facts.length,
      forbidden:found,firestoreExposed:!!window.FirestoreDB,firebaseUserExposed:!!window.FirebaseUser,
      visibleInputs,requestSectionHidden:document.getElementById('customerRequestSection')?.hidden!==false,
      sourceSnapshotAt:data.meta.sourceSnapshotAt
    };
  });
  console.log('CUSTOMER VIEW SAFETY',JSON.stringify(customerState));
  if(customerState.environment!=='staging-customer-preview'||customerState.schema!=='customer-public-v1')throw new Error('Customer preview environment/schema mismatch');
  if(customerState.available!==expectedCustomer.available)throw new Error(`Customer availability mismatch ${customerState.available} != ${expectedCustomer.available}`);
  if(customerState.flockCount!==expectedCustomer.flockCount)throw new Error(`Customer flock count mismatch ${customerState.flockCount} != ${expectedCustomer.flockCount}`);
  if(customerState.firestoreExposed||customerState.firebaseUserExposed)throw new Error('Customer preview exposed a Firebase handle');
  if(customerState.forbidden.length)throw new Error(`Customer public object leaked private keys: ${customerState.forbidden.join(', ')}`);
  if(!customerState.requestSectionHidden||customerState.visibleInputs!==0)throw new Error('Disabled Customer Request form is visibly editable in preview');
  if(customerState.facts<30)throw new Error('Customer fact library is unexpectedly small');

  const requestUi=await customer.evaluate(()=>window.StagingCustomerRequestUITestV1.run());
  console.log(`CUSTOMER REQUEST LIVE-PARITY RESULT ${requestUi.passed}/${requestUi.total}`);
  if(requestUi.failed)throw new Error(`Live-parity customer request form had ${requestUi.failed} failures`);

  const customerResources=await customer.evaluate(()=>performance.getEntriesByType('resource').map(x=>String(x.name||'')));
  const customerCloudResources=customerResources.filter(url=>/firestore\.googleapis\.com|firebaseio\.com/i.test(url));
  if(customerCloudResources.length)throw new Error(`Customer preview contacted cloud database resources: ${customerCloudResources.slice(0,3).join(' | ')}`);
  await customer.close();

  const after=await page.evaluate(()=>({firestoreExposed:!!window.FirestoreDB,firebaseUserExposed:!!window.FirebaseUser,environment:window.__ChickenEggsEnvironment}));
  if(after.firestoreExposed||after.firebaseUserExposed||after.environment!=='staging')throw new Error('Staging safety boundary changed during tests');
  if(errors.length)throw new Error(`Browser errors: ${errors.slice(0,5).join(' | ')}`);
  console.log(`PASS staging browser E2E — ${expectedBuild}; verified LIVE mirror, in-memory full suite, Customer Preview guard and live-parity request UI all passed with no live Firestore access`);
}finally{
  await browser.close();
}
