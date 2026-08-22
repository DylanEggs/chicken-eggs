(() => {
  "use strict";
  if (window.__StagingFarmChoresV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingFarmChoresV1 = true;

  const STORE = "rfpRecurringChoresV1";
  const BRAND = "Rose Family Poultry";
  const read = () => { try { const x = JSON.parse(localStorage.getItem(STORE) || "[]"); return Array.isArray(x) ? x : []; } catch { return []; } };
  const write = rows => { try { localStorage.setItem(STORE, JSON.stringify(rows)); window.dispatchEvent(new CustomEvent("rfp-staging-chores-changed")); return true; } catch { return false; } };
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (date, days) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + Number(days || 0)); return d.toISOString().slice(0,10); };
  const intervalDays = cadence => ({daily:1,every2:2,weekly:7,biweekly:14,monthly:30,quarterly:90}[cadence] || 7);
  const label = cadence => ({daily:"Daily",every2:"Every 2 days",weekly:"Weekly",biweekly:"Every 2 weeks",monthly:"Monthly",quarterly:"Every 3 months"}[cadence] || "Weekly");
  const dueState = date => date < today() ? "overdue" : date === today() ? "today" : "upcoming";

  function addChore(x={}) {
    const rows = read();
    const cadence = String(x.cadence || "weekly");
    const startDate = String(x.nextDue || today());
    const row = {
      id:`chore-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      title:String(x.title || "Farm chore"),
      category:String(x.category || "Coop"),
      cadence,
      nextDue:startDate,
      notes:String(x.notes || ""),
      completedCount:0,
      lastCompleted:""
    };
    rows.push(row); write(rows); return row;
  }
  function complete(id) {
    const rows = read(); const row = rows.find(x => x.id === id); if (!row) return null;
    const base = row.nextDue < today() ? today() : row.nextDue;
    row.lastCompleted = today(); row.completedCount = Number(row.completedCount || 0) + 1;
    row.nextDue = addDays(base, intervalDays(row.cadence)); write(rows); return row;
  }
  function remove(id) { const rows = read().filter(x => x.id !== id); write(rows); return rows; }
  function summary() {
    const rows = read();
    return { total:rows.length, overdue:rows.filter(x=>dueState(x.nextDue)==="overdue").length, today:rows.filter(x=>dueState(x.nextDue)==="today").length, upcoming:rows.filter(x=>dueState(x.nextDue)==="upcoming").length };
  }

  function css() {
    if (document.getElementById("rfpChoreCss")) return;
    const s=document.createElement("style"); s.id="rfpChoreCss"; s.textContent=`
      #rfpChoreLauncher{position:fixed;right:14px;bottom:142px;z-index:9997;width:auto!important;margin:0!important;padding:10px 13px!important;border-radius:999px!important;font-size:12px!important;box-shadow:0 10px 26px rgba(0,0,0,.18)}
      .rfp-chore-modal[hidden]{display:none!important}.rfp-chore-modal{position:fixed;inset:0;z-index:10030;background:rgba(9,20,12,.72);padding:14px;overflow:auto}.rfp-chore-sheet{max-width:680px;margin:24px auto;background:#f7fbf7;color:#17351f;border-radius:24px;padding:18px}.farm2-dark .rfp-chore-sheet{background:#18231b;color:#f7fbf7}.rfp-chore-head{display:flex;justify-content:space-between;gap:10px}.rfp-chore-head button{width:auto!important;margin:0!important}.rfp-chore-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}.rfp-chore-stat,.rfp-chore-item{padding:11px;border-radius:14px;background:rgba(31,122,58,.07)}.rfp-chore-stat{text-align:center}.rfp-chore-stat b{display:block;font-size:20px}.rfp-chore-form{display:grid;gap:8px}.rfp-chore-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.rfp-chore-form input,.rfp-chore-form select,.rfp-chore-form textarea{width:100%;box-sizing:border-box}.rfp-chore-list{display:grid;gap:8px;margin-top:12px}.rfp-chore-item.overdue{border:2px solid #c0392b}.rfp-chore-item.today{border:2px solid #d97706}.rfp-chore-item header{display:flex;justify-content:space-between;gap:8px}.rfp-chore-item small{display:block;opacity:.72;margin-top:4px}.rfp-chore-actions{display:flex;gap:7px;margin-top:8px;flex-wrap:wrap}.rfp-chore-actions button{width:auto!important;margin:0!important;padding:7px 9px!important;font-size:11px!important}.rfp-chore-note{font-size:11px;opacity:.7}@media(max-width:560px){.rfp-chore-grid,.rfp-chore-row{grid-template-columns:1fr}}
    `; document.head.appendChild(s);
  }
  function shell() {
    if (document.getElementById("rfpChoreModal")) return;
    const m=document.createElement("div"); m.id="rfpChoreModal"; m.className="rfp-chore-modal"; m.hidden=true;
    m.innerHTML=`<div class="rfp-chore-sheet"><div class="rfp-chore-head"><div><div class="eyebrow">STAGING • LOCAL ONLY</div><h2>🔁 Recurring Farm Chores</h2><div class="rfp-chore-note">${BRAND} • zero Firebase calls</div></div><button type="button" data-chore-close>Close</button></div><div id="rfpChoreBody"></div></div>`;
    m.querySelector("[data-chore-close]").addEventListener("click",()=>m.hidden=true); m.addEventListener("click",e=>{if(e.target===m)m.hidden=true;}); document.body.appendChild(m);
  }
  function render() {
    const rows=read().slice().sort((a,b)=>String(a.nextDue).localeCompare(String(b.nextDue))), s=summary(), body=document.getElementById("rfpChoreBody"); if(!body)return;
    body.innerHTML=`<div class="rfp-chore-grid"><div class="rfp-chore-stat"><span>Due today</span><b>${s.today}</b></div><div class="rfp-chore-stat"><span>Overdue</span><b>${s.overdue}</b></div><div class="rfp-chore-stat"><span>Tracked</span><b>${s.total}</b></div></div><form id="rfpChoreForm" class="rfp-chore-form"><div class="rfp-chore-row"><input name="title" placeholder="Clean waterers, refresh bedding..." required><select name="category"><option>Coop</option><option>Feed / Water</option><option>Incubator</option><option>Health</option><option>Business</option><option>Equipment</option><option>Other</option></select></div><div class="rfp-chore-row"><select name="cadence"><option value="daily">Daily</option><option value="every2">Every 2 days</option><option value="weekly" selected>Weekly</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Monthly</option><option value="quarterly">Every 3 months</option></select><label>Next due<input name="nextDue" type="date" value="${today()}" required></label></div><textarea name="notes" placeholder="Notes (optional)"></textarea><button type="submit">Add Recurring Chore</button></form><div class="rfp-chore-list">${rows.map(x=>`<div class="rfp-chore-item ${dueState(x.nextDue)}"><header><strong>${esc(x.title)}</strong><b>${esc(x.nextDue)}</b></header><small>${esc(x.category)} • ${label(x.cadence)} • completed ${Number(x.completedCount||0)} time${Number(x.completedCount||0)===1?"":"s"}${x.lastCompleted?` • last ${esc(x.lastCompleted)}`:""}</small>${x.notes?`<small>${esc(x.notes)}</small>`:""}<div class="rfp-chore-actions"><button type="button" data-chore-done="${esc(x.id)}">✓ Done — advance date</button><button type="button" data-chore-remove="${esc(x.id)}">Remove</button></div></div>`).join("")||'<div class="rfp-chore-note">No recurring chores yet.</div>'}</div>`;
    document.getElementById("rfpChoreForm")?.addEventListener("submit",e=>{e.preventDefault();addChore(Object.fromEntries(new FormData(e.currentTarget)));render();});
    body.querySelectorAll("[data-chore-done]").forEach(b=>b.addEventListener("click",()=>{complete(b.dataset.choreDone);render();}));
    body.querySelectorAll("[data-chore-remove]").forEach(b=>b.addEventListener("click",()=>{remove(b.dataset.choreRemove);render();}));
  }
  function open(){shell();document.getElementById("rfpChoreModal").hidden=false;render();}
  function start(){css();if(!document.getElementById("rfpChoreLauncher")){const b=document.createElement("button");b.id="rfpChoreLauncher";b.type="button";b.textContent="🔁 Chores";b.addEventListener("click",open);document.body.appendChild(b);} }

  window.StagingFarmChoresV1={version:1,networkCalls:0,firebaseWrites:0,read,addChore,complete,remove,summary,intervalDays,open};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
