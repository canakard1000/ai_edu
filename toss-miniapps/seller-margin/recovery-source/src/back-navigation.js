import { graniteEvent } from '@apps-in-toss/web-framework';
import { createBackHandler } from './back-controller.js';

const handleBack = createBackHandler({ document, window });

// The Toss native event prevents Android back from closing the WebView.
let unsubscribe = () => {};
try {
  unsubscribe = graniteEvent.addEventListener('backEvent', {
    onEvent: handleBack,
    onError: () => {},
  });
} catch {
  // The web preview does not expose the native Toss event bridge.
}

// Browser preview and iOS gesture fallback use the same screen semantics.
history.replaceState({ sellerMargin: 'home' }, '', location.href);
history.pushState({ sellerMargin: 'guard' }, '', location.href);
window.addEventListener('popstate', () => {
  handleBack();
  history.pushState({ sellerMargin: 'guard' }, '', location.href);
});

window.addEventListener('pagehide', () => unsubscribe(), { once: true });
