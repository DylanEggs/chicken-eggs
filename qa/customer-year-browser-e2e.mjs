import { chromium } from 'playwright';
import fs from 'node:fs';

const expected = JSON.parse(fs.readFileSync(new URL('../staging/staging-build.json', import.meta.url), 'utf8')).build;
const base = 'https://dylaneggs.github.io/chicken-eggs/staging/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForDeploy() {
  for (let i = 1; i <= 72; i++) {
    try {
      const r = await fetch(`${base}staging-build.json?year=${Date.now()}-${i}`, { cache:'no-store' });
      if (r.ok) {
        const live = (await r.json()).build || '';
        if (live === expected) return;
        console.log(`YEAR E2E waiting: live=${live} expected=${expected} ${i}/72`);
      }
    } catch (error) {
      console.log(`YEAR E2E deployment wait: ${error.message} ${i}/72`);
    }
    await sleep(5000);
  }
  throw new Error(`Staging deployment ${expected} was not visible for yearly forecast test`);
}

await waitForDeploy();
const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ viewport:{width:390,height:844}, locale:'en-US', timezoneId:'America/New_York' });
const page = await context.newPage();
const errors=[];
page.on('pageerror', e => errors.push(e.message));
page.on('console', msg => { if (msg.type()==='error') errors.push(msg.text()); });

try {
  await page.goto(`${base}?yearseed=${Date.now()}`, { waitUntil:'domcontentloaded', timeout:120000 });
  await page.waitForFunction(() => window.__ChickenEggsEnvironment === 'staging' && window.StagingSandbox?.seedInfo?.()?.completed, null, { timeout:30000 });
  await page.evaluate(() => window.FarmSyncSafety?.ready?.());
  await page.waitForFunction(() => window.FarmSyncSafety?.isReady?.() === true, null, { timeout:30000 });

  const customer = await context.newPage();
  const customerErrors=[];
  customer.on('pageerror', e => customerErrors.push(e.message));
  customer.on('console', msg => { if (msg.type()==='error') customerErrors.push(msg.text()); });
  await customer.goto(`${base}view/?year=${Date.now()}`, { waitUntil:'domcontentloaded', timeout:120000 });
  await customer.waitForFunction(() => window.CustomerViewStaging?.getData?.()?.schema === 'customer-public-v1' && window.CustomerYearForecastV1?.calculate, null, { timeout:30000 });
  await customer.waitForSelector('#yearForecastCard', { state:'visible', timeout:30000 });

  const result = await customer.evaluate(() => {
    const calc = window.CustomerYearForecastV1.calculate();
    const card = document.getElementById('yearForecastCard');
    const value = document.getElementById('yearForecast')?.textContent?.trim() || '';
    return {
      calc,
      value,
      visible:!!card && getComputedStyle(card).display !== 'none',
      label:/predicted this year/i.test(card?.innerText || ''),
      fields:document.querySelectorAll('input,textarea,select').length,
      firestoreExposed:!!window.FirestoreDB,
      firebaseUserExposed:!!window.FirebaseUser
    };
  });

  if (!result.visible) throw new Error('Year forecast card is not visible');
  if (!result.label) throw new Error('Year forecast card label is missing');
  if (Number(result.value) !== result.calc.predictedYear) throw new Error(`Year forecast UI mismatch ${result.value} != ${result.calc.predictedYear}`);
  if (result.calc.predictedYear < result.calc.yearCollected) throw new Error('Year forecast fell below actual year-to-date collections');
  if (result.calc.yearCollected <= 0) throw new Error('Year forecast did not include real year-to-date egg collections');
  if (result.fields !== 0) throw new Error('Customer page gained editable fields');
  if (result.firestoreExposed || result.firebaseUserExposed) throw new Error('Customer page exposed private Firebase handles');
  const serious=[...errors,...customerErrors].filter(x=>!/favicon|ResizeObserver/i.test(x));
  if (serious.length) throw new Error(`Browser errors: ${serious.slice(0,4).join(' | ')}`);

  console.log(`PASS Customer yearly forecast browser E2E — ${result.calc.yearCollected} collected YTD; ${result.calc.predictedYear} predicted for ${result.calc.year}`);
  await customer.close();
} finally {
  await browser.close();
}
