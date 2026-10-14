/// <reference types="vite/client" />

/** Register the offline service worker. Production builds only: in dev it would cache stale code. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || import.meta.env.MODE === "single") return;
  if (!("serviceWorker" in navigator)) return;
  // Relative to the page, so it works under a GitHub Pages sub-path.
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
    /* offline support is a nicety; the app works without it */
  });
}
