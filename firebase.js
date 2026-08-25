// Firebase compatibility entrypoint. The regular app loader already installs
// UI/audit guards before deferred modules run, so this file starts only the
// protected cloud-first sync engine. That avoids loading duplicate wrappers.
const BUILD = String(window.__ChickenEggsBuild || "20260825-2015");
const src = file => `./${file}?v=${encodeURIComponent(BUILD)}`;

window.__ChickenEggsFirebaseEntrypointBuild = BUILD;
await import(src("firebase-safe-v10.js"));
