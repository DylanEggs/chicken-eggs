(() => {
  "use strict";
  if (window.__StagingCustomerLedgerV1 || !window.__ChickenEggsStagingMode) return;
  window.__StagingCustomerLedgerV1 = true;

  const ENTRIES="chickenEggEntriesV102", APP2="chickenEggApp2V1", BRAND="Rose Family Poultry";
  const read=(k,f)=>{try{const raw=localStorage.getItem(k);return raw==null?f:JSON.parse(raw);}catch{return f;}};
  const n=v=>Math.max(0,Number(v)||0), money=v=>`$${n(v).toFixed(2)}`;
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const norm=v=>String(v||"").trim().toLowerCase();
  function saleAmount(e){if(!e||e.type!=="sale")return 0;if(Number.isFinite(Number(e.total)))return n(e.total);if(Number.isFinite(Number(e.amount)))return n(e.amount);return n(e.dozenSold||e.dozens||e.dozen)*n(e.dozenPrice||e.pricePerDozen||e.price)+n(e.packSold||e.packs18)*n(e.packPrice||e.pricePer18);}
  function app(){const a=read(APP2,{});return a&&typeof a==="object"?a:{};}
  function eggSales(){const x=read(ENTRIES,[]);return (Array.isArray(x)?x:[]).filter(e=>e?.type==="sale");}
  function birdSales(){const a=app();const pool=[a.birdSales,a.chickenSales,a.sales].find(Array.isArray)||[];return pool.filter(Boolean);}
  function customers(){const a=app();return Array.isArray(a.customers)?a.customers:[];}
  function customerName(x){return String(x?.customer||x?.customerName||x?.name||x?.buyer||"").trim();}
  function birdAmount(x){const qty=Math.max(1,n(x?.quantity||x?.qty||1));const total=Number(x?.total??x?.amount);return Number.isFinite(total)?n(total):n(x?.price)*qty;}
  function loyalty(count,spent){if(count>=10||spent>=250)return"VIP";if(count>=3||spent>=60)return"Regular";return"New";}
  function ledger(){
    const map=new Map();
    const seed=(name,source={})=>{name=String(name||"").trim();if(!name)return null;const key=norm(name);if(!map.has(key))map.set(key,{key,name,phone:String(source.phone||source.phoneNumber||""),email:String(source.email||""),purchases:[],eggSales:0,birdSales:0,spent:0});return map.get(key);};
    for(const c of customers())seed(c.name||c.customer||c.customerName,c);
    for(const e of eggSales()){
      const name=customerName(e);if(!name)continue;const row=seed(name,e),amount=saleAmount(e);row.eggSales++;row.spent+=amount;row.purchases.push({type:"Eggs",date:String(e.date||""),amount,details:`${n(e.dozenSold||e.dozens||e.dozen)} dozen • ${n(e.packSold||e.packs18)} 18-pack`});
    }
    for(const s of birdSales()){
      const name=customerName(s);if(!name)continue;const row=seed(name,s),amount=birdAmount(s);row.birdSales++;row.spent+=amount;row.purchases.push({type:"Birds",date:String(s.date||s.soldDate||""),amount,details:`${Math.max(1,n(s.quantity||s.qty||1))} bird${Math.max(1,n(s.quantity||s.qty||1))===1?"":"s"}`});
    }
    return [...map.values()].map(r=>({...r,totalPurchases:r.eggSales+r.birdSales,badge:loyalty(r.eggSales+r.birdSales,r.spent),lastPurchase:r.purchases.map(p=>p.date).filter(Boolean).sort().pop()||""})).sort((a,b)=>b.spent-a.spent||a.name.localeCompare(b.name));
  }
  function summary(){const rows=ledger();return {customers:rows.length,vips:rows.filter(r=>r.badge==="VIP").length,regulars:rows.filter(r=>r.badge==="Regular").length,totalSpent:rows.reduce((s,r)=>s+r.spent,0)};}
  function render(){
    const body=document.getElementById("rfpBizBody");if(!body)return;
    document.querySelectorAll("#rfpBusinessModal [data-tab]").forEach(b=>b.classList.remove("active"));document.querySelector("#rfpBusinessModal [data-ledger-tab]")?.classList.add("active");
    const rows=ledger(),s=summary();
    body.innerHTML=`<section class="rfp-biz-panel active"><h3>🤝 Customer Purchase History</h3><div class="rfp-muted">Private STAGING view • ${BRAND} • no customer data is published.</div><div class="rfp-biz-grid" style="margin-top:10px"><div class="rfp-biz-card"><span>Customers</span><b>${s.customers}</b></div><div class="rfp-biz-card"><span>VIP customers</span><b>${s.vips}</b></div><div class="rfp-biz-card"><span>Regular customers</span><b>${s.regulars}</b></div><div class="rfp-biz-card"><span>Tracked purchases</span><b>${money(s.totalSpent)}</b></div></div><div class="rfp-biz-list">${rows.length?rows.map(r=>`<details class="rfp-biz-item" style="display:block"><summary><strong>${esc(r.name)}</strong> <span>• ${esc(r.badge)} • ${r.totalPurchases} purchase${r.totalPurchases===1?"":"s"} • ${money(r.spent)}</span></summary><small>${esc(r.phone||r.email||"No contact saved")} ${r.lastPurchase?`• last purchase ${esc(r.lastPurchase)}`:""}</small><div style="margin-top:8px">${r.purchases.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(p=>`<div class="rfp-cat"><span>${esc(p.date||"No date")} • ${esc(p.type)} • ${esc(p.details)}</span><strong>${money(p.amount)}</strong></div>`).join("")||"<span class='rfp-muted'>Customer is saved but has no matched purchase history yet.</span>"}</div></details>`).join(""):"<div class='rfp-muted'>No named customer purchases are available in the staged snapshot yet.</div>"}</div></section>`;
  }
  function install(){
    const tabs=document.querySelector("#rfpBusinessModal .rfp-biz-tabs");if(!tabs||tabs.querySelector("[data-ledger-tab]"))return false;
    const b=document.createElement("button");b.type="button";b.dataset.ledgerTab="1";b.textContent="🤝 Customers";b.addEventListener("click",render);tabs.appendChild(b);return true;
  }
  function start(){if(!install())setTimeout(install,250);}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
  window.addEventListener("rfp-staging-business-changed",()=>{});
  window.StagingCustomerLedgerV1={version:1,ledger,summary,render,install,networkCalls:0,firebaseWrites:0,brand:BRAND};
  console.log("🤝 STAGING customer purchase ledger active — private, local-only, zero Firebase calls");
})();