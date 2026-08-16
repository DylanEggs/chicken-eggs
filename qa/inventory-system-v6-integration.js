const assert = require('assert');
const path = require('path');

class FakeStorage {
  constructor() { this.map = new Map(); this.limit = Infinity; }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
  bytesWith(key, value) {
    const next = new Map(this.map);
    next.set(String(key), String(value));
    let total = 0;
    for (const [k,v] of next) total += (String(k).length + String(v).length) * 2;
    return total;
  }
  currentBytes() {
    let total = 0;
    for (const [k,v] of this.map) total += (String(k).length + String(v).length) * 2;
    return total;
  }
  setItem(key, value) {
    if (this.bytesWith(key, value) > this.limit) {
      const error = new Error(`Setting the value of '${String(key)}' exceeded the quota.`);
      error.name = 'QuotaExceededError';
      error.code = 22;
      throw error;
    }
    this.map.set(String(key), String(value));
  }
  removeItem(key) { this.map.delete(String(key)); }
  clear() { this.map.clear(); }
}

global.Storage = FakeStorage;
global.localStorage = new FakeStorage();
global.window = global;
global.navigator = { onLine:true };
global.CustomEvent = class CustomEvent { constructor(type, init={}) { this.type=type; this.detail=init.detail; } };
global.requestAnimationFrame = () => 0;
global.document = {
  readyState:'loading',
  addEventListener() {},
  getElementById() { return null; },
  querySelector() { return null; },
  createElement() { return { style:{}, appendChild() {}, addEventListener() {}, querySelectorAll(){return [];} }; },
  head:{ appendChild(){} },
  body:{ appendChild(){} }
};
global.addEventListener = () => {};
global.dispatchEvent = () => true;

const KEY = 'chickenEggInventoryV2';
const APP2 = 'chickenEggApp2V1';
const ENTRIES = 'chickenEggEntriesV102';
const PHOTO_CACHE = 'chickenEggLocalBirdPhotosV1';
const PHOTO_META = 'chickenEggBirdPhotoMetaV4';

// Seed the exact broken inventory shape seen in production.
localStorage.setItem(KEY, JSON.stringify({
  version:4, dozens:0, packs18:4, loose:8,
  adjustments:[], recoveryMarkers:{}, updatedAt:1
}));
localStorage.setItem(APP2, JSON.stringify({orders:[]}));
localStorage.setItem(ENTRIES, JSON.stringify([]));

// Deliberately fill localStorage with photo cache. One photo is verified in
// Firebase and is safe to reclaim. The second is local-only and MUST survive.
const verifiedPhoto = 'data:image/jpeg;base64,' + 'A'.repeat(9000);
const localOnlyPhoto = 'data:image/jpeg;base64,' + 'B'.repeat(500);
localStorage.setItem(PHOTO_CACHE, JSON.stringify({ verified:verifiedPhoto, localOnly:localOnlyPhoto }));
localStorage.setItem(PHOTO_META, JSON.stringify({
  verified:{updatedAt:10,deleted:false,sourceRank:4},
  localOnly:{updatedAt:20,deleted:false,sourceRank:4}
}));

global.FarmBirdPhotoRecoveryV2 = {
  stats:() => ({ initialScanDone:true, cloudActive:1 }),
  getCloudRecord:id => id === 'verified'
    ? { birdId:'verified', dataUrl:verifiedPhoto, deleted:false, updatedAt:10, sourceRank:4 }
    : null
};

// Match production today: InventorySystemV6 falls back to syncFarmNow because
// Firebase Safe v9 does not expose a dedicated saveInventoryNow method.
let syncCalls = 0;
global.FarmSyncSafety = { ready: async () => true };
global.syncFarmNow = async () => { syncCalls += 1; return true; };

// Leave almost no free localStorage. The first exact inventory save must hit
// QuotaExceededError, reclaim only verified cache, then retry successfully.
localStorage.limit = localStorage.currentBytes() + 120;

require(path.join(__dirname, '..', 'storage-health-v1.js'));
require(path.join(__dirname, '..', 'inventory-system-v6.js'));
assert.ok(global.FarmStorageHealth, 'FarmStorageHealth did not load');
assert.ok(global.InventorySystemV6, 'InventorySystemV6 did not load');

const read = () => JSON.parse(localStorage.getItem(KEY));
const shape = () => {
  const s=read(); return {dozens:s.dozens,packs18:s.packs18,loose:s.loose,total:s.dozens*12+s.packs18*18+s.loose};
};

(async () => {
  // 1) Exact same-total carton edit must stick despite full localStorage.
  await InventorySystemV6.commitExact(3,2,8);
  assert.deepStrictEqual(shape(), {dozens:3,packs18:2,loose:8,total:80});
  const remainingPhotos = JSON.parse(localStorage.getItem(PHOTO_CACHE) || '{}');
  assert.ok(!remainingPhotos.verified, 'Verified Firebase photo cache was not reclaimed');
  assert.strictEqual(remainingPhotos.localOnly, localOnlyPhoto, 'Local-only photo was incorrectly discarded');

  // Give later operations normal room; quota recovery itself was proven above.
  localStorage.limit = Infinity;

  // 2) An obsolete writer must not be able to put the old 4-pack shape back.
  localStorage.setItem(KEY, JSON.stringify({dozens:0,packs18:4,loose:8,updatedAt:999999}));
  assert.deepStrictEqual(shape(), {dozens:3,packs18:2,loose:8,total:80});

  // 3) A 14-egg collection adds to loose, not cartons.
  const egg = {id:'egg-14',type:'eggs',eggs:14,date:'2026-08-16',createdAt:10,updatedAt:10};
  await InventorySystemV6.applyEntryDiff([], [egg], 'Egg collection test');
  assert.deepStrictEqual(shape(), {dozens:3,packs18:2,loose:22,total:94});

  // 4) Selling one dozen removes a dozen carton first and leaves 18-packs alone.
  const saleDoz = {id:'sale-doz',type:'sale',dozenSold:1,packSold:0,date:'2026-08-16',createdAt:11,updatedAt:11};
  await InventorySystemV6.applyEntryDiff([egg], [egg,saleDoz], 'Dozen sale test');
  assert.deepStrictEqual(shape(), {dozens:2,packs18:2,loose:22,total:82});

  // 5) Selling one 18-pack removes one actual 18-pack.
  const sale18 = {id:'sale-18',type:'sale',dozenSold:0,packSold:1,date:'2026-08-16',createdAt:12,updatedAt:12};
  await InventorySystemV6.applyEntryDiff([egg,saleDoz], [egg,saleDoz,sale18], '18-pack sale test');
  assert.deepStrictEqual(shape(), {dozens:2,packs18:1,loose:22,total:64});

  // 6) Deleting that 18-pack sale restores exactly one 18-pack.
  await InventorySystemV6.applyEntryDiff([egg,saleDoz,sale18], [egg,saleDoz], 'Delete sale test');
  assert.deepStrictEqual(shape(), {dozens:2,packs18:2,loose:22,total:82});

  assert.ok(syncCalls >= 5, `Expected production syncFarmNow calls, saw ${syncCalls}`);
  console.log('PASS InventorySystemV6 integration: full-storage recovery, exact edit, local-only photo preservation, stale-write block, collection, dozen sale, 18-pack sale, deletion restore, production sync fallback');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
