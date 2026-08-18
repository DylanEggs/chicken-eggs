import { chromium } from 'playwright';
import fs from 'node:fs';

const expected = JSON.parse(fs.readFileSync(new URL('../staging/staging-build.json', import.meta.url), 'utf8')).build;
const base = 'https://dylaneggs.github.io/chicken-eggs/staging/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForDeploy() {
  for (let i = 1; i <= 60; i++) {
    try {
      const r = await fetch(`${base}staging-build.json?e2e=${Date.now()}-${i}`, { cache:'no-store' });
      if (r.ok) {
        const live = (await r.json()).build || '';
        if (live === expected) return;
        console.log(`E2E waiting for staging deploy: live=${live} expected=${expected} ${i}/60`);
      } else console.log(`E2E staging marker HTTP ${r.status} ${i}/60`);
    } catch (error) {
      console.log(`E2E staging marker waiting: ${error.message} ${i}/60`);
    }
    await sleep(5000);
  }
  throw new Error(`Staging deployment ${expected} was not visible in time`);
}

await waitForDeploy();
const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({
  viewport:{ width:390, height:844 },
  locale:'en-US',
  timezoneId:'America/New_York'
});
const page = await context.newPage();
const errors=[];
page.on('console', msg => {
  const text=msg.text();
  console.log(`[browser ${msg.type()}] ${text}`);
  if (msg.type()==='error') errors.push(text);
});
page.on('pageerror', error => {
  console.error('[browser pageerror]', error.message);
  errors.push(error.message);
});

try {
  await page.goto(`${base}?e2e=${Date.now()}`, { waitUntil:'domcontentloaded', timeout:120000 });
  await page.waitForFunction(() => window.__ChickenEggsEnvironment === 'staging', null, { timeout:30000 });
  await page.waitForFunction(() => window.StagingSandbox && window.StagingFullTest && window.StagingBackupTest, null, { timeout:30000 });
  await page.evaluate(() => window.FarmSyncSafety.ready());
  await page.waitForFunction(() => window.FarmSyncSafety?.isReady?.() === true, null, { timeout:30000 });

  const safety = await page.evaluate(() => ({
    environment: window.__ChickenEggsEnvironment,
    readOnly: window.__STAGING_FIREBASE_READONLY__,
    firestoreExposed: !!window.FirestoreDB,
    firebaseUserExposed: !!window.FirebaseUser,
    storage: window.StagingStorageSandbox?.diagnostics?.(),
    seed: window.StagingSandbox?.seedInfo?.()
  }));
  console.log('STAGING SAFETY', JSON.stringify(safety));
  if (safety.environment !== 'staging') throw new Error('Browser did not enter staging environment');
  if (safety.readOnly !== true) throw new Error('Staging Firebase is not read-only');
  if (safety.firestoreExposed || safety.firebaseUserExposed) throw new Error('Live Firebase handles are exposed inside staging');
  if (!safety.seed?.completed) throw new Error('Read-only live snapshot did not seed staging');

  const full = await page.evaluate(() => window.StagingFullTest.run());
  console.log(`FULL SANDBOX RESULT ${full.passed}/${full.total} passed`);
  for (const row of full.results || []) console.log(`${row.pass?'PASS':'FAIL'} ${row.name}${row.detail?` — ${row.detail}`:''}`);
  if (full.failed) throw new Error(`Full sandbox test failed ${full.failed} of ${full.total} checks`);

  const backup = await page.evaluate(() => window.StagingBackupTest.run());
  console.log(`BACKUP RESTORE RESULT ${backup.passed}/${backup.total} passed`);
  for (const row of backup.results || []) console.log(`${row.pass?'PASS':'FAIL'} ${row.name}${row.detail?` — ${row.detail}`:''}`);
  if (backup.failed) throw new Error(`Backup/restore test failed ${backup.failed} of ${backup.total} checks`);

  const after = await page.evaluate(() => ({
    firestoreExposed:!!window.FirestoreDB,
    firebaseUserExposed:!!window.FirebaseUser,
    environment:window.__ChickenEggsEnvironment,
    full:window.StagingFullTest.last(),
    backup:window.StagingBackupTest.last()
  }));
  if (after.firestoreExposed || after.firebaseUserExposed) throw new Error('A staging test exposed live Firebase handles');
  if (after.environment !== 'staging') throw new Error('Staging environment marker changed during tests');

  const seriousErrors = errors.filter(x => !/favicon|ResizeObserver/i.test(x));
  if (seriousErrors.length) throw new Error(`Browser console/page errors: ${seriousErrors.slice(0,5).join(' | ')}`);

  console.log(`PASS Real browser staging E2E — ${expected}; full workflows and backup/restore passed with live Firestore write handles unavailable`);
} finally {
  await browser.close();
}
