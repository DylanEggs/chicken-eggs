const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const rotation=fs.readFileSync(path.join(root,'chicken-of-day-rotation-v1.js'),'utf8');
const builder=fs.readFileSync(path.join(root,'customer-public-builder-v1.js'),'utf8');
const rotationBridge=fs.readFileSync(path.join(root,'customer-public-chicken-rotation-v1.js'),'utf8');
const publisher=fs.readFileSync(path.join(root,'public-customer-publisher-v1.js'),'utf8');
const reader=fs.readFileSync(path.join(root,'customer-public-reader-v1.js'),'utf8');
const publicAuth=fs.readFileSync(path.join(root,'public-customer-owner-auth-v1.js'),'utf8');
const liveApp=fs.readFileSync(path.join(root,'app2.js'),'utf8');
const failures=[];const check=(name,ok,detail='')=>{console.log(ok?'PASS':'FAIL',name,detail);if(!ok)failures.push(name);};
const window={};
const context=vm.createContext({window,Date,Number,String,Math,JSON,Array,Object,RegExp,Set,Map,console});
vm.runInContext(rotation,context);
vm.runInContext(builder,context);
vm.runInContext(rotationBridge,context);
const api=window.FarmPublicCustomerBuilderV1;
const rotate=window.FarmChickenOfDayRotationV1;
check('Pure public builder initializes',!!api?.build);
check('Shared Chicken of the Day rotation initializes',!!rotate?.pick&&!!rotate?.orderForCycle);
const fake=Array.from({length:12},(_,i)=>({id:`bird-${i+1}`,name:`Bird ${i+1}`,status:'Active'}));
const roundA=rotate.orderForCycle(fake,4321),roundB=rotate.orderForCycle(fake,4322);
check('Chicken of the Day round has no repeats',new Set(roundA.map(x=>x.id)).size===fake.length);
check('Chicken of the Day round includes every bird',fake.every(x=>roundA.some(y=>y.id===x.id)));
check('Next Chicken of the Day round has no repeats',new Set(roundB.map(x=>x.id)).size===fake.length);
check('New round does not immediately repeat prior bird',roundA[roundA.length-1]?.id!==roundB[0]?.id);
check('Manual Chicken of the Day override still wins',rotate.pick(fake,'2026-08-24',{photoOverrideDate:'2026-08-24',photoOverrideBirdId:'bird-9'})?.id==='bird-9');
check('Inactive/sold birds are excluded from rotation',!rotate.eligible([...fake,{id:'gone',status:'Sold'},{id:'off',status:'Inactive'}]).some(x=>x.id==='gone'||x.id==='off'));
check('Chicken rotation declares zero Firebase/network calls',rotate.firebaseReads===0&&rotate.firebaseWrites===0&&rotate.networkCalls===0);
const privateValues=['SECRET CUSTOMER','555-1212','OWES MONEY','PRIVATE SALE BUYER','PRIVATE EXPENSE','PRIVATE ORDER NOTE','PRIVATE BIRD NOTE','PRIVATE PRICE'];
const input={
  app2:{
    customers:[{name:'SECRET CUSTOMER',contact:'555-1212',notes:'OWES MONEY'}],
    orders:[{status:'pending',dozen:1,packs18:0,notes:'PRIVATE ORDER NOTE',customer:'SECRET CUSTOMER'}],
    expenses:[{amount:999,description:'PRIVATE EXPENSE'}],
    saleMeta:{sale1:{paid:false,note:'OWES MONEY'}},
    flock:[{id:'bird1',name:'Public Hen',breed:'Barred Rock',sex:'Hen',hatchDate:'2026-04-01',status:'Active',notes:'PRIVATE BIRD NOTE'},{id:'bird2',name:'Old Roo',breed:'Mix',sex:'Rooster',status:'Rehomed'}]
  },
  inventory:{dozens:4,packs18:1,loose:6,adjustments:[{details:'PRIVATE INVENTORY NOTE'}]},
  entries:[{id:'e1',type:'eggs',date:'2026-08-18',eggs:10},{id:'s1',type:'sale',date:'2026-08-18',dozenSold:1,dozenPrice:5,buyer:'PRIVATE SALE BUYER',note:'PRIVATE PRICE'}],
  settings:{farmName:'Rose Family Poultry',hens:30,dozenPrice:5,packPrice:7},
  weather:{location:'High Point, NC',latitude:35.9,longitude:-80,current:{temperature:81,apparent:84,humidity:60,code:1},forecast:{'2026-08-18':{max:88,min:69,precipProbability:25,code:1}},history:{secret:'PRIVATE WEATHER HISTORY'}},
  deluxe:{photoOverrideDate:'2026-08-18',photoOverrideBirdId:'bird1',birdPhotoUrls:{secret:'PRIVATE PHOTO URL'}},
  photoResolver:id=>id==='bird1'?'data:image/jpeg;base64,AAAA':''
};
const out=api.build(input);const text=JSON.stringify(out);
check('Pending reservation reduces public availability without exposing order',out.summary.availability.eggs===60,JSON.stringify(out.summary.availability));
check('Only active flock profile is public',out.flock.length===1&&out.flock[0].name==='Public Hen');
check('Public flock includes safe photo',String(out.flock[0].photo).startsWith('data:image/'));
check('Public Chicken of the Day bridge is active',api.__noRepeatChickenRotation===true);
check('Public Chicken of the Day is selected from sanitized flock',out.summary.chickenOfTheDayId==='bird1');
check('Monthly and yearly forecasts exist',Number.isFinite(out.summary.production.predictedMonth)&&Number.isFinite(out.summary.production.predictedYear));
check('Public weather strips coordinates/history',!('latitude' in out.summary.weather)&&!('longitude' in out.summary.weather)&&!('history' in out.summary.weather));
for(const value of privateValues)check(`Private value absent: ${value}`,!text.includes(value));
const forbiddenKeys=new Set(['customers','orders','expenses','saleMeta','notes','contact','buyer','paid','dozenPrice','packPrice','price','revenue','profit','adjustments','latitude','longitude','history']);
function walk(value,path='root'){if(!value||typeof value!=='object')return;for(const [key,child] of Object.entries(value)){check(`Forbidden key absent at ${path}.${key}`,!forbiddenKeys.has(key));walk(child,`${path}.${key}`);}}
walk(out);
check('Publisher requires exact owner UID',publisher.includes('aLvjMpXgMJf5W3YUjQM6wqKagLo2')&&publisher.includes('OWNER_UID'));
check('Publisher writes public summary collection only',publisher.includes('"public_customer","current"'));
check('Publisher writes public flock collection only',publisher.includes('"public_flock",safeDocId'));
check('Publisher never targets private farm collections with setDoc',!/setDoc\([^\n]*(?:"entries"|"farm"|"farm_app_2_v1"|"farm_inventory_v2"|"farm_business_v1")/.test(publisher));
check('Publisher stores hashes only, not customer credentials',!publisher.toLowerCase().includes('password')&&!publisher.toLowerCase().includes('customjeepyj@gmail.com'));
check('Public owner auth uses separate named Firebase app',publicAuth.includes('rose-family-public-publisher')&&publicAuth.includes('initializeApp(firebaseConfig,APP_NAME)'));
check('Public owner auth uses email/password and exact UID',publicAuth.includes('signInWithEmailAndPassword')&&publicAuth.includes('OWNER_UID')&&publicAuth.includes('!isOwner(user)'));
check('Public owner auth does not hard-code owner email',!publicAuth.toLowerCase().includes('customjeepyj@gmail.com'));
check('Public owner auth never writes credentials to browser storage',!/(localStorage|sessionStorage)\.(setItem|removeItem|clear)/.test(publicAuth));
check('Public reader does not import Firebase Authentication',!reader.includes('firebase-auth.js')&&!/getAuth|signIn|signOut/.test(reader));
check('Public reader imports no Firestore write API',!/(setDoc|addDoc|updateDoc|deleteDoc|runTransaction|writeBatch)/.test(reader));
check('Public reader reads only dedicated public collections',reader.includes('"public_customer","current"')&&reader.includes('"public_flock"')&&!reader.includes('"entries"')&&!reader.includes('"farm","settings"'));
check('Public reader writes no browser storage',!/localStorage\.(setItem|removeItem|clear)/.test(reader));
const publisherLoaded=liveApp.includes('public-customer-publisher-v1.js');
if(publisherLoaded){
  const required=['chicken-of-day-rotation-v1.js','customer-public-builder-v1.js','customer-public-builder-v2.js','customer-public-chicken-rotation-v1.js','public-customer-owner-auth-v1.js','public-customer-publisher-v1.js','public-customer-sync-ui-v1.js'];
  for(const file of required)check(`Live publisher rollout loads ${file}`,liveApp.includes(file));
  check('Live rotation loads before public builder',liveApp.indexOf('chicken-of-day-rotation-v1.js')<liveApp.indexOf('customer-public-builder-v1.js'));
  check('Live public rotation bridge loads before publisher',liveApp.indexOf('customer-public-chicken-rotation-v1.js')<liveApp.indexOf('public-customer-publisher-v1.js'));
  check('Live publisher load order puts sanitizer before publisher',liveApp.indexOf('customer-public-builder-v1.js')<liveApp.indexOf('public-customer-publisher-v1.js')&&liveApp.indexOf('customer-public-builder-v2.js')<liveApp.indexOf('public-customer-publisher-v1.js'));
  check('Live publisher load order puts isolated owner auth before publisher',liveApp.indexOf('public-customer-owner-auth-v1.js')<liveApp.indexOf('public-customer-publisher-v1.js'));
}else{
  check('Live publisher remains safely disabled until rollout wiring is complete',true);
}
if(failures.length){console.error(`Public customer snapshot checks failed: ${failures.join(', ')}`);process.exit(1);}console.log('All public customer snapshot privacy + Chicken of the Day rotation checks passed.');
