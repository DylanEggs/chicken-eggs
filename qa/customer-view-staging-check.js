const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const failures=[];const passes=[];
const check=(name,ok,detail='')=>ok?passes.push(name):failures.push(`${name}${detail?` — ${detail}`:''}`);

const PREFIX='__chicken_eggs_staging__::';
const store=new Map();
const put=(key,value)=>store.set(PREFIX+key,JSON.stringify(value));
put('chickenEggApp2V1',{
  customers:[{id:'private-customer',name:'TOP SECRET CUSTOMER',contact:'555-PRIVATE',notes:'never publish customer notes'}],
  orders:[{id:'private-order',status:'pending',dozen:1,packs18:0,notes:'private reservation'}],
  expenses:[{amount:999,description:'PRIVATE EXPENSE'}],
  saleMeta:{sale1:{customerId:'private-customer',paid:false,note:'PRIVATE PAYMENT NOTE'}},
  flock:[
    {id:'hen1',name:'Public Hen',breed:'Barred Rock',sex:'Hen',hatchDate:'2026-04-01',status:'Active',notes:'PRIVATE FLOCK NOTE'},
    {id:'roo1',name:'Public Roo',breed:'Ameraucana',sex:'Rooster',hatchDate:'2026-05-01',status:'Active',notes:'PRIVATE ROOSTER NOTE'},
    {id:'old1',name:'Do Not Show',breed:'Mix',sex:'Rooster',status:'Rehomed',notes:'PRIVATE OLD BIRD'}
  ]
});
put('chickenEggInventoryV2',{dozens:5,packs18:2,loose:8,updatedAt:12345});
put('chickenEggEntriesV102',[
  {id:'egg1',type:'eggs',date:'2026-08-18',eggs:10,updatedAt:10},
  {id:'egg2',type:'eggs',date:'2026-08-17',eggs:12,updatedAt:9},
  {id:'sale1',type:'sale',date:'2026-08-18',dozenSold:1,dozenPrice:5,packSold:0,packPrice:0,buyer:'PRIVATE BUYER'}
]);
put('chickenEggSettingsV102',{farmName:'Rose Family Poultry',hens:30,roosters:5,dozenPrice:5,packPrice:7});
put('chickenEggWeatherIntelligenceV2',{
  location:'High Point, NC',label:'High Point, NC',latitude:35.9,longitude:-80.0,
  history:{'2026-08-17':{max:90}},
  current:{temperature:82,apparent:85,humidity:60,code:1},
  forecast:{'2026-08-18':{max:88,min:69,precipProbability:25,code:1}},updatedAt:99,lastRefreshAt:100
});
put('chickenEggDeluxeV1',{photoOverrideDate:'2026-08-18',photoOverrideBirdId:'hen1',birdPhotoUrls:{private:'PRIVATE URL'}});
put('chickenEggLocalBirdPhotosV1',{hen1:'data:image/jpeg;base64,AAAA',roo1:'https://example.com/roo.jpg'});
put('chickenEggStagingSeedV1',{completed:true,importedAt:777});

const localStorage={getItem:key=>store.has(String(key))?store.get(String(key)):null};
const window={localStorage};
const context=vm.createContext({window,console,Date,Number,String,Math,JSON,Array,Object,RegExp,Set,Map});
vm.runInContext(read('staging/customer-public-data-v1.js'),context,{filename:'customer-public-data-v1.js'});
const out=window.StagingCustomerPublicData.build();
const text=JSON.stringify(out);

check('Customer public data module initializes',!!window.StagingCustomerPublicData?.build);
check('Customer contract is explicitly public v1',out.schema==='customer-public-v1'&&out.environment==='staging-preview');
check('Available eggs subtract private reservations without publishing them',out.availability.eggs===92,JSON.stringify(out.availability));
check('Farm branding survives sanitization',out.farm.name==='Rose Family Poultry');
check('Only current flock profiles are published',out.flock.length===2&&out.flock.every(b=>b.id!=='old1'));
check('Flock public fields contain no notes',out.flock.every(b=>!Object.prototype.hasOwnProperty.call(b,'notes')));
check('Chicken of the Day can use current safe profile',out.chickenOfTheDay?.id==='hen1');
check('Photos survive public sanitization',out.flock.some(b=>String(b.photo).startsWith('data:image/'))&&out.flock.some(b=>String(b.photo).startsWith('https://')));
check('Weather strips coordinates and history',!Object.prototype.hasOwnProperty.call(out.weather,'latitude')&&!Object.prototype.hasOwnProperty.call(out.weather,'longitude')&&!Object.prototype.hasOwnProperty.call(out.weather,'history'));
check('Forecast exposes production counts without sale values',Number.isFinite(out.production.predictedWeek)&&Number.isFinite(out.production.predictedMonth));
check('Facts are available for customer rotation',Array.isArray(out.facts)&&out.facts.length>=30);

const forbiddenValues=['TOP SECRET CUSTOMER','555-PRIVATE','never publish customer notes','PRIVATE EXPENSE','PRIVATE PAYMENT NOTE','PRIVATE BUYER','PRIVATE FLOCK NOTE','PRIVATE ROOSTER NOTE','PRIVATE OLD BIRD','PRIVATE URL'];
for(const value of forbiddenValues)check(`Private value is absent: ${value}`,!text.includes(value));
const forbiddenKeys=new Set(['customers','orders','expenses','saleMeta','notes','contact','buyer','paid','dozenPrice','packPrice','price','revenue','profit','latitude','longitude','history']);
function walk(value,path='root'){
  if(!value||typeof value!=='object')return;
  for(const [key,child] of Object.entries(value)){
    check(`Forbidden public key absent at ${path}.${key}`,!forbiddenKeys.has(key));
    walk(child,`${path}.${key}`);
  }
}
walk(out);

const pub=read('staging/customer-public-data-v1.js');
const view=read('staging/view/view.js');
const html=read('staging/view/index.html');
const banner=read('staging/staging-banner.js');
const requestParity=read('staging/view/customer-requests-live-parity-v1.js');
const requestTest=read('staging/view/customer-requests-ui-test-v1.js');
const liveRequest=read('view/customer-requests-v1.js');
check('Customer sanitizer is read-only',!pub.includes('localStorage.setItem')&&!pub.includes('localStorage.removeItem')&&!pub.includes('localStorage.clear'));
check('Customer view is read-only',!view.includes('localStorage.setItem')&&!view.includes('localStorage.removeItem')&&!view.includes('localStorage.clear'));
check('Customer view loads no live Firebase SDK or farm Firestore handles',!/(firebase-app\.js|firebase-firestore\.js|FirestoreDB|FirebaseUser|\bsetDoc\b|\baddDoc\b|\bupdateDoc\b|\bdeleteDoc\b)/i.test(view+html));
check('Static customer shell has no admin data-entry fields',!/<(input|textarea|select)\b/i.test(html));
check('Customer view does not load admin app scripts',!/(app2\.js|firebase\.js|database\.js|inventory-system|who-owes)/i.test(html));
check('Customer page is marked sandbox-only',/sandbox preview/i.test(html)&&/do not write to live Firebase/i.test(html));
check('Customer preview advertises the request form',html.includes('href="#customerRequestSection"')&&html.includes('Request Eggs / Birds'));
check('Customer preview loads request UI through its staging parity adapter',html.includes('customer-requests-live-parity-v1.js')&&requestParity.includes('StagingCustomerRequestPublicParityV1'));
check('Staging request storage is namespaced and isolated',requestParity.includes('__chicken_eggs_staging__::')&&requestParity.includes('staging-live-parity'));
check('Staging request form stays enabled for sandbox testing',requestParity.includes('return {enabled:true')&&requestTest.includes('keeps the request section forced on for sandbox testing'));
check('Request parity strips live Firebase imports before evaluation',requestParity.includes('source.replace(/^import')&&requestParity.includes('firestoreApi:fs,db:fakeDb'));
check('Live request form writes only to the dedicated request inbox',liveRequest.includes('addDoc(collection(db,"customer_requests")')&&!/\b(setDoc|updateDoc|deleteDoc)\b/.test(liveRequest));
check('Browser test submits a sandbox request and confirms no live request',requestTest.includes('creates exactly one sandbox request')&&requestTest.includes('No live Firebase request was created'));
check('Staging banner links to customer preview',banner.includes('staging/view/')&&banner.includes('Customer Preview'));

console.log('\nCustomer view staging privacy audit');
for(const p of passes)console.log('PASS ',p);
if(failures.length){console.error('\nFAILURES:');for(const f of failures)console.error('FAIL ',f);process.exit(1);}
console.log(`\nAll ${passes.length} customer-view checks passed.`);
