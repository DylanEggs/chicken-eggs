import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

if (!window.CustomerBirdSalesViewV1) {
  const firebaseConfig = {
    apiKey: "AIzaSyCSruU8Sae0mFI16N2tcIh2GRLartzYhHE",
    authDomain: "chicken-eggs-53358.firebaseapp.com",
    projectId: "chicken-eggs-53358",
    storageBucket: "chicken-eggs-53358.firebasestorage.app",
    messagingSenderId: "461720066101",
    appId: "1:461720066101:web:6b19a7c4d245f399cf797c"
  };
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money = v => `$${Math.max(0, Number(v) || 0).toFixed(2)}`;
  const image = v => typeof v === "string" && (v.startsWith("data:image/") || /^https?:\/\//i.test(v)) ? v : "";
  const date = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "";
  const whole = v => Math.max(0, Math.round(Number(v) || 0));
  let rows = [];
  let unsubscribe = null;

  function safeRow(x = {}) {
    const id = String(x.id || "").slice(0,140);
    const breed = String(x.breed || "").trim().slice(0,100);
    if (!id || !breed) return null;
    const quantity = whole(x.quantity);
    let status = String(x.status || (quantity ? "Available" : "Sold Out")).trim().slice(0,30);
    if (quantity === 0 && status === "Available") status = "Sold Out";
    const rawPrice = x.price;
    const price = rawPrice === null || rawPrice === "" || rawPrice === undefined ? null : Math.max(0, Math.round((Number(rawPrice) || 0) * 100) / 100);
    return {
      id,
      breed,
      birdType:String(x.birdType || "Chicks (Straight Run)").trim().slice(0,60),
      hatchDate:date(x.hatchDate),
      age:String(x.age || "Age not listed").trim().slice(0,50),
      quantity,
      status,
      price,
      notes:String(x.notes || "").trim().slice(0,240),
      photo:image(x.photo),
      updatedAt:whole(x.updatedAt)
    };
  }
  function ensure() {
    if ($("customerBirdSales")) return $("customerBirdSales");
    const before = document.querySelector(".flock-section") || document.getElementById("installApp") || document.querySelector("footer");
    if (!before) return null;
    const section = document.createElement("section");
    section.id = "customerBirdSales";
    section.className = "section-block bird-sales-section";
    section.innerHTML = `<div class="section-heading"><div><div class="section-kicker">🐣 Available birds</div><h2>Chicks, pullets & roosters for sale</h2><p>Current birds Rose Family Poultry has available or coming soon.</p></div><span class="mini-chip" id="birdSaleCount">0 listings</span></div><div class="bird-sale-grid" id="customerBirdSaleGrid"></div><div class="empty-flock" id="customerBirdSaleEmpty">No birds are listed for sale right now. Check back after the next hatch.</div>`;
    before.parentNode.insertBefore(section, before);
    const style = document.createElement("style");
    style.id = "customerBirdSalesCss";
    style.textContent = `.bird-sale-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.bird-sale-card{background:rgba(255,255,255,.92);border:1px solid rgba(31,122,58,.12);border-radius:22px;overflow:hidden;box-shadow:0 10px 28px rgba(24,68,36,.08)}.bird-sale-photo{height:170px;display:grid;place-items:center;background:linear-gradient(135deg,#fff7df,#eef8ee);font-size:58px}.bird-sale-photo img{width:100%;height:100%;object-fit:cover}.bird-sale-body{padding:15px}.bird-sale-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.bird-sale-top strong{font-size:18px}.bird-sale-status{font-size:11px;font-weight:900;padding:6px 9px;border-radius:999px;background:#e9f7ed;color:#17652e}.bird-sale-status.sold{background:#fdecec;color:#9e2727}.bird-sale-status.soon{background:#fff4cb;color:#725700}.bird-sale-status.reserved{background:#eee8ff;color:#5c3da8}.bird-sale-meta{margin-top:7px;color:#667267;font-weight:700;line-height:1.45}.bird-sale-qty{font-size:24px;font-weight:950;margin-top:12px}.bird-sale-price{font-weight:900;color:#1f7a3a;margin-top:4px}.bird-sale-notes{margin-top:9px;line-height:1.45}`;
    document.head.appendChild(style);
    return section;
  }
  function render() {
    const section = ensure();
    if (!section) return;
    const grid = $("customerBirdSaleGrid"), empty = $("customerBirdSaleEmpty"), count = $("birdSaleCount");
    if (count) count.textContent = `${rows.length} listing${rows.length === 1 ? "" : "s"}`;
    if (empty) empty.hidden = rows.length > 0;
    if (!grid) return;
    grid.innerHTML = rows.map(row => {
      const cls = row.status === "Sold Out" ? "sold" : row.status === "Coming Soon" ? "soon" : row.status === "Reserved" ? "reserved" : "";
      const qty = row.status === "Sold Out" ? "Sold out" : row.status === "Coming Soon" && row.quantity === 0 ? "Coming soon" : `${row.quantity} available`;
      return `<article class="bird-sale-card"><div class="bird-sale-photo">${row.photo ? `<img src="${esc(row.photo)}" alt="${esc(row.breed)}">` : "🐣"}</div><div class="bird-sale-body"><div class="bird-sale-top"><strong>${esc(row.breed)}</strong><span class="bird-sale-status ${cls}">${esc(row.status)}</span></div><div class="bird-sale-meta">${esc(row.birdType)}${row.age ? ` • ${esc(row.age)}` : ""}</div><div class="bird-sale-qty">${esc(qty)}</div><div class="bird-sale-price">${row.price == null ? "Price available on request" : `${money(row.price)} each`}</div>${row.notes ? `<div class="bird-sale-notes">${esc(row.notes)}</div>` : ""}</div></article>`;
    }).join("");
  }
  function start() {
    ensure();
    unsubscribe = onSnapshot(doc(db, "public_customer", "bird_sales"), snap => {
      const data = snap.exists() ? snap.data() : {};
      rows = (Array.isArray(data?.listings) ? data.listings : []).map(safeRow).filter(Boolean).sort((a,b)=>b.updatedAt-a.updatedAt);
      render();
    }, error => {
      console.warn("Customer bird listings unavailable:", error);
      rows = [];
      render();
    });
  }

  window.CustomerBirdSalesViewV1 = { version:1, rows:()=>rows.slice(), render, stop:()=>{ try { unsubscribe?.(); } catch {} unsubscribe=null; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(start, 60), { once:true });
  else setTimeout(start, 60);
}
