import SiteProvider from '@/components/site/site-provider';
import SiteHeader from '@/components/site/site-header';
import SiteFooter from '@/components/site/site-footer';
import SiteOverlays from '@/components/site/site-overlays';
import SiteTracking from '@/components/site/site-tracking';
import VisitorTracker from '@/components/site/visitor-tracker';
import { ALLOW_INDEXING } from '@/lib/indexing';
import { getSiteData } from '@/lib/site/data';
import { translator } from '@/lib/storefront/i18n.mjs';
import { materialSymbolsHref } from '@/lib/site/icon-names.mjs';
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
          font-size throughout site.css, so the font itself is loaded — but only
          the 73 glyphs the site actually draws (lib/site/icon-names.mjs).
          Requesting the family with open axis ranges returned the entire
          variable font: 3 MB, the largest download on the site, and
          display=block held every icon blank until it arrived. Now 33 KB.
          Shopper Approved's svg-seal/default.css used to be loaded here too; it
          was a render-blocking cross-origin request for the single declaration
          `a.new-sa-seals { display: inline-block }`, now in site-base.css. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={materialSymbolsHref()} />
      <SiteProvider lang={lang} exchangeRate={site.exchangeRate} deal={site.deal} dealView={site.dealView} flashView={site.flashView} contact={site.contact}>
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
        <SiteFooter t={t} lang={lang} links={site.links} categories={site.categories} reviews={site.reviews} contact={site.contact} socials={site.socials} />
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
