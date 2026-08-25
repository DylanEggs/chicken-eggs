const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const expectedBuild = JSON.parse(fs.readFileSync(path.join(root, 'app-build.json'), 'utf8')).build;
const app2 = fs.readFileSync(path.join(root, 'app2.js'), 'utf8');
const who = fs.readFileSync(path.join(root, 'who-owes.js'), 'utf8');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function requireCheck(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

function checkSources(a, w, prefix = '') {
  requireCheck(a.includes('load("who-owes.js")'), `${prefix}Who Owes is loaded by the active app`);
  requireCheck(w.includes('__whoOwesV2'), `${prefix}Who Owes v2 guard is present`);
  requireCheck(w.includes('id = "whoOwesCard"') || w.includes('id="whoOwesCard"'), `${prefix}Who Owes Home card is present`);
  requireCheck(w.includes('meta[entry.id]?.paid === false'), `${prefix}Who Owes reads unpaid sale metadata`);
  requireCheck(w.includes('customer?.name || "Customer"'), `${prefix}Who Owes resolves customer names`);
  requireCheck(w.includes('farm.saleMeta[id] = { ...existing, paid:true'), `${prefix}Mark Paid changes only payment metadata`);
  requireCheck(!w.includes('window.saveSale()'), `${prefix}Mark Paid does not resave the egg sale`);
  requireCheck(!w.includes('setInterval('), `${prefix}Who Owes has no polling loop`);
  requireCheck(w.includes('farm-data-synced') && w.includes('core-data-synced'), `${prefix}Who Owes refreshes from sync events`);
}

checkSources(app2, who);

async function fetchText(file) {
  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const join = file.includes('?') ? '&' : '?';
      const response = await fetch(`https://dylaneggs.github.io/chicken-eggs/${file}${join}qa=${Date.now()}-${Math.random().toString(36).slice(2)}`, {
        cache: 'no-store',
        headers: { 'cache-control':'no-cache' }
      });
      if (response.ok) return response.text();
      lastError = new Error(`${file} returned HTTP ${response.status}`);
      if (response.status < 500) break;
    } catch (error) {
      lastError = error;
    }
    await sleep(1000 * attempt);
  }
  throw lastError || new Error(`${file} could not be loaded`);
}

(async () => {
  const manifest = JSON.parse(await fetchText('app-build.json'));
  requireCheck(manifest.build === expectedBuild, `Live build is ${expectedBuild}`);
  const [liveApp2, liveWho] = await Promise.all([fetchText('app2.js'), fetchText('who-owes.js')]);
  checkSources(liveApp2, liveWho, 'Live ');
  console.log(`PASS Who Owes regression test — build ${expectedBuild}`);
})().catch(error => {
  console.error('WHO OWES TEST FAILED:', error);
  process.exit(1);
});
