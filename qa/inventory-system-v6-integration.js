const assert = require('assert');
const path = require('path');

class FakeStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
  setItem(key, value) { this.map.set(String(key), String(value)); }
  removeItem(key) { this.map.delete(String(key)); }
  clear() { this.map.clear(); }
}

global.Storage = FakeStorage;
global.localStorage = new FakeStorage();
global.window = global;
global.navigator = { onLine:true };
global.CustomEvent = class CustomEvent { constructor(type, init={}) { this.type=type; this.detail=init.detail; } };
global.requestAnimationFrame = () => 0; // Keep UI rendering out of this data-path test.
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

// Seed the exact broken state from the user's diagnostic before loading authority.
localStorage.setItem(KEY, JSON.stringify({
  version:4, dozens:0, packs18:4, loose:8,
  adjustments:[], recoveryMarkers:{}, updatedAt:1
}));
localStorage.setItem(APP2, JSON.stringify({orders:[]}));
localStorage.setItem(ENTRIES, JSON.stringify([]));

let cloudSaves = 0;
global.FarmSyncSafety = {
  saveInventoryNow: async () => { cloudSaves += 1; return true; },
  ready: async () => true
};

require(path.join(__dirname, '..', 'inventory-system-v6.js'));
assert.ok(global.InventorySystemV6, 'InventorySystemV6 did not load');

const read = () => JSON.parse(localStorage.getItem(KEY));
const shape = () => {
  const s=read(); return {dozens:s.dozens,packs18:s.packs18,loose:s.loose,total:s.dozens*12+s.packs18*18+s.loose};
};

(async () => {
  // 1) Exact same-total carton edit must stick: 0d/4x18/8 -> 3d/2x18/8 = 80.
  await InventorySystemV6.commitExact(3,2,8);
  assert.deepStrictEqual(shape(), {dozens:3,packs18:2,loose:8,total:80});

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

  assert.ok(cloudSaves >= 5, `Expected cloud-save verification calls, saw ${cloudSaves}`);
  console.log('PASS InventorySystemV6 integration: exact edit, stale-write block, collection, dozen sale, 18-pack sale, deletion restore');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
