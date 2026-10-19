'use client';

import { useEffect, useState } from 'react';
import {
  shopperApprovedCertificateScriptUrl,
  shopperApprovedSealImageUrl,
} from '@/lib/shopperApproved.mjs';

/**
 * Shopper Approved trust seal (classic image + certificate script).
 *
 * Loads public display config from the server so the survey token never reaches
 * this page. Renders nothing when the site id is not configured, or when their
 * seal image has not gone live yet (they need about 10 reviews).
 */
export default function ShopperApprovedSeal({ className = '', lang = 'es' }) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/shopper-approved/display')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.siteId || !data?.certificateUrl) return;
        setConfig(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!config?.siteId) return;
    const src = shopperApprovedCertificateScriptUrl();
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return undefined;
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    document.head.appendChild(script);
    return () => {
      // Leave the script: other seals on the same page may still need it.
    };
  }, [config?.siteId]);

  if (!config) return null;

  const imgSrc = shopperApprovedSealImageUrl(config.siteId);
  if (!imgSrc) return null;

  const label = lang === 'en' ? 'Shopper Approved customer reviews' : 'Reseñas de clientes Shopper Approved';

  return (
    <a
      href={config.certificateUrl}
      className={`shopperlink shopper-approved-seal${className ? ` ${className}` : ''}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
    >
      <img
        src={imgSrc}
        alt={label}
        width={120}
        height={60}
        style={{ border: 0, display: 'block', maxWidth: '120px', height: 'auto' }}
      />
    </a>
  );
}
