'use client';

import Link from 'next/link';
import { usePublicPageContent } from '@/hooks/usePublicPageContent';
import { StorefrontFooter, StorefrontHeader } from '@/components/StorefrontChrome';
import ShopperApprovedReviewsWidget from '@/components/ShopperApprovedReviewsWidget';
import MobileActionBar from '@/components/MobileActionBar';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { useBusinessLinks } from '@/hooks/useBusinessLinks';
import '../landing.css';

export default function ReviewsPageClient({ display }) {
  const { lang, setLang, landingSettings } = usePublicPageContent('landing_page');
  const { links } = useBusinessLinks();

  return (
    <div className="clone-home">
      <StorefrontHeader lang={lang} onLanguage={setLang} settings={landingSettings} />

      <main style={{ paddingTop: '48px', paddingBottom: '80px' }}>
        <div className="container" style={{ maxWidth: '960px', margin: '0 auto' }}>
          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: 800,
              marginBottom: '12px',
              color: 'var(--text-main)',
              textAlign: 'center',
            }}
          >
            {lang === 'en' ? 'Customer Reviews' : 'Reseñas de Clientes'}
          </h1>
          <p
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              marginBottom: '40px',
              maxWidth: '560px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            {lang === 'en'
              ? 'Verified store reviews collected after purchase through Shopper Approved.'
              : 'Reseñas verificadas de la tienda, recopiladas después de la compra con Shopper Approved.'}
          </p>

          {!display?.siteId ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
                {lang === 'en'
                  ? 'Shopper Approved is not configured on this site yet.'
                  : 'Shopper Approved aún no está configurado en este sitio.'}
              </p>
              <Link href={`/catalog?lang=${lang}`} className="btn-hero-primary" style={{ display: 'inline-flex' }}>
                {lang === 'en' ? 'Browse the catalog' : 'Ver el catálogo'}
              </Link>
            </div>
          ) : (
            <>
              <ShopperApprovedReviewsWidget
                siteId={display.siteId}
                preset={display.reviewPagePreset || 'default'}
              />
              {display.certificateUrl ? (
                <p style={{ textAlign: 'center', marginTop: '32px' }}>
                  <a
                    href={display.certificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
                  >
                    {lang === 'en'
                      ? 'View full certificate on Shopper Approved'
                      : 'Ver el certificado completo en Shopper Approved'}
                  </a>
                </p>
              ) : null}
            </>
          )}
        </div>
      </main>

      <StorefrontFooter lang={lang} settings={landingSettings} />
      <MobileActionBar lang={lang} whatsappHref={buildWhatsAppLink(links.whatsappNumber, null, lang)} />
    </div>
  );
}
