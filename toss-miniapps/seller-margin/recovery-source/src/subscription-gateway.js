import { isSubscriptionReady } from './runtime-config.js';

export function createSubscriptionGateway({ config, iap, fetchImpl = fetch, setStatus }) {
  async function verifyGrant({ orderId, subscriptionId, sku }) {
    const response = await fetchImpl(config.grantEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ orderId, subscriptionId, sku }),
    });
    if (!response.ok) return false;
    const payload = await response.json();
    return payload.granted === true;
  }

  function start(plan) {
    if (!isSubscriptionReady(config, plan)) {
      setStatus('PRO 정기결제 상품을 준비 중이에요. 결제는 아직 진행되지 않습니다.');
      return () => {};
    }
    if (!iap.createSubscriptionPurchaseOrder.isSupported()) {
      setStatus('최신 토스 앱에서 결제를 진행해 주세요.');
      return () => {};
    }

    const sku = plan === 'annual' ? config.annualSku : config.monthlySku;
    setStatus('토스 결제 화면을 여는 중이에요.');
    return iap.createSubscriptionPurchaseOrder({
      options: {
        sku,
        // Access is granted only after the server verifies this order.
        processProductGrant: ({ orderId, subscriptionId }) => verifyGrant({ orderId, subscriptionId, sku }),
      },
      onEvent: () => setStatus('결제 확인 후 PRO 권한을 적용하고 있어요.'),
      onError: () => setStatus('결제가 완료되지 않았어요. 다시 시도해 주세요.'),
    });
  }

  function restore() {
    setStatus('이전 구독 복원은 운영 권한 확인 연결 후 사용할 수 있어요.');
  }

  return { restore, start };
}
