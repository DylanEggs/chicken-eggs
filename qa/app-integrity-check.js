const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const passes = [];
function check(name, condition, detail = '') {
  if (condition) passes.push(name);
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

const build = JSON.parse(read('app-build.json')).build;
const index = read('index.html');
const app2 = read('app2.js');
const firebase = read('firebase.js');
const firebaseSafe = read('firebase-safe-v9.js');
const inventory = read('inventory-system-v6.js');
const legacyInventory = read('inventory.js');
const inventoryUi = read('inventory-ui.js');
const consistency = read('farm-consistency-v2.js');
const photoCompat = read('flock-photo-fix-v2.js');
const legacyLoader = read('app2-legacy-safe-loader-v1.js');
const auditFinish = read('audit-finish-v1.js');

check('Build manifest is valid', /^\d{8}-\d+$/.test(build), build);
check('Index fallback matches manifest', index.includes(`FALLBACK_BUILD = "${build}"`), build);
check('App2 fallback matches manifest', app2.includes(`window.__ChickenEggsBuild || "${build}"`), build);
check('Firebase fallback matches manifest', firebase.includes(`window.__ChickenEggsBuild || "${build}"`), build);

check('App2 loads InventorySystemV6', app2.includes('load("inventory-system-v6.js")'));
const retiredFiles = {
  'core-inventory-authority-v1.js':'__coreInventoryAuthorityV1Retired',
  'core-inventory-authority-v2.js':'__coreInventoryAuthorityV2Retired',
  'core-inventory-authority-v3.js':'__coreInventoryAuthorityV3Retired',
  'core-action-inventory-bridge-v1.js':'__coreActionInventoryBridgeV1Retired',
  'inventory-missed-entry-repair-v1.js':'__inventoryMissedEntryRepairV1Retired',
  'inventory-editor-v2.js':'__inventoryEditorV2Retired',
  'inventory-packaging-display-v1.js':'__inventoryPackagingDisplayV1Retired',
  'inventory-packaging-display-v2.js':'__inventoryPackagingDisplayV2Retired',
  'inventory-guard-loader-v2.js':'__inventoryGuardLoaderV2Retired',
  'data-integrity-v1.js':'__farmDataIntegrityV1Retired'
};
for (const [obsolete, marker] of Object.entries(retiredFiles)) {
  check(`App2 does not load obsolete ${obsolete}`, !app2.includes(`load("${obsolete}")`));
  const source = read(obsolete);
  check(`Obsolete ${obsolete} is harmless if a stale cache requests it`, source.includes(marker) && source.length < 800, `size=${source.length}`);
}
check('App2 does not start a second Firebase authority', !app2.includes('load("firebase-safe-v9.js"'));

check('Legacy inventory.js is retired', legacyInventory.includes('__legacyInventoryRuntimeRetired = true'));
check('Legacy inventory.js cannot write inventory', !legacyInventory.includes('chickenEggInventoryV2'));
check('Old farm-consistency repacker is retired', consistency.includes('__farmConsistencyV2Retired = true'));
check('Old farm-consistency repack math is gone', !consistency.includes('Math.floor(total / 18)') && !consistency.includes('setPhysicalTotal'));
check('Duplicate flock-photo loader is retired', photoCompat.includes('__flockPhotoFixV2Retired = true'));
check('Inventory UI wrapper itself is retired', inventoryUi.includes('__inventoryUiCompatibilityV6Retired = true'));
check('Inventory UI compatibility does not own inventory', !inventoryUi.includes('chickenEggInventoryV2'));
check('Inventory UI compatibility has no child imports', !inventoryUi.includes('import('));
check('Inventory UI compatibility does not patch Storage', !inventoryUi.includes('Storage.prototype'));
check('Golden Egg random branch is stripped in legacy loader', legacyLoader.includes('Golden Egg branch was not removed') && legacyLoader.includes('Golden Egg feature retired'));

check('InventorySystemV6 installs one-writer firewall', inventory.includes('Blocked obsolete direct inventory writer'));
check('InventorySystemV6 preserves carton fields', inventory.includes('dozens') && inventory.includes('packs18') && inventory.includes('loose'));
check('InventorySystemV6 adds collections to loose eggs', inventory.includes('addLooseTo(s, eggDelta)'));
check('InventorySystemV6 removes dozen cartons first', inventory.includes('removeDozensFrom(s, dozDelta)'));
check('InventorySystemV6 removes 18-packs first', inventory.includes('removePacksFrom(s, packDelta)'));
check('InventorySystemV6 exact editor uses isolated IDs', inventory.includes('id="inv6Dozens"') && inventory.includes('id="inv6Packs"') && inventory.includes('id="inv6Loose"'));
check('InventorySystemV6 has known 80-egg carton repair', inventory.includes('whole(s.dozens)===0') && inventory.includes('whole(s.packs18)===4') && inventory.includes('whole(s.loose)===8') && inventory.includes('s.dozens=3; s.packs18=2; s.loose=8'));
check('InventorySystemV6 has startup self-test', inventory.includes('runPureSelfTest'));
check('Backup restore routes inventory through InventorySystemV6', auditFinish.includes('InventorySystemV6?.replaceFromRestore') && auditFinish.includes('restoreInventory(data.inventoryV2'));
check('Backup format is current v8', auditFinish.includes('chicken-eggs-full-backup-v8'));

check('Firebase entrypoint starts only protected sync engine', (firebase.match(/await import/g) || []).length === 1 && firebase.includes('firebase-safe-v9.js'));
check('Firebase inventory sync merges carton scalar fields', firebaseSafe.includes('ds.kind === "inventory"') && firebaseSafe.includes('applyScalarDelta(base, local, remote, new Set(["adjustments"]))'));
check('Firebase inventory sync contains no 18-pack repacker', !firebaseSafe.includes('Math.floor(total / 18)') && !firebaseSafe.includes('setPhysicalTotal'));
check('Firebase local write hook marks datasets dirty', firebaseSafe.includes('dirty.add(ds.key)') && firebaseSafe.includes('scheduleDatasetSync(ds)'));

console.log(`\nChicken Eggs integrity audit — build ${build}`);
for (const p of passes) console.log(`PASS  ${p}`);
if (failures.length) {
  console.error('\nFAILURES:');
  for (const f of failures) console.error(`FAIL  ${f}`);
  process.exit(1);
}
console.log(`\nAll ${passes.length} integrity checks passed.`);
