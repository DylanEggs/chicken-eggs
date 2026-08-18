(() => {
  "use strict";
  if (window.StagingReadBudgetV1) return;
  if (!window.__ChickenEggsStagingMode) return;

  const clone = v => JSON.parse(JSON.stringify(v));
  const n = v => Number(v) || 0;

  function simulateApply(rows0, state0, signal) {
    let rows = clone(Array.isArray(rows0) ? rows0 : []);
    const state = { seq:n(state0?.seq), changeId:String(state0?.changeId || "") };
    const remoteSeq = n(signal?.seq);
    if (remoteSeq < state.seq) return { rows, state, applied:0, needsFull:true };
    if (remoteSeq === state.seq) return { rows, state:{...state,changeId:String(signal?.changeId || state.changeId)}, applied:0, needsFull:false };
    const changes = (Array.isArray(signal?.recentChanges) ? signal.recentChanges : [])
      .filter(x => n(x?.seq) > state.seq)
      .sort((a,b) => n(a.seq) - n(b.seq));
    if (!changes.length || n(changes[0].seq) !== state.seq + 1 || n(changes[changes.length - 1].seq) !== remoteSeq) {
      return { rows, state, applied:0, needsFull:true };
    }
    for (const change of changes) {
      const id = String(change?.entryId || "");
      if (!id) return { rows, state, applied:0, needsFull:true };
      if (change.action === "delete") rows = rows.filter(x => String(x?.id || "") !== id);
      else if (change.action === "upsert" && change.entry && typeof change.entry === "object") {
        rows = rows.filter(x => String(x?.id || "") !== id);
        rows.push({ ...clone(change.entry), id });
      } else return { rows, state, applied:0, needsFull:true };
    }
    return {
      rows,
      state:{ seq:remoteSeq, changeId:String(signal?.changeId || "") },
      applied:changes.length,
      needsFull:false
    };
  }

  async function sourceText() {
    const url = new URL("../firebase-safe-v10.js", location.href);
    url.searchParams.set("t", String(Date.now()));
    const response = await fetch(url.href, { cache:"no-store" });
    if (!response.ok) throw new Error(`firebase-safe-v10.js HTTP ${response.status}`);
    return response.text();
  }

  async function run() {
    const checks = [];
    const check = (name, pass, detail="") => checks.push({ name, pass:!!pass, detail:String(detail || "") });
    try {
      const source = await sourceText();
      const parseSource = source.replace(/^import .*?;\s*$/gm, "");
      try {
        new Function(parseSource);
        check("Firebase v10 source parses as JavaScript after module imports are removed", true);
      } catch (error) {
        check("Firebase v10 source parses as JavaScript after module imports are removed", false, error?.message || error);
      }

      check("Expensive whole entries collection listener is removed", !source.includes('onSnapshot(collection(db,"entries")'), "v10 must never listen to the entire entries collection");
      check("Farm dataset listener is narrowed to the four dataset document types", source.includes('where("type","in",DATASET_TYPES)'), "expected targeted dataset query");
      check("Core history uses one small change-signal document", source.includes('CORE_SIGNAL_DOC = "core_signal_v1"') && source.includes('recentChanges'), "expected rolling signal document");
      check("Core entry writes update history and signal in one transaction", source.includes('commitCoreChange') && source.includes('tx.set(signalRef') && source.includes('tx.set(entryRef'), "expected transactional upsert + signal");
      check("Core deletes update the same signal transaction", source.includes('tx.delete(entryRef)') && source.includes('action === "delete"'), "expected transactional delete + signal");
      check("Clean visibility changes do not force a full cloud reread", /visibilitychange[\s\S]{0,300}dirty\.size/.test(source) && !/visibilitychange[\s\S]{0,300}loadCoreEntriesFromCloud/.test(source), "only dirty local work should sync on resume");
      check("Full lifetime history refresh is capped by a 24-hour integrity window", source.includes('CORE_FULL_CHECK_MS = 24 * 60 * 60 * 1000'), "expected daily integrity ceiling");

      const baseRows = [{ id:"old", type:"eggs", eggs:5, date:"2026-08-17" }];
      const coalesced = {
        seq:12,
        changeId:"12-x",
        recentChanges:[
          { seq:11, changeId:"11-x", action:"upsert", entryId:"new13", entry:{ id:"new13", type:"eggs", eggs:13, date:"2026-08-18" } },
          { seq:12, changeId:"12-x", action:"delete", entryId:"old" }
        ]
      };
      const applied = simulateApply(baseRows,{seq:10,changeId:"10-x"},coalesced);
      check("Coalesced multi-device signal applies every missed change in order", !applied.needsFull && applied.applied===2, JSON.stringify(applied));
      check("Coalesced signal preserves the new 13-egg row", applied.rows.length===1 && applied.rows[0]?.id==="new13" && n(applied.rows[0]?.eggs)===13, JSON.stringify(applied.rows));
      check("Coalesced signal also applies a deletion", !applied.rows.some(x=>x.id==="old"), JSON.stringify(applied.rows));
      check("Applied device advances to the exact latest sequence", applied.state.seq===12 && applied.state.changeId==="12-x", JSON.stringify(applied.state));

      const gap = simulateApply(baseRows,{seq:10,changeId:"10-x"},{seq:15,changeId:"15-x",recentChanges:[{seq:15,changeId:"15-x",action:"delete",entryId:"old"}]});
      check("A missing signal gap refuses to guess and demands a full authoritative refresh", gap.needsFull===true && gap.applied===0, JSON.stringify(gap));

      const same = simulateApply(baseRows,{seq:12,changeId:"12-x"},{seq:12,changeId:"12-x",recentChanges:[]});
      check("Already-current device does zero history work", same.needsFull===false && same.applied===0 && same.rows.length===1, JSON.stringify(same));
    } catch (error) {
      check("Low-read sync regression completed without exception", false, String(error?.stack || error));
    }
    const failed = checks.filter(x => !x.pass);
    return { total:checks.length, passed:checks.length-failed.length, failed:failed.length, checks };
  }

  function reportText(result) {
    if (!result.failed) return `✅ Low-read sync test passed ${result.passed}/${result.total} checks.\n\nThe v10 engine is still NOT live.`;
    const failed = result.checks.filter(x=>!x.pass).map((x,i)=>`${i+1}. ${x.name}${x.detail?`\n   ${x.detail}`:""}`).join("\n\n");
    return `❌ Low-read sync test: ${result.passed}/${result.total} passed, ${result.failed} failed.\n\n${failed}\n\nThe v10 engine was NOT switched live.`;
  }

  function injectButton() {
    const row = document.querySelector("#stagingSafetyBanner .st-row");
    if (!row || document.getElementById("stagingReadBudgetTest")) return false;
    const btn = document.createElement("button");
    btn.id = "stagingReadBudgetTest";
    btn.className = "st-test";
    btn.textContent = "📉 Test Low-Read Sync";
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Testing low-read sync…";
      try {
        const result = await run();
        window.__lastStagingReadBudgetResult = result;
        alert(reportText(result));
      } catch (error) {
        console.error(error);
        alert("Low-read sync test could not complete. The live app was not changed.");
      } finally {
        btn.disabled = false;
        btn.textContent = "📉 Test Low-Read Sync";
      }
    });
    const full = document.getElementById("stagingRunFullTest");
    if (full?.nextSibling) row.insertBefore(btn, full.nextSibling);
    else row.appendChild(btn);
    return true;
  }

  window.StagingReadBudgetV1 = { version:1, run, simulateApply };
  const install = () => { if (!injectButton()) setTimeout(install,120); };
  setTimeout(install,200);
  console.log("📉 STAGING low-read sync regression ready");
})();
