// Compatibility entrypoint for older cached index.html files.
// Install no-twitch compatibility guards before protected Firebase starts.
import "./core-sync-ui-v1.js?v=20260815-2";
import "./legacy-render-observer-guard-v1.js?v=20260815-2";
import "./audit-finish-v1.js?v=20260815-6";
import "./app-audit-v1.js?v=20260815-4";

// All farm synchronization lives in one transactional cloud-first module.
import "./firebase-safe-v9.js?v=20260815-2";
