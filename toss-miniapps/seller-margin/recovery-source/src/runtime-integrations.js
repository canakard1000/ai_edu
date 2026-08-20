import { IAP, getTossShareLink, share } from '@apps-in-toss/web-framework';
import { readRuntimeConfig } from './runtime-config.js';
import { shareSellerMargin } from './share-flow.js';
import { createSubscriptionGateway } from './subscription-gateway.js';

function setStatus(message) {
  const status = document.querySelector('#status');
  if (status) status.textContent = message;
}

function renameMarketplaceLabel(root) {
  for (const button of root.querySelectorAll('[data-market]')) {
    if (button.dataset.market !== '토스쇼핑') continue;
    button.dataset.market = '판매처 옵션';
    const text = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (text) text.textContent = '판매처 옵션';
  }
}

export function installRuntimeIntegrations(root = document) {
  const subscriptions = createSubscriptionGateway({
    config: readRuntimeConfig(),
    iap: IAP,
    setStatus,
  });

  renameMarketplaceLabel(root);
  new MutationObserver(() => renameMarketplaceLabel(root)).observe(root.body, {
    childList: true,
    subtree: true,
  });

  root.addEventListener('click', async (event) => {
    const shareButton = event.target.closest('#share');
    if (shareButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        await shareSellerMargin({ createLink: getTossShareLink, sendMessage: share });
      } catch {
        setStatus('토스 앱에서 공유를 다시 시도해 주세요.');
      }
      return;
    }

    const subscribeButton = event.target.closest('[data-subscribe]');
    if (subscribeButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      subscriptions.start(subscribeButton.classList.contains('best') ? 'annual' : 'monthly');
      return;
    }

    if (event.target.closest('[data-restore]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      subscriptions.restore();
    }
  }, true);
}

installRuntimeIntegrations();
