(() => {
  "use strict";
  if (window.__publicCustomerSyncUiV1) return;
  window.__publicCustomerSyncUiV1 = true;

  let busy=false,lastPublish=null,postMainInitStarted=false;
  const CUSTOMER_URL="view/?v=20260818-1840";

  function status(){return window.PublicCustomerOwnerAuth?.status?.()||{ready:false,connected:false};}
  function APIsReady(){return !!window.PublicCustomerOwnerAuth && !!window.FarmPublicCustomerPublisherV1;}
  function target(){return document.getElementById("farm2Settings")||document.getElementById("farm");}

  function positionTopCards(root=target()){
    if(!root)return;
    const sync=document.getElementById("publicCustomerSyncCardV1");
    if(!sync)return;
    const backup=document.getElementById("completeSafetyBackupV3");
    const directHeader=Array.from(root.children||[]).find(el=>el.classList?.contains("screenTitle"));
    if(directHeader){directHeader.insertAdjacentElement("afterend",sync);}else{root.prepend(sync);}
    if(backup)sync.insertAdjacentElement("afterend",backup);
  }

  function css(){
    if(document.getElementById("publicCustomerSyncUiCss"))return;
    const s=document.createElement("style");s.id="publicCustomerSyncUiCss";s.textContent=`
      .pubsync-status{padding:11px 12px;border-radius:14px;background:rgba(31,122,58,.08);font-size:13px;font-weight:850;line-height:1.35;margin:10px 0}
      .pubsync-status.good{background:rgba(31,122,58,.12);color:#176b31}.pubsync-status.warn{background:rgba(245,185,28,.14);color:#8a6400}.pubsync-status.bad{background:rgba(217,59,59,.1);color:#a52d2d}
      .pubsync-row{display:flex;gap:9px;flex-wrap:wrap}.pubsync-row button{width:auto;flex:1 1 160px}.pubsync-login{display:grid;gap:8px;margin:10px 0}.pubsync-login[hidden]{display:none!important}.pubsync-login input{width:100%}
      .farm2-dark .pubsync-status.good{color:#8ae7a3}.farm2-dark .pubsync-status.warn{color:#ffd978}.farm2-dark .pubsync-status.bad{color:#ff9b9b}
    `;document.head.appendChild(s);
  }

  function ensure(){
    css();
    const existing=document.getElementById("publicCustomerSyncCardV1");
    if(existing){positionTopCards();return true;}
    const root=target();if(!root)return false;
    const card=document.createElement("div");card.id="publicCustomerSyncCardV1";card.className="farm2-card";
    card.innerHTML=`
      <h3>🌐 Customer Page Sync</h3>
      <p class="farm2-subtle">Publishes only the safe customer view: egg availability, production stats, weather/laying insights, flock profiles/photos, Chicken of the Day and fun facts. No money, expenses, customer history, notes, or private farm data are published.</p>
      <div id="publicCustomerSyncStatus" class="pubsync-status warn">Checking customer sync…</div>
      <div id="publicCustomerLoginWrap" class="pubsync-login" hidden>
        <label for="publicCustomerOwnerEmail">Owner Firebase email</label>
        <input id="publicCustomerOwnerEmail" type="email" autocomplete="username" placeholder="Owner email">
        <label for="publicCustomerOwnerPassword">Owner Firebase password</label>
        <input id="publicCustomerOwnerPassword" type="password" autocomplete="current-password" placeholder="Password is not stored">
        <button type="button" id="publicCustomerConnect">🔐 Connect Customer Updates</button>
      </div>
      <div class="pubsync-row">
        <button type="button" id="publicCustomerPublishNow" hidden>🔄 Publish Customer Page Now</button>
        <button type="button" class="secondary" id="publicCustomerOpen">👀 Open Customer View</button>
        <button type="button" class="secondary" id="publicCustomerDisconnect" hidden>Disconnect Customer Sync</button>
      </div>
      <div class="farm2-subtle" style="margin-top:9px">Once connected, safe customer data republishes automatically when eggs, inventory, flock/photos, weather, or predictions change. Your email and password are never written to farm storage.</div>`;
    root.appendChild(card);
    positionTopCards(root);
    card.querySelector("#publicCustomerConnect")?.addEventListener("click",connect);
    card.querySelector("#publicCustomerPublishNow")?.addEventListener("click",()=>publish("manual-button"));
    card.querySelector("#publicCustomerOpen")?.addEventListener("click",()=>window.open(CUSTOMER_URL,"_blank","noopener"));
    card.querySelector("#publicCustomerDisconnect")?.addEventListener("click",disconnect);
    render();return true;
  }

  function setStatus(text,kind="warn"){
    const el=document.getElementById("publicCustomerSyncStatus");if(!el)return;el.textContent=text;el.className=`pubsync-status ${kind}`;
  }
  function render(){
    if(!ensure())return;
    positionTopCards();
    const s=status();
    const wrap=document.getElementById("publicCustomerLoginWrap"),pub=document.getElementById("publicCustomerPublishNow"),disc=document.getElementById("publicCustomerDisconnect");
    if(wrap)wrap.hidden=!s.ready||!!s.connected;
    if(pub)pub.hidden=!s.connected;
    if(disc)disc.hidden=!s.connected;
    if(busy){setStatus("Customer sync is working…","warn");return;}
    if(s.connected){
      if(lastPublish?.ok)setStatus(`Connected • customer page published ${lastPublish.writes||0} update${lastPublish.writes===1?"":"s"}. Future farm changes will update automatically.`,"good");
      else if(lastPublish&&!lastPublish.ok)setStatus(`Owner connected, but publish is waiting: ${lastPublish.error||"Firebase public rules may not be ready yet."}`,"warn");
      else setStatus(`Owner customer-sync session connected${s.email?` as ${s.email}`:""}.`,"good");
    }else if(s.ready)setStatus("Customer updates are not connected yet. Enter the owner Firebase email and password once to connect.","warn");
    else setStatus("Customer sync will check after the main Firebase connection finishes.","warn");
  }

  function initAfterMainReady(){
    if(postMainInitStarted||!APIsReady())return;
    if(!window.FarmSyncSafety?.isReady?.())return;
    postMainInitStarted=true;
    setTimeout(()=>window.PublicCustomerOwnerAuth.init?.().finally(render),1200);
  }

  async function connect(){
    if(busy)return;
    const emailInput=document.getElementById("publicCustomerOwnerEmail"),passwordInput=document.getElementById("publicCustomerOwnerPassword");
    const email=String(emailInput?.value||"").trim(),password=String(passwordInput?.value||"");
    if(!email){setStatus("Enter the owner Firebase email to connect customer updates.","bad");emailInput?.focus();return;}
    if(!password){setStatus("Enter the owner Firebase password to connect customer updates.","bad");passwordInput?.focus();return;}
    busy=true;render();
    try{
      await window.PublicCustomerOwnerAuth.signIn(email,password);
      if(passwordInput)passwordInput.value="";
      if(emailInput)emailInput.value="";
      lastPublish=await window.FarmPublicCustomerPublisherV1.publishNow("owner-connected-from-ui");
    }catch(error){lastPublish={ok:false,error:String(error?.message||error)};}
    finally{busy=false;render();}
  }
  async function publish(reason="manual"){
    if(busy)return;busy=true;render();
    try{lastPublish=await window.FarmPublicCustomerPublisherV1.publishNow(reason);}catch(error){lastPublish={ok:false,error:String(error?.message||error)};}
    finally{busy=false;render();}
  }
  async function disconnect(){
    if(busy)return;busy=true;render();
    try{await window.PublicCustomerOwnerAuth.disconnect();lastPublish=null;}catch(error){lastPublish={ok:false,error:String(error?.message||error)};}
    finally{busy=false;render();}
  }

  function install(){
    if(!ensure()){
      const o=new MutationObserver(()=>{if(ensure())o.disconnect();});o.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>o.disconnect(),15000);
    }
    [250,800,1800].forEach(ms=>setTimeout(positionTopCards,ms));
    const start=Date.now();
    const wait=()=>{
      if(APIsReady()){render();initAfterMainReady();return;}
      if(Date.now()-start<12000)setTimeout(wait,100);else setStatus("Customer sync modules did not finish loading.","bad");
    };wait();
  }

  window.addEventListener("farm-sync-ready",()=>initAfterMainReady(),{once:true});
  window.addEventListener("public-customer-owner-auth-changed",render);
  window.addEventListener("customer-public-published",e=>{lastPublish=e.detail||null;render();});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(install,500),{once:true});else setTimeout(install,500);
})();
