(() => {
  "use strict";
  if (!window.__ChickenEggsStagingMode) return;
  if (window.StagingCustomerRequestStatusTestV1) return;

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

  window.StagingCustomerRequestStatusTestV1 = {
    version:1,
    updateFromControls,
    getLast:() => last ? { ...last } : null
  };
})();
