(() => {
  "use strict";
  if (window.__StagingReservationRegressionV2) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingReservationRegressionV2 = true;

  const ENTRIES = "chickenEggEntriesV102";
  const APP2 = "chickenEggApp2V1";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const n = v => Number(v) || 0;
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const inv = () => window.InventorySystemV6?.state?.() || {};
  const total = s => n(s?.dozens) * 12 + n(s?.packs18) * 18 + n(s?.loose);
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };

  function snapshot() {
    const out = {};
    for (const key of window.StagingStorageSandbox?.listKeys?.() || []) {
      const value = localStorage.getItem(key);
      if (value !== null) out[key] = value;
    }
    return out;
  }

  function restore(snap) {
    const old = window.__farmApplyingRemote;
    window.__farmApplyingRemote = true;
    try {
      localStorage.clear();
      for (const [key, value] of Object.entries(snap || {})) localStorage.setItem(key, value);
    } finally { window.__farmApplyingRemote = old; }
    try { window.loadLocal?.(); } catch {}
    try { window.loadFarmSettings?.(); } catch {}
    try { window.__reloadFarm2Memory?.(); } catch {}
    try { window.updateApp?.(); } catch {}
    window.dispatchEvent(new CustomEvent("core-data-synced", { detail:{ staging:true, reservationV2Restore:true } }));
    window.dispatchEvent(new CustomEvent("farm-data-synced", { detail:{ staging:true, reservationV2Restore:true } }));
  }

  async function waitFor(fn, timeout = 3500) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try { if (fn()) return true; } catch {}
      await sleep(50);
    }
    return false;
  }

  function set(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = String(value);
  }

  function rows() { return read(ENTRIES, []); }
  function newRow(before, after) {
    const ids = new Set((before || []).map(x => String(x?.id || "")));
    return (after || []).find(x => x?.id && !ids.has(String(x.id))) || null;
  }

  async function saveSale(dozens, packs, note) {
    const before = rows();
    set("saleDate", today());
    set("dozenSold", dozens);
    set("dozenPrice", 5);
    set("packSold", packs);
    set("packPrice", 8);
    set("farm2SaleCustomer", "");
    set("farm2SalePaid", "paid");
    set("farm2SaleNote", note || "Reservation regression");
    window.saveSale?.();
    await waitFor(() => rows().length !== before.length, 1200);
    return { before, after:rows(), sale:newRow(before, rows()) };
  }

  async function runReservationRegression() {
    const checks = [];
    const check = (name, pass, detail = "") => checks.push({ name, pass:!!pass, detail:String(detail || "") });
    const snap = snapshot();
    const oldAlert = window.alert;
    const oldConfirm = window.confirm;
    let alerts = [];
    window.alert = m => alerts.push(String(m || ""));
    window.confirm = () => true;

    try {
      let app = read(APP2, {});
      app.orders = [];
      localStorage.setItem(APP2, JSON.stringify(app));
      try { window.__reloadFarm2Memory?.(); } catch {}

      await window.InventorySystemV6?.commitExact?.(2, 0, 0);
      await waitFor(() => total(inv()) === 24);

      app = read(APP2, {});
      app.orders = [{ id:"reservation-v2", status:"pending", dozen:1, packs18:0, date:today() }];
      localStorage.setItem(APP2, JSON.stringify(app));
      try { window.__reloadFarm2Memory?.(); } catch {}
      window.dispatchEvent(new CustomEvent("farm-local-data-changed", { detail:{ key:APP2, staging:true, reservationV2:true } }));
      await waitFor(() => n(window.InventorySystemV6?.reservations?.()) === 12 && n(window.InventorySystemV6?.available?.()) === 12);

      alerts = [];
      const beforeBlocked = rows().length;
      await saveSale(2, 0, "Reservation v2 blocked oversell");
      await sleep(120);
      check(
        "Sale cannot consume eggs reserved for pending order",
        rows().length === beforeBlocked && total(inv()) === 24 && n(window.InventorySystemV6?.available?.()) === 12,
        JSON.stringify({ inventory:inv(), available:window.InventorySystemV6?.available?.(), alerts })
      );

      const allowed = await saveSale(1, 0, "Reservation v2 allowed sale");
      const allowedSettled = await waitFor(() => !!allowed.sale && total(inv()) === 12 && n(window.InventorySystemV6?.available?.()) === 0);
      check(
        "Sale can use only the unreserved dozen",
        allowedSettled,
        JSON.stringify({ sale:allowed.sale, inventory:inv(), available:window.InventorySystemV6?.available?.() })
      );

      if (allowed.sale) {
        window.deleteEntry?.(allowed.sale.id);
        const restored = await waitFor(() => total(inv()) === 24 && n(window.InventorySystemV6?.available?.()) === 12 && !rows().some(x => String(x?.id || "") === String(allowed.sale.id)));
        check(
          "Deleting reservation-safe sale restores available dozen",
          restored,
          JSON.stringify({ inventory:inv(), available:window.InventorySystemV6?.available?.() })
        );
      } else {
        check("Deleting reservation-safe sale restores available dozen", false, "Allowed sale row was not created");
      }

      app = read(APP2, {});
      app.orders = [];
      localStorage.setItem(APP2, JSON.stringify(app));
      try { window.__reloadFarm2Memory?.(); } catch {}
      window.dispatchEvent(new CustomEvent("farm-local-data-changed", { detail:{ key:APP2, staging:true, reservationV2:true } }));
      const released = await waitFor(() => n(window.InventorySystemV6?.reservations?.()) === 0 && n(window.InventorySystemV6?.available?.()) === 24);
      check(
        "Removing pending order releases all 24 eggs for sale",
        released,
        JSON.stringify({ inventory:inv(), reserved:window.InventorySystemV6?.reservations?.(), available:window.InventorySystemV6?.available?.() })
      );
    } catch (error) {
      check("Reservation regression completed without exception", false, String(error?.stack || error));
    } finally {
      restore(snap);
      await sleep(100);
      window.alert = oldAlert;
      window.confirm = oldConfirm;
    }
    return checks;
  }

  function install() {
    const base = window.StagingFullTest;
    if (!base?.run || base.__reservationV2) { setTimeout(install, 100); return; }
    const baseRun = base.run.bind(base);
    const replacedNames = new Set([
      "Sale cannot consume eggs reserved for pending order",
      "Sale can use only the unreserved dozen",
      "Deleting reservation-safe sale restores available dozen",
      "Removing pending order releases all 24 eggs for sale"
    ]);

    window.StagingFullTest = {
      ...base,
      async run() {
        const first = await baseRun();
        const rerun = await runReservationRegression();
        const kept = (first?.results || []).filter(x => !replacedNames.has(String(x?.name || "")));
        const results = [...kept, ...rerun];
        const failed = results.filter(x => !x.pass);
        const report = {
          ...first,
          total:results.length,
          passed:results.length - failed.length,
          failed:failed.length,
          results,
          suite:`${first?.suite || "staging-full"}+reservation-v2`
        };
        try { localStorage.setItem("chickenEggStagingFullTestReservationV2", JSON.stringify(report)); } catch {}
        return report;
      },
      last:() => read("chickenEggStagingFullTestReservationV2", null) || base.last?.() || null,
      __reservationV2:true
    };
    console.log("🧪 STAGING reservation regression v2 active — condition-based waits replace flaky fixed delays");
  }

  setTimeout(install, 1300);
})();
