import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

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
const db = getFirestore(app);
const form = document.getElementById("loginForm");
const button = document.getElementById("loginButton");
const status = document.getElementById("status");
const details = document.getElementById("details");
const signOutButton = document.getElementById("signOutButton");

function setStatus(text, kind="wait") {
  status.textContent = text;
  status.className = `status ${kind}`;
}
function setBusy(on) {
  button.disabled = !!on;
  button.textContent = on ? "Verifying…" : "Verify Owner Login";
}
function maskUid(uid) {
  uid = String(uid || "");
  if (uid.length < 12) return uid;
  return `${uid.slice(0,7)}…${uid.slice(-6)}`;
}
function authMessage(error) {
  const code=String(error?.code||"");
  if (/invalid-credential|wrong-password|user-not-found/.test(code)) return "Firebase did not accept that email/password.";
  if (/too-many-requests/.test(code)) return "Too many attempts. Wait a little while and try again.";
  if (/network-request-failed/.test(code)) return "Network problem while contacting Firebase.";
  if (/operation-not-allowed/.test(code)) return "Email/Password sign-in is not enabled in Firebase.";
  if (/permission-denied/.test(code)) return "Owner login worked, but current Firestore rules blocked the read test.";
  return error?.message ? String(error.message) : "Owner verification failed.";
}

await signOut(auth).catch(()=>{});

form.addEventListener("submit", async event => {
  event.preventDefault();
  details.hidden = true;
  signOutButton.hidden = true;
  setBusy(true);
  setStatus("Signing in to Firebase…", "wait");
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result?.user;
    if (!user || user.isAnonymous || String(user.uid || "") !== OWNER_UID) {
      await signOut(auth).catch(()=>{});
      throw Object.assign(new Error("Firebase account is not the authorized farm owner."), {code:"farm/not-owner"});
    }

    setStatus("Owner account verified. Testing a read-only farm settings request…", "wait");
    const snap = await getDoc(doc(db, "farm", "settings"));
    const farmName = snap.exists() ? String(snap.data()?.farmName || "Farm settings document exists") : "No farm settings document found";
    setStatus("✅ Owner login verified successfully. No farm data was changed.", "good");
    details.innerHTML = `<strong>Verified Firebase owner</strong>UID: ${maskUid(user.uid)}<br>Provider: Email/Password<br>Read-only Firestore check: ${snap.exists()?"PASS":"PASS — document not present"}<br>Farm setting: ${farmName.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}`;
    details.hidden = false;
    signOutButton.hidden = false;
  } catch (error) {
    if (error?.code === "farm/not-owner") setStatus("This Firebase login is valid, but it is not the authorized owner UID.", "bad");
    else setStatus(authMessage(error), "bad");
    await signOut(auth).catch(()=>{});
  } finally {
    setBusy(false);
  }
});

signOutButton.addEventListener("click", async()=>{
  await signOut(auth).catch(()=>{});
  signOutButton.hidden = true;
  details.hidden = true;
  document.getElementById("password").value = "";
  setStatus("Test session signed out. No farm data was changed.", "wait");
});

window.OwnerLoginReadOnlyTest = {
  version: 1,
  expectedUid: () => OWNER_UID,
  canWrite: false
};
