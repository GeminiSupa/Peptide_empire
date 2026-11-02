import SiteShell from '@/components/site/site-shell';
import ProductPage from '@/components/site/product-page';
import { getSiteData } from '@/lib/site/data';
import { liveCopy } from '@/lib/site/live-copy.mjs';
import { liveH1 } from '@/lib/site/live-h1';
import { compoundForLander } from '@/lib/site/links.mjs';
import { resolveVialPage } from '@/lib/site/product-pages.mjs';
import { alternates } from '@/lib/routes';
import { SITE_URL } from '@/lib/indexing';

/**
 * The compound (and strength) a live product page sells, or null.
 *
 * A lander sells a compound; a WooCommerce vial page sells one strength of
 * it. Null for a page whose product the catalog no longer has — the route
 * then keeps rendering that page the old way rather than 404ing a live URL.
 */
export async function productFor(page, lang) {
  if (!page) return null;
  const site = await getSiteData(lang);
  if (page.group === 'productLander') {
    const name = compoundForLander(page.slug);
    const compound = name ? site.compounds.find((entry) => entry.name === name) : null;
    return compound ? { site, compound, size: null } : null;
  }
  if (page.group === 'wooProduct') {
    const found = resolveVialPage(page.slug, site.compounds);
    return found ? { site, ...found } : null;
  }
  return null;
}

/** A live product page in the new design. */
export default function ProductRoute({ page, lang, product }) {
  const alt = alternates(page.en);
  const path = lang === 'es' ? page.es : page.en;
  return (
    <SiteShell lang={lang} altHref={lang === 'es' ? alt.en : alt.es}>
      <ProductPage
        lang={lang}
        site={product.site}
        compound={product.compound}
        initialSize={product.size}
        h1={liveH1(page, lang)}
        copy={liveCopy(page.sections, lang)}
        schemaUrl={new URL(path, SITE_URL).toString()}
      />
    </SiteShell>
  );
}
