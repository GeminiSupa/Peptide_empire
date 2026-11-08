import SiteProvider from '@/components/site/site-provider';
import SiteHeader from '@/components/site/site-header';
import SiteFooter from '@/components/site/site-footer';
import SiteOverlays from '@/components/site/site-overlays';
import SiteTracking from '@/components/site/site-tracking';
import VisitorTracker from '@/components/site/visitor-tracker';
import { ALLOW_INDEXING } from '@/lib/indexing';
import { getSiteData } from '@/lib/site/data';
import { translator } from '@/lib/storefront/i18n.mjs';
import '@/app/site.css';
import '@/app/site-base.css';

/**
 * The frame of every page in the new design: header, footer, cart, search,
 * and the live catalog data they share.
 *
 * `altHref` is the same page in the other language, for the language switch.
 * Pages render their own content as `children`, on the server.
 */
export default async function SiteShell({ lang, altHref, children }) {
  const site = await getSiteData(lang);
  const t = translator(lang);

  return (
    <div className="pcr-site">
      {/* The design's icons are Material Symbols ligatures, sized with
          font-size throughout site.css, so the font itself is loaded. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400..600,0..1,0&display=block"
      />
      <link rel="stylesheet" href="https://www.shopperapproved.com/svg-seal/default.css" />
      <SiteProvider lang={lang} exchangeRate={site.exchangeRate} deal={site.deal} dealView={site.dealView} contact={site.contact}>
        <SiteHeader
          links={site.links}
          products={site.products}
          popular={site.popular}
          categories={site.categories}
          deal={site.dealView}
          altHref={altHref}
          compoundCount={site.compounds.length}
          freeShippingLabel={site.freeShippingLabel}
          banners={site.banners}
        />
        <main>{children}</main>
        <SiteFooter t={t} lang={lang} links={site.links} categories={site.categories} reviews={site.reviews} contact={site.contact} />
        <SiteOverlays
          compounds={site.compounds}
          categories={site.categories}
          freeShippingLabel={site.freeShippingLabel}
          links={site.links}
        />
        {/* Tag Manager: on the company domain, or anywhere once indexing is on. */}
        <SiteTracking enabled={ALLOW_INDEXING} />
        {/* Saves agent links, campaigns and ad clicks for the order; reports
            visits to the CRM from the company domain. */}
        <VisitorTracker enabled={ALLOW_INDEXING} />
      </SiteProvider>
    </div>
  );
}
