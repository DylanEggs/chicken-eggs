(() => {
  "use strict";
  if (window.__StagingBreedingPerformanceV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingBreedingPerformanceV1 = true;

  const FARM_STORE="rfpFarmManagerV1";
  const MAP_STORE="rfpBreedingPerformanceV1";
  const BRAND="Rose Family Poultry";
  const read=(k,f)=>{try{const x=JSON.parse(localStorage.getItem(k)||JSON.stringify(f));return x??f;}catch{return f;}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}};
  const n=v=>Math.max(0,Number(v)||0);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const pct=(a,b)=>b>0?Math.round((n(a)/n(b))*1000)/10:0;

  function farm(){const s=read(FARM_STORE,{});return {breeding:Array.isArray(s?.breeding)?s.breeding:[],hatches:Array.isArray(s?.hatches)?s.hatches:[]};}
  function mappings(){const m=read(MAP_STORE,{});return m&&typeof m==="object"?m:{};}
  function assign(hatchId,groupId){const m=mappings();if(groupId)m[String(hatchId)]=String(groupId);else delete m[String(hatchId)];const ok=write(MAP_STORE,m);if(ok)window.dispatchEvent(new CustomEvent("rfp-staging-breeding-performance-changed"));return ok;}

  function summarize(state=farm(),map=mappings()){
    const groups=(Array.isArray(state.breeding)?state.breeding:[]).map(g=>({
      id:String(g.id||""),name:String(g.name||"Breeding group"),rooster:String(g.rooster||""),hens:String(g.hens||""),cross:String(g.cross||""),hatches:0,eggsSet:0,fertile:0,hatched:0,hatchRate:0,fertilityRate:0
    }));
    const byId=new Map(groups.map(g=>[g.id,g]));
    for(const h of Array.isArray(state.hatches)?state.hatches:[]){const g=byId.get(String(map?.[String(h.id||"")]||""));if(!g)continue;g.hatches++;g.eggsSet+=n(h.eggsSet);g.fertile+=n(h.fertile);g.hatched+=n(h.hatched);}
    for(const g of groups){g.hatchRate=pct(g.hatched,g.fertile||g.eggsSet);g.fertilityRate=pct(g.fertile,g.eggsSet);}
    const productive=groups.filter(g=>g.hatches>0).slice().sort((a,b)=>b.hatched-a.hatched||b.hatchRate-a.hatchRate)[0]||null;
    const bestRate=groups.filter(g=>g.hatches>0&&(g.fertile||g.eggsSet)>0).slice().sort((a,b)=>b.hatchRate-a.hatchRate||b.hatched-a.hatched)[0]||null;
    return {groups,productive,bestRate,linkedHatches:Object.keys(map||{}).length,totalHatches:(state.hatches||[]).length};
  }

  function css(){if(document.getElementById("rfpBreedingPerformanceCss"))return;const s=document.createElement("style");s.id="rfpBreedingPerformanceCss";s.textContent=`.rfp-bp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.rfp-bp-card{padding:12px;border-radius:15px;background:rgba(31,122,58,.07)}.rfp-bp-card b{display:block;font-size:20px}.rfp-bp-list{display:grid;gap:8px;margin-top:12px}.rfp-bp-item{padding:11px;border-radius:14px;background:rgba(31,122,58,.06)}.rfp-bp-map{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:center}.rfp-bp-map select{width:100%}.rfp-bp-note{font-size:11px;opacity:.72}@media(max-width:560px){.rfp-bp-grid,.rfp-bp-map{grid-template-columns:1fr}}`;document.head.appendChild(s);}

  function render(){
    const body=document.getElementById("rfpBizBody");if(!body)return;
    const s=farm(),m=mappings(),r=summarize(s,m);
    const cards=r.groups.map(g=>`<div class="rfp-bp-item"><strong>${esc(g.name)}</strong><div class="rfp-bp-note">${esc(g.rooster)} × ${esc(g.hens)}${g.cross?` • ${esc(g.cross)}`:""}</div><div class="rfp-bp-grid"><div>Hatches<b>${g.hatches}</b></div><div>Chicks hatched<b>${g.hatched}</b></div><div>Fertility<b>${g.fertilityRate.toFixed(1)}%</b></div><div>Hatch rate<b>${g.hatchRate.toFixed(1)}%</b></div></div></div>`).join("");
    const mappingRows=s.hatches.slice().reverse().map(h=>`<label class="rfp-bp-map"><span><strong>${esc(h.name||h.cross||"Hatch")}</strong><br><small>${n(h.hatched)}/${n(h.eggsSet)} hatched</small></span><select data-bp-hatch="${esc(h.id)}"><option value="">Not linked</option>${s.breeding.map(g=>`<option value="${esc(g.id)}" ${String(m[h.id]||"")===String(g.id)?"selected":""}>${esc(g.name)}</option>`).join("")}</select></label>`).join("");
    body.innerHTML=`<div class="rfp-bp-note"><strong>🧬 ${BRAND} Breeding Performance</strong><br>Link hatch records to breeding groups to see which groups are producing the most chicks and strongest hatch rates. STAGING local-only.</div><div class="rfp-bp-grid" style="margin-top:12px"><div class="rfp-bp-card"><span>Most productive group</span><b>${r.productive?esc(r.productive.name):"—"}</b><small>${r.productive?`${r.productive.hatched} chicks hatched`:"Link hatch records below"}</small></div><div class="rfp-bp-card"><span>Best hatch rate</span><b>${r.bestRate?r.bestRate.hatchRate.toFixed(1)+"%":"—"}</b><small>${r.bestRate?esc(r.bestRate.name):"No linked hatch data yet"}</small></div></div><h3>Breeding group results</h3><div class="rfp-bp-list">${cards||"<div class='rfp-bp-note'>Create a breeding group first.</div>"}</div><h3>Link hatch records</h3><div class="rfp-bp-list">${mappingRows||"<div class='rfp-bp-note'>No hatch records yet.</div>"}</div>`;
    body.querySelectorAll("[data-bp-hatch]").forEach(sel=>sel.addEventListener("change",()=>{assign(sel.dataset.bpHatch,sel.value);render();}));
  }

  function installTab(){const tabs=document.querySelector("#rfpBusinessModal .rfp-biz-tabs");if(!tabs||tabs.querySelector("[data-breeding-performance]"))return false;const b=document.createElement("button");b.type="button";b.dataset.breedingPerformance="1";b.textContent="🧬 Breeding Results";b.addEventListener("click",()=>{tabs.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));render();});tabs.appendChild(b);return true;}
  function start(){css();installTab();document.addEventListener("click",e=>{if(e.target?.closest?.("#rfpBusinessLauncher"))setTimeout(installTab,0);});}

  window.StagingBreedingPerformanceV1={version:1,networkCalls:0,firebaseWrites:0,summarize,assign,render,installTab};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
