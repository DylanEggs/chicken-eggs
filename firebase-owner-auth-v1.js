import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

if (!window.FarmOwnerAuth) {
  const OWNER_UID = "aLvjMpXgMJf5W3YUjQM6wqKagLo2";
  const firebaseConfig = {
    apiKey: "AIzaSyCSruU8Sae0mFI16N2tcIh2GRLartzYhHE",
    authDomain: "chicken-eggs-53358.firebaseapp.com",
    projectId: "chicken-eggs-53358",
    storageBucket: "chicken-eggs-53358.firebasestorage.app",
    messagingSenderId: "461720066101",
    appId: "1:461720066101:web:6b19a7c4d245f399cf797c"
  };

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  let gatePromise = null;
  let gateResolve = null;
  let lastUser = null;

  function isOwner(user) {
    return !!(user && !user.isAnonymous && String(user.uid || "") === OWNER_UID);
  }

  function css() {
    if (document.getElementById("farmOwnerAuthCss")) return;
    const style = document.createElement("style");
    style.id = "farmOwnerAuthCss";
    style.textContent = `
      #farmOwnerAuthGate{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:20px;background:linear-gradient(150deg,#fff7df,#eef8ee);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif;color:#17351f}
      #farmOwnerAuthGate[hidden]{display:none!important}
      #farmOwnerAuthCard{width:min(100%,420px);padding:26px;border-radius:28px;background:#fff;box-shadow:0 24px 70px rgba(24,68,36,.18);border:1px solid rgba(31,122,58,.12)}
      #farmOwnerAuthCard .authLogo{width:64px;height:64px;display:grid;place-items:center;margin-bottom:14px;border-radius:22px;background:linear-gradient(145deg,#ffe796,#f5b91c);font-size:36px}
      #farmOwnerAuthCard h1{margin:0 0 5px;font-size:28px;letter-spacing:-.5px}
      #farmOwnerAuthCard p{margin:0 0 18px;color:#758278;line-height:1.45;font-weight:650}
      #farmOwnerAuthCard label{display:block;margin:12px 0 6px;font-size:12px;font-weight:900;color:#526b57}
      #farmOwnerAuthCard input{width:100%;min-height:52px;padding:12px 14px;border:1.5px solid rgba(31,122,58,.16);border-radius:16px;background:#fbfdfb;font:inherit;font-size:16px;color:#17351f}
      #farmOwnerAuthCard input:focus{outline:none;box-shadow:0 0 0 4px rgba(31,122,58,.12);border-color:#4fcb75}
      #farmOwnerAuthCard button{width:100%;min-height:52px;margin-top:16px;border:0;border-radius:16px;background:#1f7a3a;color:#fff;font:inherit;font-weight:900;cursor:pointer}
      #farmOwnerAuthCard button:disabled{opacity:.6;cursor:wait}
      #farmOwnerAuthError{min-height:20px;margin-top:10px!important;color:#b33131!important;font-size:12px;font-weight:850}
      #farmOwnerAuthCard small{display:block;margin-top:14px;color:#839086;line-height:1.4;text-align:center}
    `;
    document.head.appendChild(style);
  }

  function gate() {
    css();
    let root = document.getElementById("farmOwnerAuthGate");
    if (root) return root;
    root = document.createElement("div");
    root.id = "farmOwnerAuthGate";
    root.innerHTML = `
      <form id="farmOwnerAuthCard" autocomplete="on">
        <div class="authLogo">🐔</div>
        <h1>Private Farm Login</h1>
        <p>This side of Rose Family Poultry is for farm owners only.</p>
        <label for="farmOwnerEmail">Email</label>
        <input id="farmOwnerEmail" name="email" type="email" autocomplete="username" inputmode="email" required />
        <label for="farmOwnerPassword">Password</label>
        <input id="farmOwnerPassword" name="password" type="password" autocomplete="current-password" required />
        <button id="farmOwnerLoginButton" type="submit">Sign In</button>
        <p id="farmOwnerAuthError" role="alert"></p>
        <small>Your password stays with Firebase Authentication and is never stored in the farm app code.</small>
      </form>`;
    document.body.appendChild(root);
    root.querySelector("form")?.addEventListener("submit", handleSubmit);
    return root;
  }

  function messageFor(error) {
    const code = String(error?.code || "");
    if (code === "farm/not-owner") return "That Firebase account is not authorized to manage this farm.";
    if (/invalid-credential|wrong-password|user-not-found/.test(code)) return "Email or password was not accepted.";
    if (/too-many-requests/.test(code)) return "Too many attempts. Wait a little while and try again.";
    if (/network-request-failed/.test(code)) return "Internet connection problem. Try again when you are online.";
    if (/operation-not-allowed/.test(code)) return "Owner email login is not enabled in Firebase yet.";
    return "Could not sign in. Check your email and password and try again.";
  }

  async function handleSubmit(event) {
    event?.preventDefault?.();
    const root = gate();
    const email = root.querySelector("#farmOwnerEmail")?.value?.trim() || "";
    const password = root.querySelector("#farmOwnerPassword")?.value || "";
    const button = root.querySelector("#farmOwnerLoginButton");
    const errorBox = root.querySelector("#farmOwnerAuthError");
    if (!email || !password) return;
    if (button) { button.disabled = true; button.textContent = "Signing In…"; }
    if (errorBox) errorBox.textContent = "";
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      if (!isOwner(result?.user)) {
        await signOut(auth).catch(() => {});
        const error = new Error("Not authorized owner UID");
        error.code = "farm/not-owner";
        throw error;
      }
    } catch (error) {
      console.warn("Owner sign-in failed:", error?.code || error?.message || error);
      if (errorBox) errorBox.textContent = messageFor(error);
    } finally {
      if (button) { button.disabled = false; button.textContent = "Sign In"; }
    }
  }

  function show() {
    const root = gate();
    root.hidden = false;
    document.documentElement.dataset.farmOwnerLocked = "true";
    setTimeout(() => root.querySelector("#farmOwnerEmail")?.focus(), 0);
  }

  function hide() {
    const root = document.getElementById("farmOwnerAuthGate");
    if (root) root.hidden = true;
    delete document.documentElement.dataset.farmOwnerLocked;
  }

  function requireSignIn() {
    if (isOwner(auth.currentUser)) {
      lastUser = auth.currentUser;
      hide();
      return Promise.resolve(auth.currentUser);
    }
    if (!gatePromise) gatePromise = new Promise(resolve => { gateResolve = resolve; });
    show();
    return gatePromise;
  }

  async function logout() {
    await signOut(auth);
    lastUser = null;
    gatePromise = null;
    gateResolve = null;
    show();
  }

  onAuthStateChanged(auth, async user => {
    if (user && !isOwner(user)) {
      try { await signOut(auth); } catch {}
      show();
      return;
    }
    if (isOwner(user)) {
      lastUser = user;
      hide();
      gateResolve?.(user);
      gateResolve = null;
      return;
    }
    show();
  });

  window.FarmOwnerAuth = {
    version: 2,
    ownerUid: () => OWNER_UID,
    requireSignIn,
    signOut: logout,
    currentUser: () => lastUser || (isOwner(auth.currentUser) ? auth.currentUser : null),
    isSignedIn: () => isOwner(auth.currentUser),
    isOwner
  };
}
