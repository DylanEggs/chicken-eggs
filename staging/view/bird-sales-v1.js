(() => {
  "use strict";
  if (window.__StagingCustomerBirdSalesViewV1) return;
  window.__StagingCustomerBirdSalesViewV1 = true;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money=v=>`$${Math.max(0,Number(v)||0).toFixed(2)}`;

  function ensure(){
    if($("customerBirdSales"))return $("customerBirdSales");
    const before=document.querySelector(".flock-section")||document.getElementById("installApp")||document.querySelector("footer");
    if(!before)return null;
    const section=document.createElement("section");
    section.id="customerBirdSales";
    section.className="section-block bird-sales-section";
    section.innerHTML=`<div class="section-heading"><div><div class="section-kicker">🐣 Available birds</div><h2>Chicks, pullets & roosters for sale</h2><p>Current live-style staging preview of birds Rose Family Poultry has listed.</p></div><span class="mini-chip" id="birdSaleCount">0 listings</span></div><div class="bird-sale-grid" id="customerBirdSaleGrid"></div><div class="empty-flock" id="customerBirdSaleEmpty">No birds are listed for sale right now. Check back after the next hatch.</div>`;
    before.parentNode.insertBefore(section,before);
    const style=document.createElement("style");
    style.textContent=`.bird-sale-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.bird-sale-card{background:rgba(255,255,255,.92);border:1px solid rgba(31,122,58,.12);border-radius:22px;overflow:hidden;box-shadow:0 10px 28px rgba(24,68,36,.08)}.bird-sale-photo{height:170px;display:grid;place-items:center;background:linear-gradient(135deg,#fff7df,#eef8ee);font-size:58px}.bird-sale-photo img{width:100%;height:100%;object-fit:cover}.bird-sale-body{padding:15px}.bird-sale-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.bird-sale-top strong{font-size:18px}.bird-sale-status{font-size:11px;font-weight:900;padding:6px 9px;border-radius:999px;background:#e9f7ed;color:#17652e}.bird-sale-status.sold{background:#fdecec;color:#9e2727}.bird-sale-status.soon{background:#fff4cb;color:#725700}.bird-sale-meta{margin-top:7px;color:#667267;font-weight:700;line-height:1.45}.bird-sale-qty{font-size:24px;font-weight:950;margin-top:12px}.bird-sale-price{font-weight:900;color:#1f7a3a;margin-top:4px}.bird-sale-notes{margin-top:9px;line-height:1.45}.farm2-dark .bird-sale-card{background:#1d2720;color:#f5f7f3}.farm2-dark .bird-sale-meta{color:#b7c2b9}`;
    document.head.appendChild(style);
    return section;
  }
  function render(){
    const section=ensure();if(!section)return;
    const data=window.StagingCustomerPublicData?.build?.()||{};
    const rows=Array.isArray(data.birdListings)?data.birdListings:[];
    const grid=$("customerBirdSaleGrid"),empty=$("customerBirdSaleEmpty"),count=$("birdSaleCount");
    if(count)count.textContent=`${rows.length} listing${rows.length===1?"":"s"}`;
    if(empty)empty.hidden=rows.length>0;
    if(!grid)return;
    grid.innerHTML=rows.map(row=>{
      const cls=row.status==="Sold Out"?"sold":row.status==="Coming Soon"?"soon":"";
      const qty=row.status==="Sold Out"?"Sold out":`${Number(row.quantity)||0} available`;
      return `<article class="bird-sale-card"><div class="bird-sale-photo">${row.photo?`<img src="${esc(row.photo)}" alt="${esc(row.breed)}">`:"🐣"}</div><div class="bird-sale-body"><div class="bird-sale-top"><strong>${esc(row.breed)}</strong><span class="bird-sale-status ${cls}">${esc(row.status)}</span></div><div class="bird-sale-meta">${esc(row.birdType)}${row.age?` • ${esc(row.age)}`:""}</div><div class="bird-sale-qty">${esc(qty)}</div><div class="bird-sale-price">${row.price==null?"Price available on request":`${money(row.price)} each`}</div>${row.notes?`<div class="bird-sale-notes">${esc(row.notes)}</div>`:""}</div></article>`;
    }).join("");
  }
  const patch=()=>{
    if(window.CustomerViewStaging?.refresh&&!window.CustomerViewStaging.__birdSalesWrapped){
      const old=window.CustomerViewStaging.refresh.bind(window.CustomerViewStaging);
      window.CustomerViewStaging.refresh=()=>{const out=old();render();return out;};
      window.CustomerViewStaging.__birdSalesWrapped=true;
    }
    render();
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(patch,100),{once:true});else setTimeout(patch,100);
  window.addEventListener("storage",patch);
  setInterval(render,15000);
})();