const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const failures=[];const pass=(name,ok)=>ok?console.log('PASS',name):failures.push(name);

const stage=read('staging/index.html');
const owner=read('staging/owner-farm/index.html');
const bridge=read('staging/staging-business-refresh-v1.js');
const v2=read('staging/staging-full-test-v2.js');

pass('Regular staging loads business display bridge',stage.includes('staging/staging-business-refresh-v1.js'));
pass('Regular staging loads full sandbox v2',stage.includes('staging/staging-full-test-v2.js'));
pass('Owner staging loads business display bridge',owner.includes('staging/staging-business-refresh-v1.js'));
pass('Owner staging loads full sandbox v2',owner.includes('staging/staging-full-test-v2.js'));
pass('Business bridge reacts to core sale sync',bridge.includes('core-data-synced')&&bridge.includes('staging-business-display-refreshed'));
pass('Business bridge updates Egg Sales without replacing calculator HTML',bridge.includes('setStat(home,"Egg Sales"')&&!bridge.includes('home.innerHTML='));
pass('Business bridge updates visible Net Profit/Loss',bridge.includes('el.id!=="bizCalcResult"')&&bridge.includes('net.textContent='));
pass('Business bridge captures calculator before event-driven redraw',bridge.includes('captureCalc')&&bridge.includes('addEventListener(name,schedule,true)'));
pass('Business bridge restores open calculator state',bridge.includes('if(details&&snapshot.open)details.open=true'));
pass('V2 test uses the current date for profit regression',v2.includes('saleDate:today()'));
pass('V2 test simulates real calculator input events',v2.includes('dispatchEvent(new Event("input",{bubbles:true}))'));
pass('V2 test verifies calculator arithmetic',v2.includes('Profit/Loss Calculator computes typed values correctly'));
pass('V2 test requires exact $5 revenue increase',v2.includes('$5 egg sale increases current-month egg revenue by exactly $5'));
pass('V2 test requires exact $5 net improvement',v2.includes('$5 egg sale improves current-month profit/loss by exactly $5'));
pass('V2 test checks visible Home Egg Sales',v2.includes('Home Egg Sales visibly increases by exactly $5'));
pass('V2 test checks visible Home Net Profit/Loss',v2.includes('Home Net Profit/Loss visibly improves by exactly $5'));
pass('V2 test deliberately leaves calculator open',v2.includes('details.open=true')&&v2.includes('Open Profit/Loss Calculator does not freeze business totals'));
pass('V2 test requires calculator to remain open',v2.includes('Open Profit/Loss Calculator stays open through business refresh'));
pass('V2 test preserves calculator inputs and result',v2.includes('Business refresh preserves calculator inputs')&&v2.includes('Business refresh preserves calculator result'));
pass('V2 test restores sale date field',v2.includes('Sandbox test restores sale date form field'));
pass('V2 test restores egg date field',v2.includes('Sandbox test restores egg date form field'));
pass('V2 suite cannot masquerade as old 40-check runner',v2.includes('suite:"staging-full-v2-visible-business"')&&v2.includes('suite:"v2-visible-business"'));

if(failures.length){console.error('\nFAILURES:');for(const x of failures)console.error('FAIL',x);process.exit(1);}
console.log('\nAll staging visible-profit and calculator regression architecture checks passed.');
