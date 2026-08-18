const fs=require('fs');
const path=require('path');
const vm=require('vm');

class FakeStorage{
  constructor(seed={}){this._map=new Map(Object.entries(seed));}
  get length(){return this._map.size;}
  getItem(k){k=String(k);return this._map.has(k)?this._map.get(k):null;}
  setItem(k,v){this._map.set(String(k),String(v));}
  removeItem(k){this._map.delete(String(k));}
  clear(){this._map.clear();}
  key(i){return [...this._map.keys()][Number(i)]??null;}
}
class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail;}}

const liveEntries=JSON.stringify([{id:'live-sale',type:'sale',date:'2026-08-18',dozenSold:1,dozenPrice:5}]);
const liveApp=JSON.stringify({flock:[{id:'arie',name:'Arie'}],saleMeta:{'live-sale':{paid:false}}});
const store=new FakeStorage({
  chickenEggEntriesV102:liveEntries,
  chickenEggApp2V1:liveApp,
  unrelatedSiteKey:'do-not-touch'
});
const events=[];
const window={localStorage:store,__ChickenEggsStagingMode:false,dispatchEvent:e=>events.push(e)};
window.window=window;
const context=vm.createContext({window,localStorage:store,Storage:FakeStorage,CustomEvent,console,setTimeout,clearTimeout,JSON,Date,Math,Number,String,Array,Object,RegExp});

const root=path.resolve(__dirname,'..');
vm.runInContext(fs.readFileSync(path.join(root,'staging/staging-storage.js'),'utf8'),context,{filename:'staging-storage.js'});

const PREFIX='__chicken_eggs_staging__::';
function raw(k){return store._map.get(k);}
function assert(ok,msg){if(!ok)throw new Error(msg);}

assert(raw('chickenEggEntriesV102')===liveEntries,'initial live entries changed during staging seed');
assert(raw('chickenEggApp2V1')===liveApp,'initial live app state changed during staging seed');
assert(raw(PREFIX+'chickenEggEntriesV102')===liveEntries,'staging did not copy live entries into isolated key');
assert(store.getItem('chickenEggEntriesV102')===liveEntries,'virtual staging read did not return staged copy');

store.setItem('chickenEggEntriesV102',JSON.stringify([{id:'TEST-ONLY',type:'eggs',eggs:999}]));
assert(raw('chickenEggEntriesV102')===liveEntries,'staging setItem overwrote live entries');
assert(raw(PREFIX+'chickenEggEntriesV102').includes('TEST-ONLY'),'staging setItem did not update isolated copy');

vm.runInContext(fs.readFileSync(path.join(root,'staging/staging-database.js'),'utf8'),context,{filename:'staging-database.js'});

(async()=>{
  await window.ChickenEggsDB.saveEntry({id:'staging-sale',type:'sale',date:'2099-01-01',dozenSold:10,dozenPrice:99});
  const staged=JSON.parse(store.getItem('chickenEggEntriesV102'));
  assert(staged.some(x=>x.id==='staging-sale'),'staging database failed to create test sale');
  assert(raw('chickenEggEntriesV102')===liveEntries,'staging database save touched live entries');

  await window.ChickenEggsDB.deleteEntry('staging-sale');
  assert(!JSON.parse(store.getItem('chickenEggEntriesV102')).some(x=>x.id==='staging-sale'),'staging delete failed inside sandbox');
  assert(raw('chickenEggEntriesV102')===liveEntries,'staging database delete touched live entries');

  store.removeItem('chickenEggApp2V1');
  assert(raw('chickenEggApp2V1')===liveApp,'staging removeItem deleted live app state');

  store.clear();
  assert(raw('chickenEggEntriesV102')===liveEntries,'staging clear deleted live entries');
  assert(raw('chickenEggApp2V1')===liveApp,'staging clear deleted live app state');
  assert(raw('unrelatedSiteKey')==='do-not-touch','staging clear touched unrelated live storage');

  console.log('PASS Staging destructive isolation: seed, add, edit/write, delete, remove and clear cannot modify live localStorage');
})().catch(error=>{console.error('STAGING ISOLATION FAILED:',error);process.exit(1);});
