const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const failures=[]; const passes=[];
const check=(name,ok,detail='')=>ok?passes.push(name):failures.push(`${name}${detail?` — ${detail}`:''}`);

const index=read('staging/index.html');
const storage=read('staging/staging-storage.js');
const firebase=read('staging/staging-firebase.js');
const database=read('staging/staging-database.js');
const photos=read('staging/staging-photo-service.js');
const app2=read('staging/staging-app2.js');
const banner=read('staging/staging-banner.js');
const liveApp2=read('app2.js');

check('Staging has a separate URL shell',index.includes('Chicken Eggs — STAGING')&&index.includes('staging/staging-storage.js'));
check('Staging normalizes live Firebase shell URL before swap',index.includes('replaceAsset(html,"firebase.js","v=6",build)'));
check('Staging normalizes live database shell URL before swap',index.includes('replaceAsset(html,"database.js","v=6",build)'));
check('Staging normalizes live app2 shell URL before swap',index.includes('replaceAsset(html,"app2.js","v=1",build)'));
check('Staging swaps out live Firebase entrypoint',index.includes('staging/staging-firebase.js')&&index.includes('type="module" src="firebase.js?v=${build}"'));
check('Staging swaps out live database adapter',index.includes('staging/staging-database.js'));
check('Staging swaps out live app2 loader',index.includes('staging/staging-app2.js'));
check('Staging boot refuses to run if live cloud scripts remain',index.includes('Safety stop: live firebase.js remained in staging shell')&&index.includes('Safety stop: live database.js remained in staging shell')&&index.includes('Safety stop: live app2.js remained in staging shell'));
check('Staging localStorage is namespaced',storage.includes('__chicken_eggs_staging__::'));
check('Staging clear is guarded and staging-only',storage.includes('if (!isStagingLocal(this)) return native.clear.call(this);')&&storage.includes('key.startsWith(PREFIX) && key !== INIT'));
check('Staging database has no Firebase imports',!database.includes('firebasejs')&&!database.includes('FirestoreDB'));
check('Staging photo service has no Firebase imports',!photos.includes('firebasejs')&&!photos.includes('FirestoreDB'));
check('Staging app2 removes live photo service',app2.includes('.replace(\'load("bird-photo-service-v4.js");\', \'load("staging/staging-photo-service.js");\')'));
check('Staging app2 removes live photo recovery',app2.includes('.replace(\'load("bird-photo-recovery-v2.js");\', \'\')'));
check('Staging banner clearly identifies test mode',banner.includes('TEST / STAGING')&&banner.includes('LIVE FARM DATA IS READ-ONLY'));
check('Staging Firebase imports reads only',firebase.includes('getDoc')&&firebase.includes('getDocs')&&firebase.includes('where'));
check('Staging Firebase has no Firestore write API imports',!/(setDoc|addDoc|updateDoc|deleteDoc|runTransaction|writeBatch|onSnapshot)\s*[,}]/.test(firebase));
check('Staging Firebase does not expose live Firestore handle',firebase.includes('Deliberately DO NOT expose FirestoreDB/FirebaseUser')&&!firebase.includes('window.FirestoreDB =')&&!firebase.includes('window.FirebaseUser ='));
check('Staging live snapshot is scoped, not whole collection',firebase.includes('where("type", "in", ["eggs", "sale"])')&&firebase.includes('where("type", "in", PHOTO_TYPES)')&&!firebase.includes('getDocs(collection(db, "entries"))'));
check('Live app remains on current normal loader',liveApp2.includes('load("inventory-system-v6.js")')&&liveApp2.includes('load("who-owes.js")')&&!liveApp2.includes('staging/staging-firebase.js'));

console.log('\nChicken Eggs staging isolation audit');
for(const p of passes)console.log('PASS ',p);
if(failures.length){console.error('\nFAILURES:');for(const f of failures)console.error('FAIL ',f);process.exit(1);}
console.log(`\nAll ${passes.length} staging isolation checks passed.`);
