import { chromium } from 'playwright';
const url='https://dylaneggs.github.io/chicken-eggs/view/';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},locale:'en-US',timezoneId:'America/New_York'});
try{
  const page=await context.newPage();
  await page.goto(`${url}?rules=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:120000});
  const result=await page.evaluate(async()=>{
    const appSdk=await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js');
    const fsSdk=await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
    const config={apiKey:'AIzaSyCSruU8Sae0mFI16N2tcIh2GRLartzYhHE',authDomain:'chicken-eggs-53358.firebaseapp.com',projectId:'chicken-eggs-53358',storageBucket:'chicken-eggs-53358.firebasestorage.app',messagingSenderId:'461720066101',appId:'1:461720066101:web:6b19a7c4d245f399cf797c'};
    const app=appSdk.getApps().find(a=>a.name==='publicBoundaryProbe')||appSdk.initializeApp(config,'publicBoundaryProbe');
    const db=fsSdk.getFirestore(app);
    async function probe(label,fn){try{const value=await fn();return{label,allowed:true,exists:value?.exists?.()??null,size:value?.size??null,code:''};}catch(error){return{label,allowed:false,exists:null,size:null,code:String(error?.code||error?.message||error)};}}
    return await Promise.all([
      probe('public_customer',()=>fsSdk.getDoc(fsSdk.doc(db,'public_customer','current'))),
      probe('public_flock',()=>fsSdk.getDocs(fsSdk.query(fsSdk.collection(db,'public_flock'),fsSdk.limit(1)))),
      probe('private_app2',()=>fsSdk.getDoc(fsSdk.doc(db,'entries','farm_app_2_v1'))),
      probe('private_settings',()=>fsSdk.getDoc(fsSdk.doc(db,'farm','settings')))
    ]);
  });
  console.log('DEPLOYED FIRESTORE READ BOUNDARY',JSON.stringify(result));
  const by=Object.fromEntries(result.map(x=>[x.label,x]));
  if(!by.public_customer?.allowed)throw new Error(`public_customer is not publicly readable: ${by.public_customer?.code}`);
  if(!by.public_flock?.allowed)throw new Error(`public_flock is not publicly readable: ${by.public_flock?.code}`);
  if(by.private_app2?.allowed)throw new Error('Private app2 document is publicly readable');
  if(by.private_settings?.allowed)throw new Error('Private farm settings are publicly readable');
  console.log('PASS deployed Firestore read boundary — public customer/flock readable, private farm denied');
}finally{await browser.close();}
