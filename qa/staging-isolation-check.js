const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const failures=[]; const passes=[];
const check=(name,ok,detail='')=>ok?passes.push(name):failures.push(`${name}${detail?` — ${detail}`:''}`);

const index=read('staging/index.html');
const seed=read('staging/staging-local-seed-v1.js');
const storage=read('staging/staging-storage.js');
const firebase=read('staging/staging-firebase.js');
const database=read('staging/staging-database.js');
const photos=read('staging/staging-photo-service.js');
const app2=read('staging/staging-app2.js');
const banner=read('staging/staging-banner.js');
const previewGuard=read('staging/staging-customer-preview-guard-v1.js');
const requestParity=read('staging/staging-customer-requests-live-parity-v1.js');
const requestStatusTest=read('staging/staging-customer-request-status-test-v1.js');
const readyGate=read('staging/staging-test-ready-gate-v1.js');
const memoryRunner=read('staging/staging-test-memory-runner-v1.js');
const fullTest=read('staging/staging-full-test.js');
const birdSalesTest=read('staging/staging-bird-sales-regression-v1.js');
const liveApp2=read('app2.js');

check('Staging has a separate URL shell',index.includes('Chicken Eggs — STAGING')&&index.includes('staging/staging-storage.js'));
check('Staging loads LIVE browser mirror before storage sandbox',index.includes('staging/staging-local-seed-v1.js')&&index.indexOf('staging/staging-local-seed-v1.js')<index.indexOf('staging/staging-storage.js'));
check('Staging normalizes live Firebase shell URL before swap',index.includes('replaceAsset(html,"firebase.js","v=6",build)'));
check('Staging normalizes live database shell URL before swap',index.includes('replaceAsset(html,"database.js","v=6",build)'));
check('Staging normalizes live app2 shell URL before swap',index.includes('replaceAsset(html,"app2.js","v=1",build)'));
check('Staging swaps out live Firebase entrypoint',index.includes('staging/staging-firebase.js')&&index.includes('type="module" src="firebase.js?v=${build}"'));
check('Staging swaps out live database adapter',index.includes('staging/staging-database.js'));
check('Staging swaps out live app2 loader',index.includes('staging/staging-app2.js'));
check('Staging loads Customer Preview guard exactly from shell',index.includes('staging/staging-customer-preview-guard-v1.js'));
check('Staging loads destructive full-test runner only in staging shell',index.includes('staging/staging-full-test.js')&&fullTest.includes('window.__ChickenEggsStagingMode'));
check('Staging bird-sales regression is staging-only',index.includes('staging/staging-bird-sales-regression-v1.js')&&birdSalesTest.includes('window.__ChickenEggsStagingMode'));
check('Staging public builder v3 is available for privacy testing',index.includes('customer-public-builder-v3.js'));
check('Staging boot refuses to run if live cloud scripts remain',index.includes('Safety stop: live firebase.js remained in staging shell')&&index.includes('Safety stop: live database.js remained in staging shell')&&index.includes('Safety stop: live app2.js remained in staging shell'));

check('Staging localStorage is namespaced',storage.includes('__chicken_eggs_staging__::'));
check('Staging clear is guarded and staging-only',storage.includes('if (!isStagingLocal(this)) return native.clear.call(this);')&&storage.includes('key.startsWith(PREFIX) && key !== INIT'));
check('Live mirror captures native storage before staging patch',seed.includes('const proto = Storage.prototype')&&seed.includes('native = {getItem:proto.getItem')&&seed.includes('stageKey'));
check('Live mirror requires all core LIVE datasets',seed.includes('chickenEggApp2V1')&&seed.includes('chickenEggInventoryV2')&&seed.includes('chickenEggEntriesV102')&&seed.includes('chickenEggSettingsV102')&&seed.includes('REQUIRED_CORE.every'));
check('Live mirror excludes private customer requests',seed.includes('/^chickenEggCustomerRequestsV1$/i'));
check('Live mirror excludes bulky photo caches and snapshots',seed.includes('chickenEggLocalBirdPhotosV1')&&seed.includes('chickenEggBirdPhotoMetaV4')&&seed.includes('chickenEggApp2SnapshotsV1'));
check('Live mirror verifies every eligible copied value',seed.includes('sourceHash')&&seed.includes('stageHash')&&seed.includes('authoritativeVerified=keys.every')&&seed.includes('skipped===0')&&seed.includes('mismatchedKeys.length===0'));

check('Staging database has no Firebase imports',!database.includes('firebasejs')&&!database.includes('FirestoreDB'));
check('Staging photo service has no Firebase imports',!photos.includes('firebasejs')&&!photos.includes('FirestoreDB'));
check('Staging app2 removes live photo service',app2.includes('.replace(\'load("bird-photo-service-v4.js");\', \'load("staging/staging-photo-service.js");\')'));
check('Staging app2 removes live photo recovery',app2.includes('.replace(\'load("bird-photo-recovery-v2.js");\', \'\')'));
check('Staging app2 removes real customer owner auth',app2.includes('.replace(\'load("public-customer-owner-auth-v1.js");\', \'\')'));
check('Staging app2 removes real customer publisher',app2.includes('.replace(\'load("public-customer-publisher-v1.js");\', \'\')'));
check('Staging app2 removes real customer sync UI',app2.includes('.replace(\'load("public-customer-sync-ui-v1.js");\', \'\')'));
check('Staging app2 rejects old homemade Customer Requests UI',app2.includes('Old homemade staging Customer Requests UI remained loaded'));
check('Staging app2 injects live-parity Customer Requests layer',app2.includes('staging/staging-customer-requests-live-parity-v1.js'));
check('Staging app2 loads bird-sales manager through sandboxed runtime',app2.includes('load("bird-sales-v1.js")'));
check('Staging banner clearly identifies test mode',banner.includes('TEST / STAGING')&&banner.includes('LIVE FIREBASE IS READ-ONLY'));

check('Normal staging startup uses the local mirror before optional read-only flock repair',firebase.includes('STAGING-READONLY-LIVE-FIREBASE-MEMORY-4')&&firebase.includes('void localReady().then(()=>ensureFlockIfMissing())'));
check('Staging Firebase cloud access remains read-only',firebase.includes('__STAGING_FIREBASE_READONLY__ = true')&&firebase.includes('getDoc')&&firebase.includes('getDocs')&&!/\b(setDoc|addDoc|updateDoc|deleteDoc|runTransaction|writeBatch|onSnapshot)\b/.test(firebase));
check('Staging Firebase does not expose live Firestore handles',firebase.includes('__STAGING_FIREBASE_READONLY__ = true')&&!firebase.includes('window.FirestoreDB =')&&!firebase.includes('window.FirebaseUser ='));
check('Staging refresh loads authoritative Firebase into the memory sandbox only',firebase.includes('fetchLiveFirebaseSnapshot')&&firebase.includes('startQuotaFreeTestMemory')&&firebase.includes('source:"firebase-read-only-memory"')&&firebase.includes('inMemory:true'));
check('Staging cloud fallback is compact and scoped',firebase.includes('farm_app_2_v1')&&firebase.includes('farm_inventory_v2')&&firebase.includes('farm_deluxe_v1')&&firebase.includes('farm_business_v1')&&firebase.includes('where("type","in",["eggs","sale"])')&&!firebase.includes('getDocs(collection(db,"entries"))'));
check('Staging writes imported data through remote safety bypass',firebase.includes('__farmApplyingRemote')&&firebase.includes('runBypass(doWrite)'));
check('Staging refreshes in-memory core/App2 state after mirror',firebase.includes('function refreshAppMemory()')&&firebase.includes('window.loadLocal?.()')&&firebase.includes('window.__reloadFarm2Memory?.()')&&firebase.includes('refreshAppMemory();'));
check('Staging releases normal startup write lock after mirror',firebase.includes('FarmBootstrapSafety?.unlock?.()')&&firebase.includes('unlockSandbox();'));

check('Customer Preview requires a verified read-only LIVE snapshot before opening',previewGuard.includes('refreshSource')&&previewGuard.includes('r?.verified')&&previewGuard.includes('preparePreviewSnapshot')&&previewGuard.includes('sessionStorage.setItem'));
check('Customer Requests staging parity fetches the real live owner UI source',requestParity.includes('../customer-requests-owner-v1.js')&&requestParity.includes('Live Customer Requests data-layer signature changed'));
check('Customer Requests parity replaces the live SDK with sandbox-only fake Firestore',requestParity.includes('__stagingCustomerRequests')&&requestParity.includes('Staging write blocked')&&requestParity.includes('fs=window.StagingCustomerRequestsLiveParityV1.firestoreApi')&&requestParity.includes('source=source.replace(sdkOld,sdkNew)'));
check('Customer status candidate renders success without listener dependency',requestParity.includes('btn.textContent="Updating…"')&&requestParity.includes('if(row){row.status=status')&&requestParity.includes('finally{')&&requestParity.includes('busy=false;render();'));
check('Status torture test suppresses listener and verifies Cancelled',requestStatusTest.includes('setSuppressEmit(true)')&&requestStatusTest.includes('snapshot listener suppressed')&&requestStatusTest.includes('Cancelled'));
check('Ready gate self-loads parity and delegates a fresh verified source to the memory runner',readyGate.includes('selfRefreshesVerifiedLiveSource:true')&&readyGate.includes('StagingCustomerRequestsV1?.version!=="live-parity"')&&readyGate.includes('StagingTestMemoryRunnerV1.run'));
check('Memory runner reloads verified read-only LIVE Firebase before every destructive run',memoryRunner.includes('refreshVerifiedLiveSource')&&memoryRunner.includes('StagingSandbox.resetFromLive')&&memoryRunner.includes('Refreshing LIVE test copy'));

check('Full staging runner snapshots and restores sandbox data',fullTest.includes('snap=snapshot()')&&fullTest.includes('restore(snap)'));
check('Full staging runner exercises egg add/edit/delete',fullTest.includes('Egg collection creates one history entry')&&fullTest.includes('Editing collection applies only the +2 inventory delta')&&fullTest.includes('Deleting collection reverses its inventory effect'));
check('Full staging runner exercises unpaid sale and payment',fullTest.includes('Sale customer / unpaid metadata saves')&&fullTest.includes('Who Owes renders unpaid sale on Home')&&fullTest.includes('Mark Paid does not change inventory'));
check('Full staging runner exercises farm modules',fullTest.includes('Customer add works')&&fullTest.includes('Expense add works')&&fullTest.includes('Chore add works')&&fullTest.includes('Flock profile add works')&&fullTest.includes('Chicken sale add works'));
check('Bird-sales regression proves egg inventory and history stay unchanged',birdSalesTest.includes('does not change egg inventory')&&birdSalesTest.includes('does not change egg/sale history')&&birdSalesTest.includes('never changes egg inventory/history'));
check('Bird-sales regression checks public privacy boundary',birdSalesTest.includes('SECRET BIRD BUYER')&&birdSalesTest.includes('SECRET FEED COST')&&birdSalesTest.includes('never enter public bird payload'));
check('Live app remains on current normal loader',liveApp2.includes('load("inventory-system-v6.js")')&&liveApp2.includes('load("who-owes.js")')&&!liveApp2.includes('staging/staging-firebase.js'));

console.log('\nChicken Eggs staging isolation audit');
for(const p of passes)console.log('PASS ',p);
if(failures.length){console.error('\nFAILURES:');for(const f of failures)console.error('FAIL ',f);process.exit(1);}
console.log(`\nAll ${passes.length} staging isolation checks passed.`);
