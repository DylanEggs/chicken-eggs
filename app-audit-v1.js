(() => {
  "use strict";
  if (window.__appAuditEntrypointV2) return;
  window.__appAuditEntrypointV2 = true;

  const src = "app-audit-safe-loader-v1.js?v=20260815-2";
  if (document.readyState === "loading") {
    document.write(`<script src="${src}"><\/script>`);
  } else {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }
})();
