'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { shopperApprovedSealImageUrl } from '@/lib/shopperApproved.mjs';

/**
 * Shopper Approved trust seal — static image only.
 *
 * Their certificate.js injects a floating widget that sits on top of neighbouring
 * badges, so we do not load it. The seal links to our /reviews page (full widget).
 */
export default function ShopperApprovedSeal({ className = '', lang = 'es' }) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/shopper-approved/display')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.siteId) return;
        setConfig(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!config) return null;

  const imgSrc = shopperApprovedSealImageUrl(config.siteId);
  if (!imgSrc) return null;

  const label = lang === 'en' ? 'Shopper Approved customer reviews' : 'Reseñas de clientes Shopper Approved';

  return (
    <Link
      href={`/reviews?lang=${lang}`}
      className={`shopper-approved-seal${className ? ` ${className}` : ''}`}
      aria-label={label}
      title={label}
    >
      <img
        src={imgSrc}
        alt={label}
        width={140}
        height={70}
        style={{ border: 0, display: 'block', width: '140px', maxWidth: '100%', height: 'auto' }}
      />
    </Link>
  );
}
