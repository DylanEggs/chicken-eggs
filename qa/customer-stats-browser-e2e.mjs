import { chromium } from 'playwright';
import fs from 'node:fs';
import { installStagingLiveBrowserFixture } from './staging-live-browser-fixture.mjs';
const expected=JSON.parse(fs.readFileSync(new URL('../staging/staging-build.json',import.meta.url),'utf8')).build;
const base='https://dylaneggs.github.io/chicken-eggs/staging/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitForDeploy(){for(let i=0;i<60;i++){try{const r=await fetch(`${base}staging-build.json?t=${Date.now()}-${i}`,{cache:'no-store'});if(r.ok&&(await r.json()).build===expected)return;}catch{}await sleep(5000);}throw new Error('Expected staging build did not deploy');}
await waitForDeploy();
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},locale:'en-US',timezoneId:'America/New_York'});
await installStagingLiveBrowserFixture(context);
try{
  const farm=await context.newPage();
  await farm.goto(`${base}?seed=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:120000});
  await farm.waitForFunction(()=>window.StagingFinalTestReadyGateV1?.ready?.()===true,null,{timeout:45000});
  const mirror=await farm.evaluate(()=>window.StagingLocalSeedV1?.result);
  if(!mirror?.verified)throw new Error('Stats E2E did not start from verified LIVE mirror');

  const page=await context.newPage();
  await page.goto(`${base}view/stats.html?t=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>Number(window.CustomerStatsStaging?.getData?.()?.publicVersion)>=2,null,{timeout:30000});
  const state=await page.evaluate(()=>{const d=window.CustomerStatsStaging.getData();return {version:d.publicVersion,schema:d.schema,daily:d.stats?.daily30?.length,weekly:d.stats?.weekly8?.length,monthly:d.stats?.monthly12?.length,lifetime:d.stats?.records?.lifetimeEggs,factors:d.weatherInsights?.factors?.length,inputs:document.querySelectorAll('input,textarea,select').length,canvases:document.querySelectorAll('canvas').length,text:document.body.innerText};});
  if(Number(state.version)<2||state.schema!=='customer-public-v1')throw new Error('Stats page did not load the current public customer snapshot');
  if(state.daily!==30||state.weekly!==8||state.monthly!==12)throw new Error('Public chart series lengths are wrong');
  if(!Number.isFinite(Number(state.lifetime)))throw new Error('Lifetime egg count is not numeric');
  if(Number(state.factors)>4)throw new Error('Weather factors exceeded public limit');
  if(state.inputs!==0||state.canvases!==3)throw new Error('Stats page has wrong read-only/chart structure');
  if(!state.text.includes('Production highlights')||!state.text.includes('Weather + laying')||!state.text.includes('Egg Stats'))throw new Error('Stats page is missing public sections');
  const publicData=await page.evaluate(()=>JSON.stringify(window.CustomerStatsStaging.getData()));
  for(const word of ['"customers"','"expenses"','"saleMeta"','"revenue"','"profit"','"dozenPrice"','"packPrice"','"history"'])if(publicData.includes(word))throw new Error(`Forbidden public field found: ${word}`);
  console.log(`PASS customer stats browser test ${expected} — verified LIVE mirror`);
}finally{await browser.close();}
