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
const errors=[];
function watch(page,label){
  page.on('pageerror',e=>{
    const detail=String(e?.stack||e?.message||e);
    errors.push(`${label} pageerror: ${detail}`);
    console.log(`[${label} pageerror] ${detail}`);
  });
  page.on('console',m=>{if(m.type()==='error')errors.push(`${label} console: ${m.text()}`);else if(['warning','log'].includes(m.type()))console.log(`[${label} ${m.type()}] ${m.text()}`);});
}

const page=await context.newPage();watch(page,'farm');
try{
  await page.goto(`${base}?e2e=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.__ChickenEggsEnvironment==='staging',null,{timeout:30000});
  await page.waitForFunction(()=>window.StagingSandbox?.seedInfo?.()?.completed===true,null,{timeout:30000});
  await page.waitForFunction(()=>window.StagingFullTest?.run&&window.StagingBackupTest?.run,null,{timeout:30000});

  const safety=await page.evaluate(()=>({
    environment:window.__ChickenEggsEnvironment,
    readOnly:window.__STAGING_FIREBASE_READONLY__,
    firestoreExposed:!!window.FirestoreDB,
    firebaseUserExposed:!!window.FirebaseUser,
    storage:window.StagingStorageSandbox?.diagnostics?.(),
    seed:window.StagingSandbox?.seedInfo?.()
  }));
  console.log('STAGING SAFETY',JSON.stringify(safety));
  if(safety.environment!=='staging'||safety.readOnly!==true||safety.firestoreExposed||safety.firebaseUserExposed)throw new Error('Staging safety boundary failed');
  if(!safety.seed?.completed)throw new Error('Staging seed did not complete');

  const full=await page.evaluate(()=>window.StagingFullTest.run());
  console.log(`FULL SANDBOX RESULT ${full.passed}/${full.total} passed`);
  for(const r of full.results||[])console.log(`${r.pass?'PASS':'FAIL'} ${r.name}${r.detail?` — ${r.detail}`:''}`);
  if(full.failed)throw new Error(`Full sandbox test had ${full.failed} failures`);

  const backup=await page.evaluate(()=>window.StagingBackupTest.run());
  console.log(`BACKUP RESTORE RESULT ${backup.passed}/${backup.total} passed`);
  for(const r of backup.results||[])console.log(`${r.pass?'PASS':'FAIL'} ${r.name}${r.detail?` — ${r.detail}`:''}`);
  if(backup.failed)throw new Error(`Backup restore test had ${backup.failed} failures`);

  const expectedCustomer=await page.evaluate(()=>{
    const app=JSON.parse(localStorage.getItem('chickenEggApp2V1')||'{}');
    const photos=JSON.parse(localStorage.getItem('chickenEggLocalBirdPhotosV1')||'{}');
    const flock=(Array.isArray(app.flock)?app.flock:[]).filter(b=>b&&!/^(sold|removed|rehomed|deceased|inactive)$/i.test(String(b.status||'Active').trim()));
    return {
      available:window.InventorySystemV6.available(),
      flockCount:flock.length,
      photoCount:flock.filter(b=>typeof photos[String(b.id||'')]==='string'&&photos[String(b.id||'')].length>0).length,
      seedAt:window.StagingSandbox?.seedInfo?.()?.importedAt||0
    };
  });
  console.log('EXPECTED CUSTOMER SAFE COUNTS',JSON.stringify(expectedCustomer));

  const customer=await context.newPage();watch(customer,'customer');
  await customer.goto(`${base}view/?e2e=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:120000});
  await customer.waitForFunction(()=>window.CustomerViewStaging?.getData?.()?.schema==='customer-public-v1',null,{timeout:30000});

  await customer.evaluate(()=>{
    window.__customerStorageWrites=[];
    const proto=Storage.prototype;
    for(const name of ['setItem','removeItem','clear']){
      const original=proto[name];
      proto[name]=function(...args){
        window.__customerStorageWrites.push({name,args:args.map(v=>String(v)).slice(0,2),at:Date.now()});
        return original.apply(this,args);
      };
    }
  });

  const customerState=await customer.evaluate(()=>{
    const data=window.CustomerViewStaging.getData();
    const forbidden=new Set(['customers','orders','expenses','saleMeta','notes','contact','buyer','paid','dozenPrice','packPrice','price','revenue','profit','latitude','longitude','history']);
    const found=[];
    const walk=(value,path='root')=>{
      if(!value||typeof value!=='object')return;
      for(const [key,child] of Object.entries(value)){
        if(forbidden.has(key))found.push(`${path}.${key}`);
        walk(child,`${path}.${key}`);
      }
    };
    walk(data);
    return {
      environment:window.CustomerViewStaging.environment,
      schema:data.schema,
      available:data.availability.eggs,
      flockCount:data.flock.length,
      photoCount:data.meta.photoCount,
      facts:data.facts.length,
      chicken:!!data.chickenOfTheDay,
      weather:!!data.weather,
      forbidden:found,
      firestoreExposed:!!window.FirestoreDB,
      firebaseUserExposed:!!window.FirebaseUser,
      dataEntryFields:document.querySelectorAll('input,textarea,select').length,
      hasAvailability:/eggs available right now/i.test(document.body.innerText),
      hasForecast:/predicted this week/i.test(document.body.innerText),
      hasChicken:/Chicken of the Day/i.test(document.body.innerText),
      hasFlock:/Browse the flock/i.test(document.body.innerText),
      sourceSnapshotAt:data.meta.sourceSnapshotAt
    };
  });
  console.log('CUSTOMER VIEW SAFETY',JSON.stringify(customerState));
  if(customerState.environment!=='staging-customer-preview')throw new Error('Customer page environment marker is wrong');
  if(customerState.schema!=='customer-public-v1')throw new Error('Customer public data schema is wrong');
  if(customerState.available!==expectedCustomer.available)throw new Error(`Customer availability mismatch ${customerState.available} != ${expectedCustomer.available}`);
  if(customerState.flockCount!==expectedCustomer.flockCount)throw new Error(`Customer flock count mismatch ${customerState.flockCount} != ${expectedCustomer.flockCount}`);
  if(customerState.photoCount!==expectedCustomer.photoCount)throw new Error(`Customer photo count mismatch ${customerState.photoCount} != ${expectedCustomer.photoCount}`);
  if(customerState.sourceSnapshotAt!==expectedCustomer.seedAt)throw new Error('Customer page is not using the current staging snapshot marker');
  if(customerState.firestoreExposed||customerState.firebaseUserExposed)throw new Error('Customer preview exposed a Firebase handle');
  if(customerState.forbidden.length)throw new Error(`Customer public object leaked private keys: ${customerState.forbidden.join(', ')}`);
  if(customerState.dataEntryFields!==0)throw new Error('Customer view contains editable form fields');
  if(!customerState.hasAvailability||!customerState.hasForecast||!customerState.hasChicken||!customerState.hasFlock)throw new Error('Customer preview is missing a core viewing capability');
  if(customerState.facts<30)throw new Error('Customer fact library is unexpectedly small');

  const originalFact=await customer.locator('#factText').textContent();
  await customer.locator('#nextFact').click();
  const nextFact=await customer.locator('#factText').textContent();
  if(!nextFact||nextFact===originalFact)throw new Error('Customer Another Fact interaction did not advance');

  await customer.locator('[data-filter="hens"]').click();
  const filterState=await customer.evaluate(()=>window.CustomerViewStaging.getFilter());
  if(filterState!=='hens')throw new Error('Customer flock filter did not switch to hens');
  await customer.locator('[data-filter="all"]').click();

  const firstBird=customer.locator('[data-bird-id]').first();
  if(await firstBird.count()){
    await firstBird.click();
    if(await customer.locator('#profileModal').getAttribute('hidden')!==null)throw new Error('Customer flock profile did not open');
    const profileText=(await customer.locator('#profileFacts').innerText())||'';
    if(!/Breed/i.test(profileText)||!/Age/i.test(profileText))throw new Error('Customer flock profile is missing safe bird details');
    await customer.locator('.modal-close').click();
  }

  const customerWrites=await customer.evaluate(()=>window.__customerStorageWrites||[]);
  if(customerWrites.length)throw new Error(`Customer view attempted browser-storage writes: ${JSON.stringify(customerWrites.slice(0,5))}`);

  const customerResources=await customer.evaluate(()=>performance.getEntriesByType('resource').map(x=>String(x.name||'')));
  const customerCloudResources=customerResources.filter(url=>/firebase|firestore|googleapis\.com/i.test(url));
  if(customerCloudResources.length)throw new Error(`Customer page loaded cloud database resources: ${customerCloudResources.slice(0,3).join(' | ')}`);
  console.log(`CUSTOMER PREVIEW RESULT PASS — ${customerState.available} available eggs, ${customerState.flockCount} flock profiles, ${customerState.photoCount} photos, no private keys/writes/cloud handles`);
  await customer.close();

  const after=await page.evaluate(()=>({
    firestoreExposed:!!window.FirestoreDB,
    firebaseUserExposed:!!window.FirebaseUser,
    environment:window.__ChickenEggsEnvironment,
    full:window.StagingFullTest.last(),
    backup:window.StagingBackupTest.last()
  }));
  if(after.firestoreExposed||after.firebaseUserExposed)throw new Error('A staging test exposed live Firebase handles');
  if(after.environment!=='staging')throw new Error('Staging environment marker changed during tests');
  if(errors.length)throw new Error(`Browser errors: ${errors.slice(0,5).join(' | ')}`);
  console.log(`PASS staging browser E2E — ${expectedBuild}; full ${full.passed}/${full.total}, backup ${backup.passed}/${backup.total}, customer privacy/interaction checks passed`);
}finally{
  await browser.close();
}
