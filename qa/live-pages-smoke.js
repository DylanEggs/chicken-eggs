const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const expectedBuild = JSON.parse(fs.readFileSync(path.join(root, 'app-build.json'), 'utf8')).build;
const base = 'https://dylaneggs.github.io/chicken-eggs/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchText(file) {
  const join = file.includes('?') ? '&' : '?';
  const url = `${base}${file}${join}qa=${Date.now()}`;
  const response = await fetch(url, { cache:'no-store', headers:{'cache-control':'no-cache'} });
  if (!response.ok) throw new Error(`${file} returned HTTP ${response.status}`);
  return response.text();
}

(async () => {
  let liveBuild = '';
  for (let attempt = 1; attempt <= 36; attempt++) {
    try {
      const raw = await fetchText('app-build.json');
      liveBuild = JSON.parse(raw).build || '';
      if (liveBuild === expectedBuild) break;
      console.log(`Waiting for Pages deployment: live=${liveBuild || 'unknown'} expected=${expectedBuild} attempt=${attempt}/36`);
    } catch (error) {
      console.log(`Waiting for Pages deployment: ${error.message} attempt=${attempt}/36`);
    }
    await sleep(5000);
  }
  if (liveBuild !== expectedBuild) throw new Error(`GitHub Pages never reached expected build ${expectedBuild}; live=${liveBuild}`);

  const assets = [
    'index.html',
    'app-shell-v1.html',
    'script.js',
    'app2.js',
    'firebase.js',
    'firebase-safe-v9.js',
    'inventory-system-v6.js',
    'inventory.js',
    'inventory-ui.js',
    'farm-consistency-v2.js',
    'app2-legacy-safe-loader-v1.js',
    'app-audit-v1.js',
    'app-audit-safe-loader-v1.js',
    'app2-stable-runtime-v1.js',
    'bird-photo-service-v4.js',
    'bird-photo-recovery-v2.js',
    'flock-manager-v7.js',
    'farm-diagnostics-v1.js',
    'app-self-test-v1.js'
  ];
  const loaded = {};
  for (const asset of assets) {
    loaded[asset] = await fetchText(asset);
    if (!loaded[asset].trim()) throw new Error(`${asset} deployed empty`);
    console.log(`LIVE 200 ${asset} (${loaded[asset].length} bytes)`);
  }

  if (!loaded['app2.js'].includes('load("inventory-system-v6.js")')) throw new Error('Live app2.js is missing InventorySystemV6');
  if (loaded['app2.js'].includes('load("core-inventory-authority-v3.js")')) throw new Error('Live app2.js still loads old inventory authority');
  if (!loaded['inventory.js'].includes('__legacyInventoryRuntimeRetired = true')) throw new Error('Live legacy inventory.js is not retired');
  if (!loaded['farm-consistency-v2.js'].includes('__farmConsistencyV2Retired = true')) throw new Error('Live farm-consistency repacker is not retired');
  if (!loaded['inventory-system-v6.js'].includes('Blocked obsolete direct inventory writer')) throw new Error('Live inventory firewall is missing');
  if (!loaded['inventory-system-v6.js'].includes('s.dozens=3; s.packs18=2; s.loose=8')) throw new Error('Live confirmed carton repair is missing');
  if ((loaded['firebase.js'].match(/await import/g) || []).length !== 1) throw new Error('Live firebase entrypoint has duplicate imports');
  if (!loaded['index.html'].includes(`FALLBACK_BUILD = "${expectedBuild}"`)) throw new Error('Live index fallback build mismatch');

  console.log(`PASS Live GitHub Pages smoke test — build ${expectedBuild}, ${assets.length} deployed assets verified`);
})().catch(error => {
  console.error('LIVE SMOKE TEST FAILED:', error);
  process.exit(1);
});
