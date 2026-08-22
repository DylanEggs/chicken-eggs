(() => {
  "use strict";
  if (window.__StagingMidnightPolishV1) return;
  if (!window.__ChickenEggsStagingMode) return;
  window.__StagingMidnightPolishV1 = true;

  const ENTRIES="chickenEggEntriesV102";
  const INVENTORY="chickenEggInventoryV2";
  const BRAND="Rose Family Poultry";
  const LOCATION="High Point, NC";
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}};
  const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const today=()=>localDate(new Date());
  const totalInv=()=>{const s=window.InventorySystemV6?.state?.()||read(INVENTORY,{});return (Number(s.dozens)||0)*12+(Number(s.packs18)||0)*18+(Number(s.loose)||0);};

  function eggRows(){const rows=read(ENTRIES,[]);return Array.isArray(rows)?rows.filter(e=>e?.type==="eggs"):[];}
  function eggsToday(){const t=today();return eggRows().filter(e=>String(e.date||"")===t).reduce((n,e)=>n+(Number(e.eggs)||0),0);}
  function streak(){
    const days=new Set(eggRows().filter(e=>(Number(e.eggs)||0)>0).map(e=>String(e.date||"")));
    let n=0,d=new Date();
    while(days.has(localDate(d))){n++;d.setDate(d.getDate()-1);}
    return n;
  }
  function dozenProgress(){const inv=totalInv();const remainder=inv%12;return {inv,remainder,next:remainder===0?12:12-remainder};}

  function injectCss(){
    if(document.getElementById("rfpMidnightPolishCss"))return;
    const s=document.createElement("style");s.id="rfpMidnightPolishCss";s.textContent=`
      .rfp-brand-card,.rfp-wins-card{margin:14px 0;padding:16px;border-radius:22px;background:rgba(255,255,255,.86);box-shadow:0 12px 32px rgba(24,68,36,.10);border:1px solid rgba(31,122,58,.10)}
      .rfp-brand-card{display:flex;align-items:center;gap:13px}.rfp-brand-mark{width:52px;height:52px;display:grid;place-items:center;border-radius:17px;background:linear-gradient(145deg,#ffe796,#f5b91c);font-size:29px;flex:0 0 auto}.rfp-brand-copy strong{display:block;font-size:18px;line-height:1.15}.rfp-brand-copy span{display:block;margin-top:4px;font-size:12px;font-weight:800;opacity:.72}.rfp-stage-chip{margin-left:auto;align-self:flex-start;padding:5px 8px;border-radius:999px;background:#7f1d1d;color:#fff;font-size:9px;font-weight:950;letter-spacing:.06em}
      .rfp-wins-head{display:flex;justify-content:space-between;gap:10px;align-items:end;margin-bottom:11px}.rfp-wins-head h3{margin:0}.rfp-wins-head small{font-weight:800;opacity:.65}.rfp-wins-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.rfp-win{padding:12px 9px;border-radius:16px;background:rgba(31,122,58,.07);text-align:center}.rfp-win b{display:block;font-size:22px}.rfp-win span{display:block;margin-top:3px;font-size:10px;font-weight:850;opacity:.72}.rfp-progress{margin-top:11px}.rfp-progress-track{height:9px;border-radius:99px;background:rgba(31,122,58,.10);overflow:hidden}.rfp-progress-fill{height:100%;background:linear-gradient(90deg,#f5b91c,#4fcb75);border-radius:99px}.rfp-progress-note{margin-top:6px;font-size:11px;font-weight:800;opacity:.72}.rfp-quick{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.rfp-quick button{margin:0!important;padding:10px 8px!important;font-size:11px!important;min-height:42px}.rfp-business-note{margin-top:10px;padding:10px 12px;border-radius:14px;background:rgba(245,185,28,.11);font-size:11px;font-weight:800;line-height:1.4}
      @media(max-width:520px){.rfp-wins-grid,.rfp-quick{grid-template-columns:1fr 1fr 1fr}.rfp-brand-card{align-items:flex-start}.rfp-stage-chip{font-size:8px}}
    `;document.head.appendChild(s);
  }

  function brandHeader(){
    document.title=`${BRAND} — STAGING`;
    const eyebrow=document.querySelector(".appHeader .eyebrow");if(eyebrow)eyebrow.textContent=BRAND;
    const hero=document.getElementById("farmHeroName");if(hero&&!String(hero.textContent||"").trim())hero.textContent=BRAND;
  }

  function ensureBrandCard(){
    const dash=document.getElementById("dashboard");if(!dash)return;
    let card=document.getElementById("rfpBusinessIdentityCard");
    if(!card){card=document.createElement("section");card.id="rfpBusinessIdentityCard";card.className="rfp-brand-card";const hero=dash.querySelector(".heroCard");if(hero)hero.insertAdjacentElement("afterend",card);else dash.prepend(card);}
    card.innerHTML=`<div class="rfp-brand-mark">🐔</div><div class="rfp-brand-copy"><strong>${BRAND}</strong><span>Family-owned eggs & poultry • ${LOCATION}</span><span>Business identity preview — no Firebase writes</span></div><span class="rfp-stage-chip">STAGING</span>`;
  }

  function ensureWins(){
    const dash=document.getElementById("dashboard");if(!dash)return;
    let card=document.getElementById("rfpFarmWins");
    if(!card){card=document.createElement("section");card.id="rfpFarmWins";card.className="rfp-wins-card";const totals=document.getElementById("dashboardTotals");if(totals)totals.insertAdjacentElement("afterend",card);else dash.appendChild(card);}
    const t=eggsToday(),st=streak(),p=dozenProgress(),pct=Math.max(0,Math.min(100,Math.round((p.remainder/12)*100)));
    card.innerHTML=`<div class="rfp-wins-head"><h3>🏆 Farm Wins</h3><small>local-only • zero Firebase calls</small></div><div class="rfp-wins-grid"><div class="rfp-win"><b>${t}</b><span>eggs today</span></div><div class="rfp-win"><b>${p.inv}</b><span>eggs on hand</span></div><div class="rfp-win"><b>${st}</b><span>day laying streak</span></div></div><div class="rfp-progress"><div class="rfp-progress-track"><div class="rfp-progress-fill" style="width:${pct}%"></div></div><div class="rfp-progress-note">${p.remainder===0?"Full dozen milestone reached — next dozen starts now.":`${p.next} more egg${p.next===1?"":"s"} to the next full dozen.`}</div></div><div class="rfp-quick"><button type="button" data-rfp-screen="collect">🥚 Collect</button><button type="button" data-rfp-screen="sale">💰 Sale</button><button type="button" data-rfp-screen="farm2Inventory">📦 Inventory</button></div>`;
    card.querySelectorAll("[data-rfp-screen]").forEach(btn=>btn.addEventListener("click",()=>{const id=btn.dataset.rfpScreen;if(document.getElementById(id))window.showScreen?.(id);else if(id==="farm2Inventory")window.showScreen?.("farm");}));
  }

  function ensureFarmNote(){
    const farm=document.getElementById("farm");if(!farm)return;
    let note=document.getElementById("rfpBusinessFarmNote");if(!note){note=document.createElement("div");note.id="rfpBusinessFarmNote";note.className="rfp-business-note";const title=farm.querySelector(".screenTitle");if(title)title.insertAdjacentElement("afterend",note);else farm.prepend(note);}
    note.textContent=`Business-facing staging name: ${BRAND} • ${LOCATION}. No LLC wording is used until the business is officially formed. This preview does not write to Firebase.`;
  }

  function render(){injectCss();brandHeader();ensureBrandCard();ensureWins();ensureFarmNote();}
  ["core-data-synced","farm-data-synced","inventory-authority-changed","farm-local-data-changed","farm-sync-ready"].forEach(name=>window.addEventListener(name,render));
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",render,{once:true});else setTimeout(render,0);

  window.StagingMidnightPolishV1={version:2,brand:BRAND,location:LOCATION,render,networkCalls:0,writesLocalStorage:false,writesFirebase:false};
  console.log("🌙 STAGING midnight polish active — Rose Family Poultry branding + local Farm Wins; zero Firebase calls");
})();