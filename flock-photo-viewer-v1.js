(() => {
  "use strict";
  if (window.__flockPhotoViewerV1) return;
  window.__flockPhotoViewerV1 = true;

  const STYLE_ID = "flockPhotoViewerStyles";
  const OVERLAY_ID = "flockPhotoViewer";

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #xChicken img,
      #farm2FlockList img {
        cursor: zoom-in;
        -webkit-tap-highlight-color: transparent;
      }
      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 100000;
        display: none;
        align-items: center;
        justify-content: center;
        padding: max(18px, env(safe-area-inset-top)) 18px max(18px, env(safe-area-inset-bottom));
        background: rgba(0, 0, 0, .92);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }
      #${OVERLAY_ID}.show { display: flex; }
      #${OVERLAY_ID} .flock-photo-viewer-inner {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
      }
      #${OVERLAY_ID} img {
        display: block;
        width: auto;
        height: auto;
        max-width: 96vw;
        max-height: 82vh;
        object-fit: contain;
        border-radius: 18px;
        box-shadow: 0 18px 55px rgba(0,0,0,.45);
        touch-action: pinch-zoom;
        -webkit-user-select: none;
        user-select: none;
      }
      #${OVERLAY_ID} .flock-photo-viewer-caption {
        color: #fff;
        font-size: 17px;
        font-weight: 800;
        text-align: center;
        max-width: 90vw;
      }
      #${OVERLAY_ID} .flock-photo-viewer-hint {
        color: rgba(255,255,255,.72);
        font-size: 13px;
        font-weight: 700;
        text-align: center;
      }
      #${OVERLAY_ID} .flock-photo-viewer-close {
        position: absolute;
        top: max(14px, env(safe-area-inset-top));
        right: 14px;
        width: 48px;
        height: 48px;
        margin: 0;
        padding: 0;
        border: 0;
        border-radius: 999px;
        background: rgba(255,255,255,.18);
        color: #fff;
        font-size: 28px;
        line-height: 48px;
        font-weight: 800;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }
    `;
    document.head.appendChild(style);
  }

  function overlay() {
    let el = document.getElementById(OVERLAY_ID);
    if (el) return el;
    el = document.createElement("div");
    el.id = OVERLAY_ID;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Enlarged chicken photo");
    el.innerHTML = `
      <button type="button" class="flock-photo-viewer-close" aria-label="Close photo">×</button>
      <div class="flock-photo-viewer-inner">
        <img alt="Enlarged chicken photo">
        <div class="flock-photo-viewer-caption"></div>
        <div class="flock-photo-viewer-hint">Tap outside the photo or × to close</div>
      </div>
    `;
    document.body.appendChild(el);

    const closeButton = el.querySelector(".flock-photo-viewer-close");
    closeButton.addEventListener("click", close);
    el.addEventListener("click", event => {
      if (event.target === el || event.target.classList.contains("flock-photo-viewer-inner")) close();
    });
    return el;
  }

  function captionFor(img) {
    if (img.closest("#xChicken")) {
      return img.closest("#xChicken")?.querySelector("h3")?.textContent?.trim() || "Chicken of the Day";
    }
    const item = img.closest("#farm2FlockList .farm2-listItem");
    if (item) {
      return item.querySelector("h4,h3,strong,b")?.textContent?.trim() || "Flock photo";
    }
    return "Flock photo";
  }

  function open(img) {
    if (!img?.src) return;
    installStyles();
    const el = overlay();
    const large = el.querySelector("img");
    const caption = el.querySelector(".flock-photo-viewer-caption");
    large.src = img.currentSrc || img.src;
    large.alt = img.alt || captionFor(img);
    caption.textContent = captionFor(img);
    el.classList.add("show");
    document.body.dataset.flockPhotoViewerOverflow = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";
  }

  function close() {
    const el = document.getElementById(OVERLAY_ID);
    if (!el?.classList.contains("show")) return;
    el.classList.remove("show");
    const old = document.body.dataset.flockPhotoViewerOverflow ?? "";
    document.body.style.overflow = old;
    delete document.body.dataset.flockPhotoViewerOverflow;
  }

  document.addEventListener("click", event => {
    const img = event.target?.closest?.("#xChicken img, #farm2FlockList img");
    if (!img) return;
    event.preventDefault();
    event.stopPropagation();
    open(img);
  }, true);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") close();
  });

  installStyles();
  console.log("✅ Tap-to-enlarge flock photo viewer active");
})();
