import SiteShell from '@/components/site/site-shell';
import ProductPage from '@/components/site/product-page';
import { getSiteData } from '@/lib/site/data';
import { liveCopy } from '@/lib/site/live-copy.mjs';
import { liveH1 } from '@/lib/site/live-h1';
import { compoundForLander, hasLivePage, newProductPath } from '@/lib/site/links.mjs';
import { resolveVialPage } from '@/lib/site/product-pages.mjs';
import { alternates } from '@/lib/routes';
import { SITE_URL } from '@/lib/indexing';
import { metadataForPath } from '@/lib/seo';
import { currentSite } from '@/lib/site/current-site.mjs';
import { brandSwap } from '@/lib/storefront/i18n.mjs';

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

/**
 * A compound the catalog sells that the live site never had a page for, by
 * its `/product/<slug>/` slug, or null. A live page with the same slug wins,
 * since the route looks that up first.
 */
export async function newProductFor(slug, lang) {
  const site = await getSiteData(lang);
  const compound = site.compounds.find((entry) => entry.slug === slug && !hasLivePage(entry.name));
  return compound ? { site, compound, size: null } : null;
}

/** Title, description and language links of a new product page. */
export async function newProductMetadata({ compound }, lang) {
  const description = (lang === 'es' ? compound.descriptionEs : compound.descriptionEn) || compound.descriptionEn || '';
  return await metadataForPath(newProductPath(compound.slug, lang), {
    title: `${compound.name} ${lang === 'es' ? 'en Colombia' : 'Colombia'} | Peptides Colombia`,
    description: description.replace(/\s+/g, ' ').trim().slice(0, 155) || undefined,
    en: newProductPath(compound.slug, 'en'),
    es: newProductPath(compound.slug, 'es'),
  });
}

/** A new product page: the same layout, with the catalog's own description. */
export async function NewProductRoute({ lang, product }) {
  const { compound } = product;
  const country = await currentSite();
  const description = (lang === 'es' ? compound.descriptionEs : compound.descriptionEn) || compound.descriptionEn || '';
  const paras = description.split(/\n\s*\n/).map((para) => para.trim()).filter(Boolean);
  const path = newProductPath(compound.slug, lang);
  return (
    <SiteShell lang={lang} altHref={newProductPath(compound.slug, lang === 'es' ? 'en' : 'es')}>
      <ProductPage
        lang={lang}
        site={product.site}
        country={country}
        compound={compound}
        h1={compound.name}
        copy={paras.length ? { blocks: [{ title: '', paras, items: [], links: [], faq: [] }], faq: [] } : null}
        schemaUrl={new URL(path, SITE_URL).toString()}
      />
    </SiteShell>
  );
}

/** A live product page in the new design. */
export default async function ProductRoute({ page, lang, product }) {
  const alt = alternates(page.en);
  const path = lang === 'es' ? page.es : page.en;
  const country = await currentSite();
  return (
    <SiteShell lang={lang} altHref={lang === 'es' ? alt.en : alt.es}>
      <ProductPage
        lang={lang}
        site={product.site}
        country={country}
        compound={product.compound}
        initialSize={product.size}
        h1={brandSwap(liveH1(page, lang), country)}
        copy={liveCopy(page.sections, lang)}
        schemaUrl={new URL(path, SITE_URL).toString()}
      />
    </SiteShell>
  );
}
