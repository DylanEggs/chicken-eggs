(() => {
  "use strict";
  // Install the stable inventory/runtime guard before Farm App 2 renders so
  // legacy inventory math never paints to the screen and older cached helpers
  // are neutralized before they can attach observers or redraw loops.
  document.write('<script src="app2-stable-runtime-v1.js?v=20260814-1"><\/script>');
  document.write('<script src="app2-legacy-v1.js?v=20260814-1"><\/script>');
})();
