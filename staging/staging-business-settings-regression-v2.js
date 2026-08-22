(() => {
  "use strict";
  if (window.__StagingBusinessSettingsRegressionV2 || !window.__ChickenEggsStagingMode) return;
  window.__StagingBusinessSettingsRegressionV2 = true;

  function run(){
    const api=window.StagingBusinessIdentityV2, checks=[];
    const add=(name,pass,detail="")=>checks.push({name,pass:!!pass,detail});
    add("Business identity module loaded",!!api);
    add("Business identity declares zero Firebase",api?.zeroFirebase===true);
    add("LLC wording is stripped",api?.cleanName?.("Rose Family Poultry, LLC")==="Rose Family Poultry");
    add("Default branding is Rose Family Poultry",api?.cleanName?.("")==="Rose Family Poultry");
    add("Invoice number formatting works",api?.receiptNumber?.({invoicePrefix:"RFP",nextInvoice:7})==="RFP-0007");
    add("No LLC wording in generated identity state",!/\bLLC\b/i.test(JSON.stringify(api?.read?.()||{})));
    add("Business settings are local-only",!String(window.StagingBusinessIdentityV2?.render||"").includes("firebase"));
    return {name:"Business Settings v2",passed:checks.every(x=>x.pass),checks};
  }

  window.StagingBusinessSettingsRegressionV2={run};
  window.StagingRegressionSuites=window.StagingRegressionSuites||[];
  window.StagingRegressionSuites.push(run);
})();
