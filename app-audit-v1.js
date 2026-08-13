(() => {
  "use strict";

  const APP2_KEY = "chickenEggApp2V1";
  const INVENTORY_KEY = "chickenEggInventoryV2";
  const BUSINESS_KEY = "chickenEggBusinessV1";
  const ENTRIES_KEY = "chickenEggEntriesV102";
  let rendering = false;
  let coreGuardInstalled = false;
  let showHookInstalled = false;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function n(v) { return Number(v) || 0; }
  function pos(v) { return Math.max(0, Number(v) || 0); }
  function money(v) { return "$" + n(v).toFixed(2); }
  function esc(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
  function dateToday() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
  function id(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }

  function entries() { return read(ENTRIES_KEY, []).filter(e => e && (e.type === "eggs" || e.type === "sale")); }
  function app() {
    const a = read(APP2_KEY, {});
    return {
      ...a,
      customers: Array.isArray(a.customers) ? a.customers : [],
      orders: Array.isArray(a.orders) ? a.orders : [],
      expenses: Array.isArray(a.expenses) ? a.expenses : [],
      flock: Array.isArray(a.flock) ? a.flock : [],
      chores: Array.isArray(a.chores) ? a.chores : [],
      activity: Array.isArray(a.activity) ? a.activity : [],
      saleMeta: a.saleMeta && typeof a.saleMeta === "object" ? a.saleMeta : {},
      achievements: a.achievements && typeof a.achievements === "object" ? a.achievements : {},
      goals: a.goals && typeof a.goals === "object" ? a.goals : {},
      preferences: a.preferences && typeof a.preferences === "object" ? a.preferences : {}
    };
  }
  function inventory() { return read(INVENTORY_KEY, { dozens:0, packs18:0, loose:0 }); }
  function business() {
    const b=read(BUSINESS_KEY,{});
    return { ...b, chickenSales:Array.isArray(b.chickenSales)?b.chickenSales:[], calc:b.calc&&typeof b.calc==="object"?b.calc:{} };
  }
  function saleRevenue(e) { return n(e.dozenSold)*n(e.dozenPrice) + n(e.packSold)*n(e.packPrice); }
  function eggsSold(e) { return n(e.dozenSold)*12 + n(e.packSold)*18; }
  function physical() { const s=inventory(); return Math.round(pos(s.dozens)*12 + pos(s.packs18)*18 + pos(s.loose)); }
  function reserved() { return app().orders.filter(o=>o.status==="pending").reduce((s,o)=>s+pos(o.dozen)*12+pos(o.packs18)*18,0); }
  function available() { return Math.max(0, physical()-reserved()); }
  function monthPrefix() { return dateToday().slice(0,7); }
  function yearPrefix() { return dateToday().slice(0,4); }

  function cleanGolden(a) {
    if (!a || typeof a !== "object") return a;
    delete a.goldenEggs;
    if (a.achievements && typeof a.achievements === "object") delete a.achievements.gold1;
    if (Array.isArray(a.activity)) a.activity = a.activity.filter(x => !/golden egg/i.test(String(x?.text || "")));
    return a;
  }
  function addActivity(a, icon, text) {
    a.activity = Array.isArray(a.activity) ? a.activity : [];
    a.activity.unshift({ id:id("act"), icon, text, at:Date.now(), date:dateToday() });
    a.activity = a.activity.slice(0,100);
  }
  function writeApp(a) {
    cleanGolden(a);
    a.updatedAt = Date.now();
    localStorage.setItem(APP2_KEY, JSON.stringify(a));
  }
  function writeBusiness(b) {
    b.updatedAt = Date.now();
    localStorage.setItem(BUSINESS_KEY, JSON.stringify(b));
  }

  function mergeById(a, b) {
    const map=new Map();
    for (const x of [...(Array.isArray(a)?a:[]), ...(Array.isArray(b)?b:[])]) {
      if (!x || typeof x!=="object") continue;
      const k=String(x.id || JSON.stringify(x));
      const old=map.get(k);
      const t=n(x.updatedAt||x.createdAt||x.completedAt||x.at);
      const ot=n(old?.updatedAt||old?.createdAt||old?.completedAt||old?.at);
      if (!old || t>=ot) map.set(k,x);
    }
    return [...map.values()];
  }
  function mergeMeta(base, changed) {
    const out={...(base||{})};
    for (const [k,v] of Object.entries(changed||{})) {
      const old=out[k];
      if (!old || n(v?.updatedAt)>=n(old?.updatedAt)) out[k]=v;
    }
    return out;
  }

  function repairAfterCore(before, after, deletedSaleId="") {
    const fixed={...before};
    fixed.activity=mergeById(before.activity, after.activity).sort((x,y)=>n(y.at)-n(x.at)).slice(0,100);
    fixed.achievements={...(before.achievements||{}), ...(after.achievements||{})};
    delete fixed.achievements.gold1;
    fixed.saleMeta=mergeMeta(before.saleMeta, after.saleMeta);
    if (deletedSaleId) delete fixed.saleMeta[String(deletedSaleId)];
    cleanGolden(fixed);
    writeApp(fixed);
  }

  function installCoreGuard() {
    if (coreGuardInstalled) return;
    if (typeof window.saveEggs!=="function" || typeof window.saveSale!=="function" || typeof window.deleteEntry!=="function") {
      setTimeout(installCoreGuard,100); return;
    }
    coreGuardInstalled=true;

    const eggOriginal=window.saveEggs;
    window.saveEggs=function(){
      const before=app();
      const r=eggOriginal.apply(this,arguments);
      repairAfterCore(before,app());
      scheduleRender();
      return r;
    };
    window.saveEggs.__auditGuard=true;

    const saleOriginal=window.saveSale;
    window.saveSale=function(){
      const before=app();
      const r=saleOriginal.apply(this,arguments);
      repairAfterCore(before,app());
      scheduleRender();
      return r;
    };
    window.saveSale.__auditGuard=true;

    const deleteOriginal=window.deleteEntry;
    window.deleteEntry=function(id){
      const before=app();
      const r=deleteOriginal.apply(this,arguments);
      repairAfterCore(before,app(),String(id||""));
      scheduleRender();
      return r;
    };
    window.deleteEntry.__auditGuard=true;
  }

  function customerStats(a, customerId) {
    const list=entries().filter(e=>e.type==="sale" && a.saleMeta[e.id]?.customerId===customerId);
    return {
      sales:list.length,
      eggs:list.reduce((s,e)=>s+eggsSold(e),0),
      spent:list.reduce((s,e)=>s+saleRevenue(e),0),
      unpaid:list.reduce((s,e)=>s+(a.saleMeta[e.id]?.paid===false?saleRevenue(e):0),0),
      last:list.map(e=>String(e.date||"")).sort().reverse()[0]||""
    };
  }
  function unpaidTotal(a=app()) { return entries().filter(e=>e.type==="sale").reduce((s,e)=>s+(a.saleMeta[e.id]?.paid===false?saleRevenue(e):0),0); }

  function renderCustomers() {
    const a=app(), sum=document.getElementById("farm2CustomerSummary"), list=document.getElementById("farm2CustomerList");
    if (!sum||!list) return;
    sum.innerHTML=`<div class="farm2-grid2"><div class="farm2-card"><div class="farm2-kicker">Customers</div><div class="farm2-moneyBig">${a.customers.length}</div></div><div class="farm2-card"><div class="farm2-kicker">Still Owed</div><div class="farm2-moneyBig">${money(unpaidTotal(a))}</div></div></div>`;
    const rows=[...a.customers].sort((x,y)=>String(x.name||"").localeCompare(String(y.name||"")));
    list.innerHTML=rows.length?rows.map(c=>{const s=customerStats(a,c.id);return `<div class="farm2-listItem"><div class="farm2-listTop"><div><h4>🤝 ${esc(c.name)}</h4><div class="farm2-subtle">${esc(c.contact||"No contact saved")}</div></div>${s.unpaid?`<span class="farm2-badge red">Owes ${money(s.unpaid)}</span>`:`<span class="farm2-badge">Paid up</span>`}</div><div class="farm2-subtle" style="margin-top:9px">${s.sales} sales • ${s.eggs} eggs • ${money(s.spent)} lifetime${s.last?` • Last ${esc(s.last)}`:""}</div>${c.price?`<div class="farm2-subtle">Usual dozen price: ${money(c.price)}</div>`:""}${c.notes?`<div class="farm2-subtle">📝 ${esc(c.notes)}</div>`:""}<div class="farm2-actions"><button onclick="farm2UseCustomer('${esc(c.id)}')">Record Sale</button><button class="farm2-delete" onclick="farm2DeleteCustomer('${esc(c.id)}')">Delete</button></div></div>`}).join(""):`<div class="farm2-empty">No customers yet. Add your first regular above.</div>`;
  }

  function renderOrders() {
    const a=app(), pending=a.orders.filter(o=>o.status==="pending"), sum=document.getElementById("farm2OrderSummary"), list=document.getElementById("farm2OrderList");
    if (!sum||!list) return;
    sum.innerHTML=`<div class="farm2-grid3"><div class="farm2-card"><div class="farm2-kicker">Open Orders</div><div class="farm2-moneyBig">${pending.length}</div></div><div class="farm2-card"><div class="farm2-kicker">Eggs Reserved</div><div class="farm2-moneyBig">${reserved()}</div></div><div class="farm2-card"><div class="farm2-kicker">Still Available</div><div class="farm2-moneyBig">${available()}</div></div></div>`;
    const rows=[...a.orders].sort((x,y)=>(x.status==="pending"?0:1)-(y.status==="pending"?0:1)||String(x.dueDate||"").localeCompare(String(y.dueDate||"")));
    list.innerHTML=rows.length?rows.map(o=>{const c=a.customers.find(x=>x.id===o.customerId), count=pos(o.dozen)*12+pos(o.packs18)*18;return `<div class="farm2-listItem"><div class="farm2-listTop"><div><h4>📦 ${esc(c?.name||"Unassigned Order")}</h4><div class="farm2-subtle">Due ${esc(o.dueDate||"No date")} • ${pos(o.dozen)} dozen • ${pos(o.packs18)} 18-packs (${count} eggs)</div></div><span class="farm2-badge ${o.status==="pending"?"gold":""}">${esc(o.status||"")}</span></div>${o.notes?`<div class="farm2-subtle" style="margin-top:8px">📝 ${esc(o.notes)}</div>`:""}<div class="farm2-actions">${o.status==="pending"?`<button onclick="farm2CompleteOrder('${esc(o.id)}')">✓ Fulfilled</button>`:""}<button class="farm2-delete" onclick="farm2DeleteOrder('${esc(o.id)}')">Delete</button></div></div>`}).join(""):`<div class="farm2-empty">No reserved orders yet.</div>`;
  }

  function businessStats(prefix="") {
    const b=business(), a=app();
    const saleList=entries().filter(e=>e.type==="sale" && (!prefix || String(e.date||"").startsWith(prefix)));
    const egg=saleList.reduce((s,e)=>s+saleRevenue(e),0);
    const chicken=b.chickenSales.filter(e=>!prefix||String(e.date||"").startsWith(prefix)).reduce((s,e)=>s+n(e.total),0);
    const ex=a.expenses.filter(e=>!prefix||String(e.date||"").startsWith(prefix));
    const feed=ex.filter(e=>String(e.category||"").toLowerCase()==="feed").reduce((s,e)=>s+n(e.amount),0);
    const supplies=ex.filter(e=>String(e.category||"").toLowerCase()!=="feed").reduce((s,e)=>s+n(e.amount),0);
    return {egg,chicken,feed,supplies,income:egg+chicken,costs:feed+supplies,net:egg+chicken-feed-supplies};
  }

  function renderExpenses() {
    const a=app(), sum=document.getElementById("farm2ProfitSummary"), list=document.getElementById("farm2ExpenseList");
    if (!sum||!list) return;
    const m=businessStats(monthPrefix()), y=businessStats(yearPrefix());
    sum.innerHTML=`<div class="farm2-grid3"><div class="farm2-card"><div class="farm2-kicker">Month Revenue</div><div class="farm2-moneyBig">${money(m.income)}</div></div><div class="farm2-card"><div class="farm2-kicker">Month Expenses</div><div class="farm2-moneyBig">${money(m.costs)}</div></div><div class="farm2-card"><div class="farm2-kicker">Month Profit</div><div class="farm2-moneyBig">${money(m.net)}</div></div></div><div class="farm2-card"><b>Year to date:</b> ${money(y.income)} income − ${money(y.costs)} tracked expenses = <b>${money(y.net)}</b> net</div>`;
    const rows=[...a.expenses].sort((x,y)=>String(y.date||"").localeCompare(String(x.date||"")));
    list.innerHTML=rows.length?rows.map(e=>`<div class="farm2-listItem"><div class="farm2-listTop"><div><h4>${String(e.category||"").toLowerCase()==="feed"?"🌽":"🧾"} ${esc(e.category||"Other")}</h4><div class="farm2-subtle">${esc(e.date||"")} • ${esc(e.description||"")}</div></div><div class="farm2-moneyBig" style="font-size:23px">${money(e.amount)}</div></div><div class="farm2-actions"><button class="farm2-delete" onclick="farm2DeleteExpense('${esc(e.id)}')">Delete</button></div></div>`).join(""):`<div class="farm2-empty">No expenses tracked yet.</div>`;
  }

  function ageText(d) {
    if (!d) return "Age unknown";
    const born=new Date(String(d)+"T12:00:00"), now=new Date();
    if (Number.isNaN(born.getTime())) return "Age unknown";
    const days=Math.max(0,Math.floor((now-born)/86400000));
    if (days<14) return `${days} days`;
    if (days<112) return `${Math.floor(days/7)} weeks`;
    const months=Math.floor(days/30.44); return months<24?`${months} months`:`${Math.floor(months/12)}y ${months%12}m`;
  }
  function renderFlock() {
    const a=app(), sum=document.getElementById("farm2FlockSummary"), list=document.getElementById("farm2FlockList");
    if(!sum||!list)return;
    const hens=a.flock.filter(b=>["Hen","Pullet"].includes(b.sex)).length, roos=a.flock.filter(b=>["Rooster","Cockerel"].includes(b.sex)).length;
    sum.innerHTML=`<div class="farm2-grid3"><div class="farm2-card"><div class="farm2-kicker">Profiles</div><div class="farm2-moneyBig">${a.flock.length}</div></div><div class="farm2-card"><div class="farm2-kicker">Hens/Pullets</div><div class="farm2-moneyBig">${hens}</div></div><div class="farm2-card"><div class="farm2-kicker">Roosters</div><div class="farm2-moneyBig">${roos}</div></div></div>`;
    list.innerHTML=a.flock.length?[...a.flock].sort((x,y)=>String(x.name||"").localeCompare(String(y.name||""))).map(b=>`<div class="farm2-listItem"><div class="farm2-listTop"><div><h4>${["Rooster","Cockerel"].includes(b.sex)?"🐓":"🐔"} ${esc(b.name)}</h4><div class="farm2-subtle">${esc(b.breed||"Breed not set")} • ${esc(b.sex||"Unknown")} • ${ageText(b.hatchDate)}</div></div><span class="farm2-badge purple">${esc(b.status||"Active")}</span></div>${b.notes?`<div class="farm2-subtle">📝 ${esc(b.notes)}</div>`:""}<div class="farm2-actions"><button class="farm2-delete" onclick="farm2DeleteBird('${esc(b.id)}')">Delete</button></div></div>`).join(""):`<div class="farm2-empty">No profiles yet.</div>`;
  }

  function nextChoreDate(date, repeat) {
    const d=new Date((date||dateToday())+"T12:00:00");
    if(repeat==="daily")d.setDate(d.getDate()+1); else if(repeat==="weekly")d.setDate(d.getDate()+7); else if(repeat==="monthly")d.setMonth(d.getMonth()+1); else return "";
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function renderChores() {
    const a=app(), list=document.getElementById("farm2ChoreList"); if(!list)return;
    const rows=[...a.chores].sort((x,y)=>String(x.dueDate||"").localeCompare(String(y.dueDate||"")));
    list.innerHTML=rows.length?rows.map(c=>{const overdue=c.dueDate&&c.dueDate<dateToday();return `<div class="farm2-listItem"><div class="farm2-listTop"><div><h4>${overdue?"⚠️":"✅"} ${esc(c.name)}</h4><div class="farm2-subtle">Due ${esc(c.dueDate||"Anytime")} • ${esc(c.repeat||"once")}</div></div>${overdue?`<span class="farm2-badge red">Overdue</span>`:`<span class="farm2-badge">Open</span>`}</div><div class="farm2-actions"><button onclick="farm2CompleteChore('${esc(c.id)}')">✓ Done</button><button class="farm2-delete" onclick="farm2DeleteChore('${esc(c.id)}')">Delete</button></div></div>`}).join(""):`<div class="farm2-empty">No chores waiting.</div>`;
  }

  function patchCustomerSelects() {
    const a=app();
    [["farm2SaleCustomer","Walk-in / no customer"],["farm2OrderCustomer","Choose customer"]].forEach(([id,first])=>{
      const el=document.getElementById(id); if(!el)return;
      const current=el.value;
      el.innerHTML=`<option value="">${first}</option>`+a.customers.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
      if([...el.options].some(o=>o.value===current))el.value=current;
    });
  }

  function renderHub() {
    const m=businessStats(monthPrefix()), a=app(), hub=document.getElementById("farm2HubSummary");
    if(hub){const cards=hub.querySelectorAll(".farm2-grid2 .farm2-card");if(cards[1])cards[1].innerHTML=`<div class="farm2-kicker">This Month • Full Farm</div><div class="farm2-moneyBig">${money(m.net)}</div><div class="farm2-subtle">${money(m.income)} income − ${money(m.costs)} expenses</div>`;}
    document.querySelectorAll("#farm2HubSummary .farm2-badge").forEach(b=>{if(/Golden Eggs?/i.test(b.textContent||""))b.remove();});
    const unpaid=unpaidTotal(a);
    document.querySelectorAll("#farm2HubSummary .farm2-badge").forEach(b=>{if(/unpaid/i.test(b.textContent||""))b.textContent=`💳 ${money(unpaid)} unpaid`;});
  }

  function installAppActions() {
    window.farm2AddCustomer=()=>{const a=app(),name=document.getElementById("farm2CustomerName")?.value.trim();if(!name){alert("Enter a customer name.");return;}a.customers.push({id:id("cust"),name,contact:document.getElementById("farm2CustomerContact")?.value.trim()||"",price:pos(document.getElementById("farm2CustomerPrice")?.value),notes:document.getElementById("farm2CustomerNotes")?.value.trim()||"",createdAt:Date.now()});addActivity(a,"🤝",`Added customer ${name}`);writeApp(a);["farm2CustomerName","farm2CustomerContact","farm2CustomerPrice","farm2CustomerNotes"].forEach(k=>{const e=document.getElementById(k);if(e)e.value="";});scheduleRender();};
    window.farm2DeleteCustomer=cid=>{if(!confirm("Delete this customer profile? Sales history stays."))return;const a=app();a.customers=a.customers.filter(c=>c.id!==cid);a.orders=a.orders.map(o=>o.customerId===cid?{...o,customerId:""}:o);writeApp(a);scheduleRender();};
    window.farm2UseCustomer=cid=>{window.showScreen?.("sale");const a=app(),c=a.customers.find(x=>x.id===cid),sel=document.getElementById("farm2SaleCustomer");if(sel)sel.value=cid;if(c?.price&&document.getElementById("dozenPrice"))document.getElementById("dozenPrice").value=c.price;};
    window.farm2AddOrder=()=>{const a=app(),dozen=pos(document.getElementById("farm2OrderDozen")?.value),packs18=pos(document.getElementById("farm2OrderPacks")?.value),requested=dozen*12+packs18*18;if(requested<=0){alert("Enter an order quantity.");return;}if(requested>available()){alert(`Only ${available()} eggs are currently available after existing reservations.`);return;}const dueDate=document.getElementById("farm2OrderDate")?.value||dateToday();a.orders.push({id:id("ord"),customerId:document.getElementById("farm2OrderCustomer")?.value||"",dueDate,dozen,packs18,notes:document.getElementById("farm2OrderNotes")?.value.trim()||"",status:"pending",createdAt:Date.now()});addActivity(a,"📦",`Reserved ${requested} eggs for ${dueDate}`);writeApp(a);["farm2OrderDozen","farm2OrderPacks","farm2OrderNotes"].forEach(k=>{const e=document.getElementById(k);if(e)e.value="";});scheduleRender();};
    window.farm2CompleteOrder=oid=>{const a=app(),o=a.orders.find(x=>x.id===oid);if(!o)return;o.status="fulfilled";o.completedAt=Date.now();o.updatedAt=Date.now();addActivity(a,"✅",`Fulfilled reserved order for ${o.dueDate||""}`);writeApp(a);scheduleRender();};
    window.farm2DeleteOrder=oid=>{if(!confirm("Delete this order?"))return;const a=app();a.orders=a.orders.filter(o=>o.id!==oid);writeApp(a);scheduleRender();};
    window.farm2AddExpense=()=>{const amount=pos(document.getElementById("farm2ExpenseAmount")?.value);if(amount<=0){alert("Enter the expense amount.");return;}const a=app(),category=document.getElementById("farm2ExpenseCategory")?.value||"Other",description=document.getElementById("farm2ExpenseDesc")?.value.trim()||"",date=document.getElementById("farm2ExpenseDate")?.value||dateToday();a.expenses.push({id:id("exp"),date,category,description,amount,createdAt:Date.now(),updatedAt:Date.now()});addActivity(a,"🧾",`${category} expense ${money(amount)}`);writeApp(a);const amountEl=document.getElementById("farm2ExpenseAmount"),descEl=document.getElementById("farm2ExpenseDesc");if(amountEl)amountEl.value="";if(descEl)descEl.value="";scheduleRender();};
    window.farm2DeleteExpense=eid=>{if(!confirm("Delete this expense?"))return;const a=app();a.expenses=a.expenses.filter(e=>e.id!==eid);writeApp(a);scheduleRender();};
    window.farm2AddBird=()=>{const name=document.getElementById("farm2BirdName")?.value.trim();if(!name){alert("Enter the chicken's name.");return;}const a=app();a.flock.push({id:id("bird"),name,breed:document.getElementById("farm2BirdBreed")?.value.trim()||"",hatchDate:document.getElementById("farm2BirdDate")?.value||"",sex:document.getElementById("farm2BirdSex")?.value||"Unknown",status:"Active",notes:document.getElementById("farm2BirdNotes")?.value.trim()||"",createdAt:Date.now(),updatedAt:Date.now()});addActivity(a,"🐔",`Added ${name} to flock profiles`);writeApp(a);["farm2BirdName","farm2BirdBreed","farm2BirdDate","farm2BirdNotes"].forEach(k=>{const e=document.getElementById(k);if(e)e.value="";});scheduleRender();};
    window.farm2DeleteBird=bid=>{if(!confirm("Delete this flock profile?"))return;const a=app();a.flock=a.flock.filter(b=>b.id!==bid);writeApp(a);scheduleRender();};
    window.farm2AddChore=()=>{const name=document.getElementById("farm2ChoreName")?.value.trim();if(!name){alert("Enter a chore.");return;}const a=app();a.chores.push({id:id("chore"),name,dueDate:document.getElementById("farm2ChoreDate")?.value||dateToday(),repeat:document.getElementById("farm2ChoreRepeat")?.value||"once",createdAt:Date.now(),updatedAt:Date.now()});addActivity(a,"✅",`Added chore: ${name}`);writeApp(a);const e=document.getElementById("farm2ChoreName");if(e)e.value="";scheduleRender();};
    window.farm2CompleteChore=cid=>{const a=app(),c=a.chores.find(x=>x.id===cid);if(!c)return;const next=nextChoreDate(c.dueDate,c.repeat);addActivity(a,"✅",`Completed chore: ${c.name}`);if(next){c.dueDate=next;c.updatedAt=Date.now();}else a.chores=a.chores.filter(x=>x.id!==cid);writeApp(a);scheduleRender();};
    window.farm2DeleteChore=cid=>{const a=app();a.chores=a.chores.filter(c=>c.id!==cid);writeApp(a);scheduleRender();};
    window.farm2SaveGoals=()=>{const a=app();a.goals={...(a.goals||{}),monthlyEggs:pos(document.getElementById("farm2GoalEggs")?.value),monthlyRevenue:pos(document.getElementById("farm2GoalRevenue")?.value)};addActivity(a,"🎯","Updated monthly goals");writeApp(a);scheduleRender();};
    window.farm2SettingsChanged=()=>{const a=app();a.preferences={...(a.preferences||{}),mode:document.getElementById("farm2Mode")?.value||"auto",holiday:document.getElementById("farm2Holiday")?.value||"auto",surprises:!!document.getElementById("farm2Surprises")?.checked,sounds:!!document.getElementById("farm2Sounds")?.checked};writeApp(a);document.body.classList.toggle("farm2-dark",a.preferences.mode==="dark"||(a.preferences.mode==="auto"&&window.matchMedia?.("(prefers-color-scheme: dark)").matches));scheduleRender();};
  }

  function ensureBusinessCard() {
    const old=document.getElementById("bizHome"); if(!old)return null;
    old.style.display="none";
    let card=document.getElementById("auditBizHome");
    if(!card){card=document.createElement("div");card.id="auditBizHome";card.className="biz-card";old.insertAdjacentElement("afterend",card);card.innerHTML=`<div class="farm2-sectionHeader"><div><div class="farm2-kicker">This Month • Farm Business</div><h3>Sales vs Feed & Supplies</h3></div><span id="auditMonthBadge" class="farm2-badge gold">PROFIT</span></div><div class="biz-grid"><div class="biz-stat"><b id="auditEggSales">$0.00</b><span>Egg Sales</span></div><div class="biz-stat"><b id="auditChickenSales">$0.00</b><span>Chicken Sales</span></div><div class="biz-stat"><b id="auditFeed">$0.00</b><span>Feed Cost</span></div><div class="biz-stat"><b id="auditSupplies">$0.00</b><span>Other Supplies</span></div><div class="biz-stat"><b id="auditIncome">$0.00</b><span>Total Income</span></div><div class="biz-stat"><b id="auditCosts">$0.00</b><span>Total Costs</span></div></div><div id="auditNetWrap" class="biz-good" style="margin-top:13px"><div class="farm2-kicker">Net Profit / Loss</div><div id="auditNet" class="biz-net">$0.00</div></div><details id="auditCalcDetails" style="margin-top:8px"><summary style="font-weight:900;cursor:pointer">🧮 Profit / Loss Calculator</summary><div class="biz-form" style="margin-top:12px"><div><label>Egg Sales</label><input id="auditCalcEgg" type="number" step=".01"></div><div><label>Chicken Sales</label><input id="auditCalcChicken" type="number" step=".01"></div><div><label>Feed Cost</label><input id="auditCalcFeed" type="number" step=".01"></div><div><label>Other Supplies</label><input id="auditCalcSupplies" type="number" step=".01"></div></div><button id="auditUseMonth" class="secondary" type="button">Use This Month's Numbers</button><div id="auditCalcResult" class="biz-net" style="font-size:24px">Profit / Loss: $0.00</div></details>`;
      const map={auditCalcEgg:"eggSales",auditCalcChicken:"chickenSales",auditCalcFeed:"feed",auditCalcSupplies:"supplies"};
      Object.entries(map).forEach(([eid,key])=>{const e=document.getElementById(eid);if(!e)return;const b=business();e.value=b.calc?.[key]??"";e.addEventListener("input",()=>{const z=business();z.calc={...(z.calc||{}),[key]:e.value};writeBusiness(z);renderCalc();});});
      document.getElementById("auditUseMonth")?.addEventListener("click",()=>{const m=businessStats(monthPrefix()),z=business();z.calc={eggSales:m.egg,chickenSales:m.chicken,feed:m.feed,supplies:m.supplies};writeBusiness(z);for(const [eid,key] of Object.entries(map)){const e=document.getElementById(eid);if(e)e.value=z.calc[key];}renderCalc();});
    }
    return card;
  }
  function renderCalc(){const b=business(),c=b.calc||{},net=n(c.eggSales)+n(c.chickenSales)-n(c.feed)-n(c.supplies),e=document.getElementById("auditCalcResult");if(e){e.className=`biz-net ${net>=0?"biz-good":"biz-bad"}`;e.textContent=`${net>=0?"Profit":"Loss"}: ${net>=0?"+":""}${money(net)}`;}}
  function renderBusinessCard(){if(!ensureBusinessCard())return;const m=businessStats(monthPrefix());const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};set("auditEggSales",money(m.egg));set("auditChickenSales",money(m.chicken));set("auditFeed",money(m.feed));set("auditSupplies",money(m.supplies));set("auditIncome",money(m.income));set("auditCosts",money(m.costs));set("auditNet",`${m.net>=0?"+":""}${money(m.net)}`);const w=document.getElementById("auditNetWrap");if(w)w.className=m.net>=0?"biz-good":"biz-bad";const badge=document.getElementById("auditMonthBadge");if(badge){badge.textContent=m.net>=0?"PROFIT":"LOSS";badge.className=`farm2-badge ${m.net<0?"red":"gold"}`;}renderCalc();}

  function renderChickenSales() {
    const b=business(), s=document.getElementById("bizChickenSummary"), h=document.getElementById("bizChickenHistory"); if(!s||!h)return;
    const month=b.chickenSales.filter(x=>String(x.date||"").startsWith(monthPrefix())),mr=month.reduce((a,x)=>a+n(x.total),0),life=b.chickenSales.reduce((a,x)=>a+n(x.total),0),birds=b.chickenSales.reduce((a,x)=>a+n(x.qty),0);
    s.innerHTML=`<div class="biz-grid"><div class="biz-card biz-stat"><b>${birds}</b><span>Birds Sold</span></div><div class="biz-card biz-stat"><b>${money(mr)}</b><span>This Month</span></div><div class="biz-card biz-stat"><b>${money(life)}</b><span>Lifetime Chicken Sales</span></div></div>`;
    const rows=b.chickenSales.length ? b.chickenSales.map(x=>`<div class="biz-row"><b>${esc(x.date)} • ${esc(x.description)}</b><div>${pos(x.qty)} × ${money(x.price)} = <strong>${money(x.total)}</strong>${x.buyer?` • ${esc(x.buyer)}`:""}</div>${x.notes?`<div class="farm2-subtle">${esc(x.notes)}</div>`:""}<button class="farm2-delete" onclick="bizDeleteChickenSale('${esc(x.id)}')">Delete</button></div>`).join("") : `<div class="farm2-empty">No chicken sales yet.</div>`;
    h.innerHTML=`<h3>🐔 Chicken Sale History</h3>${rows}`;
  }
  function installBusinessActions(){
    window.bizSaveChickenSale=()=>{const b=business(),date=document.getElementById("bizChickenDate")?.value||dateToday(),description=document.getElementById("bizChickenDesc")?.value.trim()||"Chicken",qty=Math.max(1,Math.round(pos(document.getElementById("bizChickenQty")?.value)||1)),price=pos(document.getElementById("bizChickenPrice")?.value),buyer=document.getElementById("bizChickenBuyer")?.value.trim()||"",notes=document.getElementById("bizChickenNotes")?.value.trim()||"";b.chickenSales.unshift({id:id("birdsale"),date,description,qty,price,total:qty*price,buyer,notes,createdAt:Date.now(),updatedAt:Date.now()});writeBusiness(b);["bizChickenDesc","bizChickenPrice","bizChickenBuyer","bizChickenNotes"].forEach(k=>{const e=document.getElementById(k);if(e)e.value="";});const q=document.getElementById("bizChickenQty");if(q)q.value=1;scheduleRender();};
    window.bizDeleteChickenSale=cid=>{if(!confirm("Delete this chicken sale?"))return;const b=business();b.chickenSales=b.chickenSales.filter(x=>x.id!==cid);writeBusiness(b);scheduleRender();};
  }

  function renderSettings(){const a=app();const mode=document.getElementById("farm2Mode"),holiday=document.getElementById("farm2Holiday"),surprises=document.getElementById("farm2Surprises"),sounds=document.getElementById("farm2Sounds");if(mode&&document.activeElement!==mode)mode.value=a.preferences.mode||"auto";if(holiday&&document.activeElement!==holiday)holiday.value=a.preferences.holiday||"auto";if(surprises)surprises.checked=!!a.preferences.surprises;if(sounds)sounds.checked=!!a.preferences.sounds;}

  function renderAll(){if(rendering)return;rendering=true;try{renderCustomers();renderOrders();renderExpenses();renderFlock();renderChores();patchCustomerSelects();renderHub();renderBusinessCard();renderChickenSales();renderSettings();}finally{rendering=false;}}
  function scheduleRender(){requestAnimationFrame(renderAll);}

  function installShowHook(){if(showHookInstalled)return;if(typeof window.showScreen!=="function"){setTimeout(installShowHook,100);return;}showHookInstalled=true;const original=window.showScreen;window.showScreen=function(){const r=original.apply(this,arguments);setTimeout(renderAll,0);return r;};window.showScreen.__auditHook=true;}

  function watchOldRenderers(){["bizChickenSummary","bizChickenHistory","farm2CustomerList","farm2OrderList","farm2ExpenseList","farm2FlockList","farm2ChoreList"].forEach(id=>{const attach=()=>{const el=document.getElementById(id);if(!el){setTimeout(attach,300);return;}const o=new MutationObserver(()=>{if(!rendering)scheduleRender();});o.observe(el,{childList:true,subtree:true,characterData:true});};attach();});}

  function init(){installCoreGuard();installAppActions();installBusinessActions();installShowHook();renderAll();watchOldRenderers();window.addEventListener("farm-data-synced",scheduleRender);window.addEventListener("core-data-synced",scheduleRender);window.addEventListener("storage",e=>{if([APP2_KEY,INVENTORY_KEY,BUSINESS_KEY,ENTRIES_KEY].includes(e.key))scheduleRender();});console.log("✅ Full farm audit guard active");}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(init,900));else setTimeout(init,900);
})();
