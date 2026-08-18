import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

function showDevErrorOverlay(title: string, error: unknown): void {
  if (environment.production) {
    return;
  }
  const message = error instanceof Error ? (error.stack || error.message) : String(error);
  const overlay = document.createElement('pre');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:999999;margin:0;padding:16px;' +
    'background:#1a0000;color:#ff6b6b;font:12px/1.4 monospace;' +
    'white-space:pre-wrap;overflow:auto;';
  overlay.textContent = `${title}\n\n${message}`;
  document.body.appendChild(overlay);
}

window.addEventListener('error', (event) => {
  showDevErrorOverlay('Uncaught error', event.error ?? event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  showDevErrorOverlay('Unhandled promise rejection', event.reason);
});

if (!environment.production && 'serviceWorker' in navigator) {
  // ng serve doesn't reliably suppress ServiceWorkerModule registration, so a
  // worker from an earlier dev session can persist and serve stale cached
  // responses. Unregister anything found so dev always loads fresh code.
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => registration.unregister());
  });
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => {
    console.log(err);
    showDevErrorOverlay('Bootstrap failed', err);
  });
