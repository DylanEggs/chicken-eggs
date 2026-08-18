(() => {
  "use strict";
  if (window.__stagingExtrasFunEntrypointV1) return;
  window.__stagingExtrasFunEntrypointV1 = true;
  const build = String(window.__ChickenEggsStagingBuild || window.__ChickenEggsBuild || Date.now());
  const src = `staging/staging-extras-fun-safe-loader-v1.js?stage=${encodeURIComponent(build)}`;
  if (document.readyState === "loading") document.write(`<script src="${src}"><\/script>`);
  else {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }
})();
