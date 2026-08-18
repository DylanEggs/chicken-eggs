import { chromium } from 'playwright';
import fs from 'node:fs';

const expected=JSON.parse(fs.readFileSync(new URL('../staging/staging-build.json',import.meta.url),'utf8')).build;
const base='https://dylaneggs.github.io/chicken-eggs/staging/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

for(let i=1;i<=60;i++){
  const r=await fetch(`${base}staging-build.json?controls=${Date.now()}-${i}`,{cache:'no-store'}).catch(()=>null);
  if(r?.ok&&String((await r.json()).build||'')===expected)break;
  if(i===60)throw new Error(`Staging deployment ${expected} not visible for controls E2E`);
  await sleep(5000);
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},locale:'en-US',timezoneId:'America/New_York'});
try{
  const page=await context.newPage();
  await page.goto(`${base}?controls=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.__ChickenEggsEnvironment==='staging'&&window.StagingManualSnapshots&&window.StagingSandbox,{timeout:30000});
  await page.evaluate(()=>window.FarmSyncSafety.ready());
  await page.waitForFunction(()=>window.FarmSyncSafety?.isReady?.()===true,{timeout:30000});

  const baseline=await page.evaluate(async()=>{
    const beforeEntries=localStorage.getItem('chickenEggEntriesV102');
    const beforeApp=localStorage.getItem('chickenEggApp2V1');
    const saved=await window.StagingManualSnapshots.saveBaseline('Browser control test');
    const rows=JSON.parse(beforeEntries||'[]');
    rows.push({id:'CONTROL-E2E-DESTROY',type:'eggs',date:'2099-12-30',eggs:999});
    localStorage.setItem('chickenEggEntriesV102',JSON.stringify(rows));
    localStorage.setItem('chickenEggApp2V1',JSON.stringify({destroyedByControlE2E:true}));
    const changed=localStorage.getItem('chickenEggEntriesV102')!==beforeEntries&&localStorage.getItem('chickenEggApp2V1')!==beforeApp;
    await window.StagingManualSnapshots.restoreBaseline();
    return {
      changed,
      restoredEntries:localStorage.getItem('chickenEggEntriesV102')===beforeEntries,
      restoredApp:localStorage.getItem('chickenEggApp2V1')===beforeApp,
      saved:!!saved?.saved,
      baselineInfo:window.StagingManualSnapshots.info(),
      fullButton:!!document.getElementById('stagingRunFullTest'),
      refreshButton:!!document.getElementById('stagingRefreshLive'),
      saveButton:!!document.getElementById('stagingSaveBaseline'),
      restoreButton:!!document.getElementById('stagingRestoreBaseline'),
      firestoreExposed:!!window.FirestoreDB,
      firebaseUserExposed:!!window.FirebaseUser
    };
  });
  console.log('MANUAL STAGING CONTROLS',JSON.stringify(baseline));
  if(!baseline.saved||!baseline.changed||!baseline.restoredEntries||!baseline.restoredApp)throw new Error('Manual staging save/restore baseline failed in browser');
  if(!baseline.fullButton||!baseline.refreshButton||!baseline.saveButton||!baseline.restoreButton)throw new Error('One or more manual staging buttons are missing');
  if(baseline.firestoreExposed||baseline.firebaseUserExposed)throw new Error('Manual staging exposed live Firebase handles');

  const owner=await context.newPage();
  await owner.goto(`${base}owner-farm/?controls=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:120000});
  await owner.waitForSelector('#farmOwnerAuthGate',{state:'visible',timeout:30000});
  await owner.waitForFunction(()=>window.__ChickenEggsStagingOwnerMode===true&&window.__STAGING_FIREBASE_READONLY__===true,{timeout:30000});
  const gate=await owner.evaluate(()=>({
    title:document.querySelector('#farmOwnerAuthCard h1')?.textContent||'',
    environment:window.__ChickenEggsEnvironment,
    ownerMode:window.__ChickenEggsStagingOwnerMode,
    readOnly:window.__STAGING_FIREBASE_READONLY__,
    signedIn:window.FarmOwnerAuth?.isSignedIn?.()||false,
    firestoreExposed:!!window.FirestoreDB,
    firebaseUserExposed:!!window.FirebaseUser,
    syncVersion:window.FarmSyncSafety?.version||'',
    hasPasswordField:!!document.getElementById('farmOwnerPassword'),
    bannerText:document.getElementById('stagingSafetyBanner')?.innerText||''
  }));
  console.log('OWNER-GATED STAGING',JSON.stringify(gate));
  if(gate.environment!=='staging'||gate.ownerMode!==true||gate.readOnly!==true)throw new Error('Owner-gated staging environment markers are wrong');
  if(gate.signedIn)throw new Error('Owner-gated staging unexpectedly bypassed login');
  if(gate.firestoreExposed||gate.firebaseUserExposed)throw new Error('Owner-gated staging exposed live Firebase handles');
  if(!gate.hasPasswordField||!/Private Farm Login/i.test(gate.title))throw new Error('Owner login gate is missing');
  if(gate.syncVersion!=='STAGING-OWNER-READONLY-1')throw new Error(`Owner staging sync adapter mismatch: ${gate.syncVersion}`);
  if(!/OWNER LOGIN STAGING/i.test(gate.bannerText))throw new Error('Owner staging safety banner is missing');

  console.log(`PASS Staging manual controls + owner-login gate E2E — ${expected}`);
}finally{
  await browser.close();
}
