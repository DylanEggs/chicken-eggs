(() => {
  "use strict";
  // Install the stable runtime before Farm App 2 renders so legacy inventory
  // math never paints to the screen and cached correction helpers stay disabled.
  document.write('<script src="app2-stable-runtime-v1.js?v=20260814-2"><\/script>');
  document.write('<script src="app2-legacy-v1.js?v=20260814-1"><\/script>');
})();
