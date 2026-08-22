(() => {
  "use strict";
  if (!window.__ChickenEggsStagingMode) return;
  if (window.StagingCustomerRequestStatusTestV1) return;

  const KEY = "chickenEggCustomerRequestsV1";
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let last = null;

  async function updateFromControls(button, delayMs = 40) {
    const api = window.StagingCustomerRequestsV1;
    if (!api?.updateStatus) throw new Error("Customer Requests staging API is not ready.");

    const id = String(button?.dataset?.reqSave || "");
    const select = button?.closest?.(".req-actions")?.querySelector?.("select[data-req-status]");
    const status = String(select?.value || "");
    if (!id) throw new Error("Request id is missing.");
    if (!api.statuses.includes(status)) throw new Error("Invalid request status.");

    // Capture the id and selected value before any async delay or rerender.
    last = { id, status, ok:false, error:"" };
    await sleep(delayMs);
    try {
      api.updateStatus(id, status);
      last.ok = true;
      return api.load().requests.find(row => row.id === id) || null;
    } catch (error) {
      last.error = String(error?.message || error);
      throw error;
    }
  }

  async function runRegression() {
    const api = window.StagingCustomerRequestsV1;
    const results = [];
    const check = (name, pass, detail="") => results.push({name, pass:!!pass, detail:String(detail||"")});
    const original = localStorage.getItem(KEY);
    try {
      check("Customer Request status parity helper is active", !!api?.updateStatus && !!window.StagingCustomerRequestStatusTestV1);
      api.save({version:1,settings:{eggs:"auto",birds:"auto"},requests:[]});

      const first = api.createRequest({name:"Click Cancel Test",category:"eggs",item:"12-pack eggs",quantity:1,phone:"336-555-0198"});
      api.render();
      let select = document.querySelector(`#customerRequests [data-req-status="${CSS.escape(first.id)}"]`);
      let button = document.querySelector(`#customerRequests [data-req-save="${CSS.escape(first.id)}"]`);
      check("Owner inbox renders status dropdown and Update button", !!select && !!button);
      if (select && button) {
        select.value = "Cancelled";
        button.click();
        await sleep(25);
        check("Real staging Update click changes request to Cancelled", api.load().requests.find(r=>r.id===first.id)?.status === "Cancelled", api.load().requests.find(r=>r.id===first.id)?.status || "missing");
      }

      const second = api.createRequest({name:"Async Cancel Test",category:"birds",birdType:"pullets",item:"Any pullets",quantity:1,email:"async@example.test"});
      api.render();
      select = document.querySelector(`#customerRequests [data-req-status="${CSS.escape(second.id)}"]`);
      button = document.querySelector(`#customerRequests [data-req-save="${CSS.escape(second.id)}"]`);
      if (select && button) {
        select.value = "Cancelled";
        const pending = updateFromControls(button, 60);
        // Force the same kind of rerender that previously broke settings save.
        api.render();
        const row = await pending;
        check("Async status update keeps selected Cancelled value through rerender", row?.status === "Cancelled", row?.status || "missing");
        check("Async status update persists Cancelled in staging storage", api.load().requests.find(r=>r.id===second.id)?.status === "Cancelled", api.load().requests.find(r=>r.id===second.id)?.status || "missing");
      } else {
        check("Async status update keeps selected Cancelled value through rerender", false, "controls missing");
        check("Async status update persists Cancelled in staging storage", false, "controls missing");
      }
    } catch (error) {
      check("Customer Request status click regression completed without exception", false, String(error?.stack || error));
    } finally {
      if (original == null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, original);
      try { api?.render?.(); } catch {}
    }
    return results;
  }

  function installRegression() {
    const base = window.StagingFullTest;
    const ready = base?.run && base.__customerRequestsV1;
    if (!ready || base.__customerRequestStatusParityV1) {
      setTimeout(installRegression, 160);
      return;
    }
    const baseRun = base.run.bind(base);
    window.StagingFullTest = {
      ...base,
      async run() {
        const first = await baseRun();
        const extra = await runRegression();
        const results = [...(first?.results || []), ...extra];
        const failed = results.filter(x => !x.pass);
        return {...first,total:results.length,passed:results.length-failed.length,failed:failed.length,results,suite:`${first?.suite||"staging-full"}+customer-request-status-click-v1`};
      },
      __customerRequestStatusParityV1:true
    };
    console.log("📨 STAGING customer request status click regression active");
  }

  window.StagingCustomerRequestStatusTestV1 = {
    version:2,
    updateFromControls,
    runRegression,
    getLast:() => last ? { ...last } : null
  };

  setTimeout(installRegression, 2800);
})();
