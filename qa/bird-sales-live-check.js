const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const failures=[];const passes=[];
const check=(name,ok)=>ok?passes.push(name):failures.push(name);

const app2=read('app2.js');
const manager=read('bird-sales-v1.js');
const builder=read('customer-public-builder-v3.js');
const publisher=read('public-customer-bird-sales-publisher-v1.js');
const customerIndex=read('view/index.html');
const customerView=read('view/bird-sales-v1.js');
const stagingApp2=read('staging/staging-app2.js');
const rules=read('firebase-public-customer-transition-rules.txt');
const backup=read('complete-safety-backup-v3.js');

check('Live app loads bird sale manager',app2.includes('load("bird-sales-v1.js")'));
check('Live app loads bird sale sanitizer',app2.includes('load("customer-public-builder-v3.js")'));
check('Live app loads isolated bird sale publisher',app2.includes('load("public-customer-bird-sales-publisher-v1.js")'));
check('Owner manager stores listings only inside App2 dataset',manager.includes('const APP2_KEY = "chickenEggApp2V1"')&&!manager.includes('chickenEggInventoryV2')&&!manager.includes('chickenEggEntriesV102'));
check('Owner manager supports public hide/draft flag',manager.includes('public:row.public !== false')&&manager.includes('Show on customer page'));
check('Owner manager uses existing photo service',manager.includes('FarmBirdPhotosV4')&&manager.includes('saveFile'));
check('Public builder allowlists bird listing fields',builder.includes('breed:String(x.breed)')&&builder.includes('birdType:String(x.birdType')&&builder.includes('quantity')&&builder.includes('price')&&builder.includes('notes')&&builder.includes('photo:image'));
check('Public builder excludes private App2 collections',!builder.includes('.customers')&&!builder.includes('.expenses')&&!builder.includes('.orders')&&!builder.includes('saleMeta'));
check('Bird sale publisher targets only public_customer bird_sales',publisher.includes('"public_customer", DOC_ID')&&publisher.includes('const DOC_ID = "bird_sales"'));
check('Bird sale publisher has no private farm Firestore target',!publisher.includes('"entries"')&&!publisher.includes('"public_flock"'));
check('Bird sale publisher requires exact owner UID',publisher.includes('aLvjMpXgMJf5W3YUjQM6wqKagLo2')&&publisher.includes('Authorized owner publishing session required'));
check('Customer page loads bird sale view',customerIndex.includes('bird-sales-v1.js?v=20260819-1870'));
check('Customer bird view reads only public_customer bird_sales',customerView.includes('doc(db, "public_customer", "bird_sales")')&&!customerView.includes('collection(db, "entries")'));
check('Customer bird view contains no private farm storage keys',!customerView.includes('chickenEggApp2V1')&&!customerView.includes('chickenEggBusinessV1')&&!customerView.includes('chickenEggEntriesV102'));
check('Existing Firestore rules already allow safe public_customer reads',rules.includes('match /public_customer/{document=**}')&&rules.includes('allow read: if true')&&rules.includes('allow write: if isOwner()'));
check('Staging strips live bird sale publisher',stagingApp2.includes('.replace(\'load("public-customer-bird-sales-publisher-v1.js");\', \'\')')&&stagingApp2.includes('Live bird sale publisher remained in staging'));
check('Complete Safety Backup still includes App2 listing metadata',backup.includes('const APP2_KEY = "chickenEggApp2V1"')&&backup.includes('APP2_KEY'));

console.log('\nBird sales live rollout audit');
for(const p of passes)console.log('PASS ',p);
if(failures.length){console.error('\nFAILURES:');for(const f of failures)console.error('FAIL ',f);process.exit(1);}
console.log(`\nAll ${passes.length} bird sales live checks passed.`);
