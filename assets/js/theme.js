// Applies the saved colour theme before first paint so dark mode never flashes
// light. Loaded synchronously in <head> by every page; app.js owns the navbar
// toggle and persists the visitor's choice under the same storage key.
(function () {
  var STORAGE_KEY = 'agribridge-theme';
  var root = document.documentElement;
  var stored = null;

  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    // Storage can be unavailable (private mode, disabled storage); fall back
    // to the system preference for this visit.
    stored = null;
  }

  var prefersDark = !!(window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches);
  var theme = stored === 'light' || stored === 'dark'
    ? stored
    : (prefersDark ? 'dark' : 'light');

  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
})();
