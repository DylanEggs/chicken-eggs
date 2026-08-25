(() => {
  "use strict";
  if (window.__StagingManualInventoryExactBridgeV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingManualInventoryExactBridgeV1 = true;

  const whole = v => Math.max(0, Math.round(Number(v) || 0));
  const total = s => whole(s?.dozens) * 12 + whole(s?.packs18) * 18 + whole(s?.loose);

  function install() {
    const api = window.InventorySystemV6;
    if (!api?.commitExact || !api?.replaceFromRestore) {
      setTimeout(install, 80);
      return;
    }
    if (api.commitExact.__stagingManualExactBridgeV1) return;

    const original = api.commitExact.bind(api);
    const wrapped = async (d, p, l) => {
      if (!window.__stagingTwelvePackBypass) return original(d, p, l);

      const before = api.state?.() || {};
      const next = {
        ...before,
        dozens: whole(d),
        packs18: whole(p),
        loose: whole(l),
        updatedAt: Date.now()
      };
      const beforeTotal = total(before);
      const afterTotal = total(next);
      const adjustments = Array.isArray(before.adjustments) ? before.adjustments.slice() : [];
      adjustments.unshift({
        id:`staging-manual-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        date:new Date().toISOString().slice(0,10),
        at:Date.now(),
        delta:afterTotal-beforeTotal,
        reason:"Exact inventory count",
        details:`${whole(d)} 12-packs, ${whole(p)} 18-packs, ${whole(l)} individual eggs`,
        totalAfter:afterTotal,
        cartonBreakdown:{dozens:whole(d),packs18:whole(p),loose:whole(l)},
        authority:"staging-manual-inventory-exact-bridge-v1"
      });
      next.adjustments = adjustments.slice(0,100);

      await api.replaceFromRestore(next);
      const saved = api.state?.() || next;
      window.dispatchEvent(new CustomEvent("inventory-authority-changed", {
        detail:{before:beforeTotal,after:total(saved),reason:"Exact inventory count",staging:true,manualExact:true,at:Date.now()}
      }));
      return saved;
    };
    wrapped.__stagingManualExactBridgeV1 = true;
    wrapped.__originalCommitExact = original;
    api.commitExact = wrapped;
    window.StagingManualInventoryExactBridgeV1 = { version:1 };
    console.log("📦 STAGING exact manual inventory bridge active — manual 12/18/individual values bypass repacking once");
  }

  install();
})();