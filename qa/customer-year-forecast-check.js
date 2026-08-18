const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'staging/view/year-forecast-v1.js'),'utf8');
const store=new Map();
const prefix='__chicken_eggs_staging__::';
store.set(prefix+'chickenEggEntriesV102',JSON.stringify([
  {type:'eggs',date:'2026-01-02',eggs:8},
  {type:'eggs',date:'2026-08-17',eggs:13},
  {type:'eggs',date:'2026-08-18',eggs:10},
  {type:'sale',date:'2026-08-18',dozenSold:1}
]));
const elements=new Map();
function element(tag){return{tagName:tag.toUpperCase(),id:'',className:'',innerHTML:'',title:'',textContent:'',appendChild(child){if(child.id)elements.set(child.id,child);return child;}}}
const grid=element('div');grid.className='metric-grid';
const document={
  readyState:'complete',head:element('head'),
  getElementById:id=>elements.get(id)||null,
  querySelector:q=>q==='.metric-grid'?grid:null,
  createElement:tag=>element(tag),
  addEventListener(){}
};
const localStorage={getItem:key=>store.get(String(key))??null};
const window={
  CustomerViewStaging:{getData:()=>({production:{dailyPace:12.5}})},
  localStorage
};
const RealDate=Date;
class FixedDate extends RealDate{
  constructor(...args){super(...(args.length?args:['2026-08-18T12:00:00-04:00']));}
  static now(){return new RealDate('2026-08-18T12:00:00-04:00').getTime();}
}
const context=vm.createContext({window,document,localStorage,console,Date:FixedDate,Number,String,Math,JSON,setTimeout:()=>0,setInterval:()=>0});
vm.runInContext(code,context,{filename:'year-forecast-v1.js'});
const result=window.CustomerYearForecastV1.calculate();
const expectedCollected=31;
const current=new RealDate('2026-08-18T12:00:00');
const end=new RealDate(2026,11,31,12,0,0,0);
const remaining=Math.max(0,Math.round((end-current)/86400000));
const expected=Math.round(expectedCollected+12.5*remaining);
const checks=[
  ['Year forecast module initializes',!!window.CustomerYearForecastV1],
  ['Year-to-date uses egg entries only',result.yearCollected===expectedCollected],
  ['Year is current year',result.year===2026],
  ['Forecast preserves actual YTD then predicts remaining days',result.predictedYear===expected],
  ['Forecast never falls below actual YTD',result.predictedYear>=result.yearCollected],
  ['Module never writes browser storage',!code.includes('localStorage.setItem')&&!code.includes('localStorage.removeItem')&&!code.includes('localStorage.clear')],
  ['Module contains no Firebase access',!/(firebase|firestore|FirestoreDB|FirebaseUser|setDoc|addDoc|updateDoc|deleteDoc)/i.test(code)]
];
let failed=0;
for(const [name,pass] of checks){console.log(pass?'PASS':'FAIL',name);if(!pass)failed++;}
if(failed)process.exit(1);
console.log(`All ${checks.length} yearly customer forecast checks passed.`);
