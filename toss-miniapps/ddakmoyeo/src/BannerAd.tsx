import { TossAds } from '@apps-in-toss/web-framework';
import { useEffect, useRef, useState } from 'react';

const adGroupId = import.meta.env.VITE_AD_GROUP_ID?.trim();

export function BannerAd() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(Boolean(adGroupId));

  useEffect(() => {
    if (!adGroupId || !containerRef.current || TossAds.attachBanner.isSupported() !== true) {
      setVisible(false);
      return;
    }
    let attached: ReturnType<typeof TossAds.attachBanner> | undefined;
    let cancelled = false;
    const attach = () => {
      if (cancelled || !containerRef.current) return;
      attached = TossAds.attachBanner(adGroupId, containerRef.current, {
        theme: 'auto', tone: 'blackAndWhite', variant: 'expanded',
        callbacks: { onAdFailedToRender: () => setVisible(false), onNoFill: () => setVisible(false) }
      });
    };
    TossAds.initialize({ callbacks: { onInitialized: attach, onInitializationFailed: () => setVisible(false) } });
    return () => { cancelled = true; attached?.destroy(); };
  }, []);

  return visible ? <div ref={containerRef} className="ad-slot" aria-label="광고" /> : null;
}
