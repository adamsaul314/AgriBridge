// AgriBridge page entrypoint.
//
// Loaded by every page with <script type="module" src="assets/js/main.js">.
// Kept deliberately tiny: it just starts the features exported by app.js. Tests
// import app.js directly, so importing the module never has side effects.

import { bootstrap } from './app.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
