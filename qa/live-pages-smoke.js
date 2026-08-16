const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const expectedBuild = JSON.parse(fs.readFileSync(path.join(root, 'app-build.json'), 'utf8')).build;
const base = 'https://dylaneggs.github.io/chicken-eggs/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchText(file) {
  const join = file.includes('?') ? '&' : '?';
  const url = `${base}${file}${join}qa=${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const response = await fetch(url, { cache:'no-store', headers:{'cache-control':'no-cache'} });
  if (!response.ok) throw new Error(`${file} returned HTTP ${response.status}`);
  return response.text();
}

async function coherentBuild() {
  const [manifestRaw, index, app2, firebase] = await Promise.all([
    fetchText('app-build.json'),
    fetchText('index.html'),
    fetchText('app2.js'),
    fetchText('firebase.js')
  ]);
  const liveBuild = JSON.parse(manifestRaw).build || '';
  return {
    liveBuild,
    ready:
      liveBuild === expectedBuild &&
      index.includes(`FALLBACK_BUILD = "${expectedBuild}"`) &&
      app2.includes(`window.__ChickenEggsBuild || "${expectedBuild}"`) &&
      firebase.includes(`window.__ChickenEggsBuild || "${expectedBuild}"`)
  };
}

(async () => {
  let status = { liveBuild:'', ready:false };
  for (let attempt = 1; attempt <= 48; attempt++) {
    try {
      status = await coherentBuild();
      if (status.ready) break;
      console.log(`Waiting for coherent Pages deployment: live=${status.liveBuild || 'unknown'} expected=${expectedBuild} attempt=${attempt}/48`);
    } catch (error) {
      console.log(`Waiting for coherent Pages deployment: ${error.message} attempt=${attempt}/48`);
    }
    await sleep(5000);
  }
  if (!status.ready) throw new Error(`GitHub Pages never became coherent for build ${expectedBuild}; manifest=${status.liveBuild}`);

  const assets = [
    'index.html',
    'app-shell-v1.html',
    'script.js',
    'app2.js',
    'firebase.js',
    'firebase-safe-v9.js',
    'storage-health-v1.js',
    'inventory-system-v6.js',
    'business-lifetime-v1.js',
    'inventory.js',
    'inventory-ui.js',
    'farm-consistency-v2.js',
    'core-inventory-authority-v1.js',
    'core-inventory-authority-v2.js',
    'core-inventory-authority-v3.js',
    'core-action-inventory-bridge-v1.js',
    'inventory-missed-entry-repair-v1.js',
    'inventory-editor-v2.js',
    'inventory-packaging-display-v1.js',
    'inventory-packaging-display-v2.js',
    'inventory-guard-loader-v2.js',
    'data-integrity-v1.js',
    'app2-legacy-safe-loader-v1.js',
    'app-audit-v1.js',
    'app-audit-safe-loader-v1.js',
    'audit-finish-v1.js',
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

  if (!loaded['app2.js'].includes('load("storage-health-v1.js")')) throw new Error('Live app2.js is missing storage quota protection');
  if (loaded['app2.js'].indexOf('load("storage-health-v1.js")') > loaded['app2.js'].indexOf('load("inventory-system-v6.js")')) throw new Error('Live storage protection loads too late');
  if (!loaded['storage-health-v1.js'].includes('Browser storage full during critical farm save')) throw new Error('Live storage quota retry is missing');
  if (!loaded['storage-health-v1.js'].includes('cloudSafelyOwns')) throw new Error('Live storage cleanup does not verify Firebase photo ownership');
  if (!loaded['app2.js'].includes('load("business-lifetime-v1.js")')) throw new Error('Live app2.js is missing lifetime financial stats');
  if (!loaded['business-lifetime-v1.js'].includes('statsLifetimeProfit') || !loaded['business-lifetime-v1.js'].includes('document.getElementById("statsTotals")')) throw new Error('Live lifetime financial card is not on Statistics');
  if (loaded['business-lifetime-v1.js'].includes('bizLifetimeHome')) throw new Error('Live lifetime financial card still targets Home');
  if (!loaded['business-lifetime-v1.js'].includes('net: revenue - costs')) throw new Error('Live lifetime profit/loss calculation is missing');
  if (loaded['business-lifetime-v1.js'].includes('MutationObserver') || loaded['business-lifetime-v1.js'].includes('setInterval(')) throw new Error('Live lifetime financials use obsolete polling/observer rendering');
  if (!loaded['app2.js'].includes('load("inventory-system-v6.js")')) throw new Error('Live app2.js is missing InventorySystemV6');
  if (loaded['app2.js'].includes('load("core-inventory-authority-v3.js")')) throw new Error('Live app2.js still loads old inventory authority');
  if (!loaded['inventory.js'].includes('__legacyInventoryRuntimeRetired = true')) throw new Error('Live legacy inventory.js is not retired');
  if (!loaded['inventory-ui.js'].includes('__inventoryUiCompatibilityV6Retired = true')) throw new Error('Live inventory-ui compatibility wrapper is not retired');
  if (!loaded['farm-consistency-v2.js'].includes('__farmConsistencyV2Retired = true')) throw new Error('Live farm-consistency repacker is not retired');
  if (!loaded['core-inventory-authority-v1.js'].includes('__coreInventoryAuthorityV1Retired')) throw new Error('Live old inventory v1 authority is not retired');
  if (!loaded['core-inventory-authority-v2.js'].includes('__coreInventoryAuthorityV2Retired')) throw new Error('Live old inventory v2 authority is not retired');
  if (!loaded['core-inventory-authority-v3.js'].includes('__coreInventoryAuthorityV3Retired')) throw new Error('Live old inventory v3 authority is not retired');
  if (!loaded['core-action-inventory-bridge-v1.js'].includes('__coreActionInventoryBridgeV1Retired')) throw new Error('Live old inventory action bridge is not retired');
  if (!loaded['inventory-editor-v2.js'].includes('__inventoryEditorV2Retired')) throw new Error('Live old inventory editor is not retired');
  if (!loaded['inventory-system-v6.js'].includes('Blocked obsolete direct inventory writer')) throw new Error('Live inventory firewall is missing');
  if (!loaded['inventory-system-v6.js'].includes('s.dozens=3; s.packs18=2; s.loose=8')) throw new Error('Live confirmed carton repair is missing');
  if (!loaded['audit-finish-v1.js'].includes('InventorySystemV6?.replaceFromRestore')) throw new Error('Live backup restore is not routed through InventorySystemV6');
  if ((loaded['firebase.js'].match(/await import/g) || []).length !== 1) throw new Error('Live firebase entrypoint has duplicate imports');
  if (!loaded['index.html'].includes(`FALLBACK_BUILD = "${expectedBuild}"`)) throw new Error('Live index fallback build mismatch');

  console.log(`PASS Live GitHub Pages smoke test — coherent build ${expectedBuild}, ${assets.length} deployed assets verified`);
})().catch(error => {
  console.error('LIVE SMOKE TEST FAILED:', error);
  process.exit(1);
});
