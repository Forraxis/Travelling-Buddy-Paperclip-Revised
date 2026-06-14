'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export interface AdSlotProps {
  /** The AdSense ad-unit slot id. */
  slot: string;
  className?: string;
  /** AdSense format; 'auto' is responsive. */
  format?: string;
  style?: React.CSSProperties;
}

/**
 * Google AdSense display slot for SEO/content pages only (never the calculator
 * or account areas — spec §13.1). Completely inert until
 * NEXT_PUBLIC_ADSENSE_CLIENT is set, so it ships safe and Tim activates ads by
 * adding the client id once AdSense approves the domain. Always rendered with a
 * small "Advertisement" label so paid content is distinguishable.
 */
export default function AdSlot({
  slot,
  className,
  format = 'auto',
  style,
}: AdSlotProps) {
  const pushed = useRef(false);

  useEffect(() => {
    if (!CLIENT || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense not ready yet — it retries on its own script load.
    }
  }, []);

  if (!CLIENT) return null;

  return (
    <div className={className}>
      <Script
        id="adsbygoogle-init"
        async
        strategy="afterInteractive"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`}
        crossOrigin="anonymous"
      />
      <p className="mb-1 text-center text-[10px] tracking-wide text-gray-400 uppercase">
        Advertisement
      </p>
      <ins
        className="adsbygoogle block"
        style={{ display: 'block', ...style }}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
