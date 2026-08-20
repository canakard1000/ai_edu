export function closeOpenOverlay(document) {
  const overlay = document.querySelector('#modal.open, #modal[aria-hidden="false"]');
  if (overlay == null) return false;

  const closeButton = overlay.querySelector('[data-close], .close, [aria-label="닫기"]');
  if (typeof closeButton?.click === 'function') {
    closeButton.click();
    return true;
  }

  overlay.setAttribute('aria-hidden', 'true');
  return true;
}

export function returnToHome({ document, window }) {
  if (closeOpenOverlay(document)) return 'overlay-closed';

  window.scrollTo({ top: 0, behavior: 'instant' });
  document.querySelector('main, #app')?.focus?.();
  return 'home';
}

export function createBackHandler(environment) {
  return () => returnToHome(environment);
}
