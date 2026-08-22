(() => {
  "use strict";
  if(window.__StagingCustomerLedgerRegressionV1||!window.__ChickenEggsStagingMode)return;window.__StagingCustomerLedgerRegressionV1=true;
  async function run(){const api=window.StagingCustomerLedgerV1,tests=[];const t=(name,ok)=>tests.push({name,ok:!!ok});t("customer ledger loads",!!api);t("customer ledger uses Rose Family Poultry",api?.brand==="Rose Family Poultry");t("customer ledger has zero network calls",api?.networkCalls===0);t("customer ledger has zero Firebase writes",api?.firebaseWrites===0);t("customer ledger returns array",Array.isArray(api?.ledger?.()));t("customer ledger summary available",typeof api?.summary?.().customers==="number");t("LLC branding absent",!String(document.documentElement.innerHTML).includes("Rose Family Poultry, LLC"));return {name:"Customer Purchase Ledger",passed:tests.every(x=>x.ok),tests};}
  window.StagingCustomerLedgerRegressionV1={run};
  window.dispatchEvent(new CustomEvent("staging-regression-suite-ready",{detail:{name:"customer-ledger",run}}));
})();