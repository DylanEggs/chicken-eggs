const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const expected=JSON.parse(fs.readFileSync(path.join(root,'staging/staging-build.json'),'utf8')).build;
const base='https://dylaneggs.github.io/chicken-eggs/staging/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function fetchText(file){
  const join=file.includes('?')?'&':'?';
  const r=await fetch(`${base}${file}${join}qa=${Date.now()}-${Math.random().toString(36).slice(2)}`,{cache:'no-store',headers:{'cache-control':'no-cache'}});
  if(!r.ok)throw new Error(`${file} returned HTTP ${r.status}`);
  return r.text();
}

(async()=>{
  let live='';
  for(let attempt=1;attempt<=48;attempt++){
    try{
      const raw=await fetchText('staging-build.json');
      live=JSON.parse(raw).build||'';
      if(live===expected)break;
      console.log(`Waiting for staging deployment: live=${live||'unknown'} expected=${expected} attempt=${attempt}/48`);
    }catch(error){
      console.log(`Waiting for staging deployment: ${error.message} attempt=${attempt}/48`);
    }
    await sleep(5000);
  }
  if(live!==expected)throw new Error(`Staging build ${expected} did not deploy; live=${live}`);

  const assets=['index.html','staging-storage.js','staging-firebase.js','staging-owner-firebase.js','staging-database.js','staging-app2.js','staging-photo-service.js','staging-banner.js','staging-manual-snapshots.js','staging-diagnostics.js','staging-full-test.js','staging-backup-test.js','customer-public-data-v1.js','view/index.html','view/view.css','view/view.js','view/year-forecast-v1.js','owner-login/index.html','owner-login/owner-login.js','owner-farm/index.html'];
  const loaded={};
  for(const file of assets){
    loaded[file]=await fetchText(file);
    if(!loaded[file].trim())throw new Error(`${file} deployed empty`);
    console.log(`STAGE 200 ${file} (${loaded[file].length} bytes)`);
  }

  if(!loaded['index.html'].includes('TEST / STAGING')&&!loaded['index.html'].includes('Chicken Eggs — STAGING'))throw new Error('Staging shell identity missing');
  if(!loaded['index.html'].includes('staging/staging-firebase.js'))throw new Error('Staging shell does not swap Firebase entrypoint');
  if(!loaded['index.html'].includes('staging/staging-database.js'))throw new Error('Staging shell does not swap database adapter');
  if(!loaded['index.html'].includes('staging/staging-manual-snapshots.js'))throw new Error('Staging shell does not load manual baseline controls');
  if(!loaded['index.html'].includes('staging/staging-full-test.js'))throw new Error('Staging shell does not load destructive sandbox test runner');
  if(!loaded['index.html'].includes('staging/staging-backup-test.js'))throw new Error('Staging shell does not load backup/restore test runner');
  if(!loaded['index.html'].includes('Safety stop: live firebase.js remained in staging shell'))throw new Error('Staging runtime cloud safety stop missing');
  if(!loaded['staging-storage.js'].includes('__chicken_eggs_staging__::'))throw new Error('Staging storage namespace missing');
  if(/(setDoc|addDoc|updateDoc|deleteDoc|runTransaction|writeBatch|onSnapshot)\s*[,}]/.test(loaded['staging-firebase.js']))throw new Error('Staging Firebase unexpectedly contains a Firestore write/listener API import');
  if(loaded['staging-firebase.js'].includes('window.FirestoreDB =')||loaded['staging-firebase.js'].includes('window.FirebaseUser ='))throw new Error('Staging exposes live Firestore handles to app code');
  if(!loaded['staging-firebase.js'].includes('window.__farmApplyingRemote = true'))throw new Error('Staging live seed is not marked authoritative for inventory firewall');
  if(!loaded['staging-firebase.js'].includes('FarmBootstrapSafety?.unlock?.()'))throw new Error('Staging cannot release normal startup write lock');
  if(loaded['staging-photo-service.js'].includes('firebasejs')||loaded['staging-photo-service.js'].includes('FirestoreDB'))throw new Error('Staging photo service can reach Firebase');
  if(!loaded['staging-banner.js'].includes('LIVE FIREBASE IS READ-ONLY'))throw new Error('Staging safety banner missing');
  if(!loaded['staging-banner.js'].includes('Refresh Test Data From Live'))throw new Error('Staging live-to-test refresh control missing');
  if(!loaded['staging-banner.js'].includes('Save Test Baseline')||!loaded['staging-banner.js'].includes('Restore Test Baseline'))throw new Error('Staging manual baseline controls missing');
  if(!loaded['staging-banner.js'].includes('Run Full Sandbox Test'))throw new Error('Staging full-test button missing');
  if(!loaded['staging-banner.js'].includes('staging/view/'))throw new Error('Staging customer preview link missing');
  if(!loaded['staging-banner.js'].includes('staging/owner-login/'))throw new Error('Staging owner-login verification link missing');
  if(!loaded['staging-banner.js'].includes('staging/owner-farm/'))throw new Error('Owner-gated full staging farm link missing');
  if(!loaded['staging-manual-snapshots.js'].includes('refreshFromLiveAndSaveBaseline'))throw new Error('Manual snapshot live refresh helper missing');
  if(!loaded['staging-manual-snapshots.js'].includes('restoreBaseline'))throw new Error('Manual snapshot restore helper missing');
  if(/Firestore|firebasejs|setDoc|addDoc|updateDoc|deleteDoc/.test(loaded['staging-manual-snapshots.js']))throw new Error('Manual snapshot module unexpectedly reaches Firebase');
  if(!loaded['staging-full-test.js'].includes('restore(snap)'))throw new Error('Full staging runner does not restore staging baseline');
  if(!loaded['staging-full-test.js'].includes('Mark Paid does not change inventory'))throw new Error('Full staging runner is missing payment/inventory regression check');
  if(!loaded['staging-backup-test.js'].includes('chicken-eggs-full-backup-v8'))throw new Error('Backup test does not verify current backup format');
  if(!loaded['staging-backup-test.js'].includes('Restore routes exact inventory through InventorySystemV6'))throw new Error('Backup test does not verify inventory restore authority');

  const customerBundle=loaded['customer-public-data-v1.js']+loaded['view/index.html']+loaded['view/view.js']+loaded['view/year-forecast-v1.js'];
  if(!loaded['view/index.html'].includes('CUSTOMER VIEW PREVIEW'))throw new Error('Customer preview identity missing');
  if(!loaded['view/index.html'].includes('../customer-public-data-v1.js'))throw new Error('Customer preview does not load sanitizer');
  if(!loaded['view/index.html'].includes('year-forecast-v1.js'))throw new Error('Customer preview does not load yearly forecast');
  if(/(firebasejs|FirestoreDB|FirebaseUser|setDoc|addDoc|updateDoc|deleteDoc)/i.test(loaded['view/index.html']+loaded['view/view.js']+loaded['view/year-forecast-v1.js']))throw new Error('Customer preview can reach Firebase');
  if(/localStorage\.(setItem|removeItem|clear)/.test(customerBundle))throw new Error('Customer preview contains a browser data writer');
  if(!loaded['customer-public-data-v1.js'].includes('customer-public-v1'))throw new Error('Customer public data contract missing');
  if(!loaded['view/index.html'].includes('Browse the flock')||!loaded['view/index.html'].includes('Chicken of the Day'))throw new Error('Customer preview core viewing features missing');
  if(!loaded['view/year-forecast-v1.js'].includes('predicted this year'))throw new Error('Customer yearly forecast UI missing');

  const ownerLogin=loaded['owner-login/owner-login.js'];
  if(!loaded['owner-login/index.html'].includes('Test Owner Login'))throw new Error('Owner login verification page identity missing');
  if(!ownerLogin.includes('signInWithEmailAndPassword'))throw new Error('Owner verification does not use email/password auth');
  if(!ownerLogin.includes('aLvjMpXgMJf5W3YUjQM6wqKagLo2'))throw new Error('Owner verification does not check exact owner UID');
  if(!ownerLogin.includes('getDoc')||!ownerLogin.includes('farm", "settings'))throw new Error('Owner verification read-only settings check missing');
  if(/\b(setDoc|addDoc|updateDoc|deleteDoc|runTransaction|writeBatch)\b/.test(ownerLogin))throw new Error('Owner login verification unexpectedly contains Firestore write APIs');
  if(/localStorage\.(setItem|removeItem|clear)/.test(ownerLogin))throw new Error('Owner login verification stores credentials or state in localStorage');

  const ownerFirebase=loaded['staging-owner-firebase.js'];
  if(!loaded['owner-farm/index.html'].includes('OWNER LOGIN Test Farm'))throw new Error('Owner-gated staging farm identity missing');
  if(!loaded['owner-farm/index.html'].includes('staging/staging-owner-firebase.js'))throw new Error('Owner-gated staging farm does not swap to owner Firebase adapter');
  if(!ownerFirebase.includes('FarmOwnerAuth')||!ownerFirebase.includes('requireSignIn'))throw new Error('Owner-gated staging Firebase does not require owner login');
  if(!ownerFirebase.includes('aLvjMpXgMJf5W3YUjQM6wqKagLo2'))throw new Error('Owner-gated staging Firebase does not verify exact owner UID');
  if(/\b(setDoc|addDoc|updateDoc|deleteDoc|runTransaction|writeBatch|onSnapshot)\b/.test(ownerFirebase))throw new Error('Owner-gated staging Firebase unexpectedly contains Firestore write/listener APIs');
  if(ownerFirebase.includes('window.FirestoreDB =')||ownerFirebase.includes('window.FirebaseUser ='))throw new Error('Owner-gated staging exposes live Firestore handles');

  console.log(`PASS Staging live smoke — ${expected}, ${assets.length} isolated assets verified including customer preview, manual bash/restore controls, yearly forecast, and owner-gated test farm`);
})().catch(error=>{console.error('STAGING LIVE SMOKE FAILED:',error);process.exit(1);});
