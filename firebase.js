// Compatibility entrypoint for older cached app shells.
// Every child module must use the same live app build so iPhone/PWA cache
// cannot mix an old Firebase generation with a newer Farm UI generation.
const BUILD = String(window.__ChickenEggsBuild || "20260816-1660");
const src = file => `./${file}?v=${encodeURIComponent(BUILD)}`;

window.__ChickenEggsFirebaseEntrypointBuild = BUILD;

await import(src("core-sync-ui-v1.js"));
await import(src("legacy-render-observer-guard-v1.js"));
await import(src("audit-finish-v1.js"));
await import(src("app-audit-v1.js"));

// All farm synchronization lives in one transactional cloud-first module.
await import(src("firebase-safe-v9.js"));
