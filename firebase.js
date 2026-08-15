// Compatibility entrypoint for older cached index.html files.
// Install the no-twitch compatibility guards before protected Firebase starts.
import "./core-sync-ui-v1.js?v=20260815-1";
import "./legacy-render-observer-guard-v1.js?v=20260815-1";
import "./audit-finish-v1.js?v=20260815-5";

// All farm synchronization lives in one transactional cloud-first module.
import "./firebase-safe-v9.js?v=20260815-2";
