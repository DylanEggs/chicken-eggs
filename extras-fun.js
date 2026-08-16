(() => {
  "use strict";
  if (window.__extrasFunEntrypointV3) return;
  window.__extrasFunEntrypointV3 = true;
  const build = String(window.__ChickenEggsBuild || "20260816-1690");
  const src = `extras-fun-safe-loader-v1.js?v=${encodeURIComponent(build)}`;
  if (document.readyState === "loading") document.write(`<script src="${src}"><\/script>`);
  else {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }
})();
