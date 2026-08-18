(() => {
  "use strict";
  if (window.PublicCustomerOwnerAuth) return;

  const OWNER_UID="aLvjMpXgMJf5W3YUjQM6wqKagLo2";
  const OWNER_EMAIL="customjeepyj@gmail.com";
  const APP_NAME="rose-family-public-publisher";
  const firebaseConfig={
    apiKey:"AIzaSyCSruU8Sae0mFI16N2tcIh2GRLartzYhHE",
    authDomain:"chicken-eggs-53358.firebaseapp.com",
    projectId:"chicken-eggs-53358",
    storageBucket:"chicken-eggs-53358.firebasestorage.app",
    messagingSenderId:"461720066101",
    appId:"1:461720066101:web:6b19a7c4d245f399cf797c"
  };

  let app=null,auth=null,db=null,api=null,user=null,readyPromise=null;

  async function init(){
    if(readyPromise)return readyPromise;
    readyPromise=(async()=>{
      const appSdk=await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js");
      const authSdk=await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js");
      const fsSdk=await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
      api={appSdk,authSdk,fsSdk};
      app=appSdk.getApps().find(x=>x.name===APP_NAME)||appSdk.initializeApp(firebaseConfig,APP_NAME);
      auth=authSdk.getAuth(app);
      try{await authSdk.setPersistence(auth,authSdk.browserLocalPersistence);}catch{}
      db=fsSdk.getFirestore(app);
      await new Promise(resolve=>{
        let settled=false;
        const off=authSdk.onAuthStateChanged(auth,next=>{
          user=next||null;
          window.dispatchEvent(new CustomEvent("public-customer-owner-auth-changed",{detail:status()}));
          if(!settled){settled=true;off();resolve();}
        },()=>{if(!settled){settled=true;resolve();}});
      });
      return status();
    })();
    return readyPromise;
  }

  function isOwner(u=user){return !!u&&!u.isAnonymous&&String(u.uid||"")===OWNER_UID;}
  function status(){return {ready:!!auth,connected:isOwner(),uid:user?.uid||"",email:user?.email||"",ownerUid:OWNER_UID,ownerEmail:OWNER_EMAIL};}
  async function currentOwner(){await init();return isOwner()?user:null;}
  async function signIn(password,email=OWNER_EMAIL){
    await init();
    if(!password)throw new Error("Owner password is required");
    const credential=await api.authSdk.signInWithEmailAndPassword(auth,String(email||OWNER_EMAIL).trim(),String(password));
    user=credential.user||null;
    if(!isOwner(user)){
      try{await api.authSdk.signOut(auth);}catch{}
      user=null;
      throw new Error("This Firebase account is not the authorized farm owner");
    }
    window.dispatchEvent(new CustomEvent("public-customer-owner-auth-changed",{detail:status()}));
    return user;
  }
  async function disconnect(){await init();await api.authSdk.signOut(auth);user=null;window.dispatchEvent(new CustomEvent("public-customer-owner-auth-changed",{detail:status()}));return status();}
  async function publisherDb(){await init();return db;}

  window.PublicCustomerOwnerAuth={version:1,init,status,currentOwner,signIn,disconnect,publisherDb,ownerUid:()=>OWNER_UID,ownerEmail:()=>OWNER_EMAIL};
  void init();
})();
