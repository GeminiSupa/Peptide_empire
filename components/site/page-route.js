import Link from 'next/link';
import SiteShell from '@/components/site/site-shell';
import CatalogPage from '@/components/site/catalog-page';
import ProtoPage from '@/components/site/proto-page';
import CategoryPage, { categorySlugFor } from '@/components/site/category-page';
import CopyBlock from '@/components/site/copy-block';
import BlogIndex, { listed } from '@/components/site/blog-index';
import PostPage from '@/components/site/post-page';
import DealPage from '@/components/site/deal-page';
import SitemapPage from '@/components/site/sitemap-page';
import ThankYou from '@/components/site/thank-you';
import { variantFor } from '@/lib/storefront/group-products.mjs';
import { posts } from '@/content/pages/posts';
import { mixingGuides } from '@/content/pages/mixing-guides';
import { allPages } from '@/content/pages/registry';
import { CategoryTiles } from '@/components/site/blocks';
import { cityH1, cityPlace } from '@/lib/site/city.mjs';
import { getSiteData } from '@/lib/site/data';
import { liveCopy } from '@/lib/site/live-copy.mjs';
import { liveH1 } from '@/lib/site/live-h1';
import { NEW_PAGES } from '@/lib/site/links.mjs';
import { alternates } from '@/lib/routes';
import { translator } from '@/lib/storefront/i18n.mjs';

/** The prototype's "Shop by Category" page (`#shop`). */
function ShopPage({ lang, site, h1 }) {
  const t = translator(lang);
  return (
    <div className="pagev">
      <div className="wrap">
        <nav className="bc" aria-label={t('Breadcrumb')}>
          <Link href={site.links.home}>{t('Home')}</Link>
          <span>/</span>
          <b>{t('Shop by Category')}</b>
        </nav>
        <header className="phead">
          <h1>{h1}</h1>
          <p>{t('Browse research compounds by area of study.')}</p>
        </header>
        <div className="pbody">
          <CategoryTiles categories={site.categories} t={t} />
        </div>
      </div>
    </div>
  );
}

/** A page drawn from its prototype snapshot (data/site/pages/<key>.json). */
function snapshot(key) {
  return async function SnapshotPage(props) {
    const { default: tree } = await import(`@/data/site/pages/${key}.json`);
    return <ProtoPage tree={tree} {...props} />;
  };
}

/** Which new-design template draws a live page, by its English path. */
const TEMPLATES = {
  '/all-peptide-products-costa-rica/': CatalogPage,
  '/shop/': ShopPage,
  '/blog/': BlogIndex,
  '/peptide-guides/': BlogIndex,
  '/about/': snapshot('about'),
  '/our-story/': snapshot('our-story'),
  '/bulk-discounts/': snapshot('bulk-discounts'),
  '/faq-costa-rica/': snapshot('faq-costa-rica'),
  '/contact-costa-rica/': snapshot('contact-costa-rica'),
  '/customer-feedback/': snapshot('customer-feedback'),
  '/our-service-locations/': snapshot('our-service-locations'),
  '/affiliate-program/': snapshot('affiliate-program'),
  '/info-center/': snapshot('info-center'),
  '/shipping-policy/': snapshot('shipping-policy'),
  '/return-refund-policy/': snapshot('return-refund-policy'),
  '/privacy-policy/': snapshot('privacy-policy'),
  '/lab-tests-coa-results/': snapshot('lab-tests-coa-results'),
  '/html-sitemap/': SitemapPage,
};

/** The thank-you page, offering the prototype's three add-ons at live prices. */
function ThankYouTemplate({ site }) {
  const upsells = [['bac-water', '10 ml'], ['ghk-cu'], ['tirzepatide']].map(([slug, size]) => {
    const compound = site.compounds.find((entry) => entry.slug === slug);
    const variant = compound ? variantFor(compound, size || compound.defaultSize) : null;
    return variant ? { name: compound.name, size: variant.size, priceCrc: variant.priceCrc, priceUsd: variant.priceUsd, image: variant.image || compound.image } : null;
  }).filter(Boolean);
  return <ThankYou upsells={upsells} appHref={site.links['explore-our-app']} reviews={site.reviews} />;
}

/** Pages the new design adds, by key; they have no harvested page. */
const NEW_TEMPLATES = {
  'our-process': snapshot('our-process'),
  'explore-our-app': snapshot('explore-our-app'),
  'for-professionals': snapshot('for-professionals'),
  'thank-you': ThankYouTemplate,
  'deal-of-the-week': DealPage,
};

/** A city page: the prototype's location page for that town, then its live copy. */
async function CityPage({ lang, site, page, h1, copy }) {
  const { default: tree } = await import('@/data/site/pages/alajuela.json');
  const { town } = cityPlace(page, lang);
  const t = translator(lang);
  return (
    <>
      <ProtoPage tree={tree} lang={lang} site={site} h1={cityH1(h1, page, lang)} replacements={[['Alajuela', town]]} />
      {copy?.blocks?.length ? (
        <div className="wrap">
          {copy.blocks.map((block) => <CopyBlock block={block} t={t} lang={lang} key={block.title || block.paras[0]} />)}
        </div>
      ) : null}
    </>
  );
}

/** Article lists, for an article's section link and its "keep reading" row. */
const ARTICLE_GROUPS = {
  blogPost: { pages: () => posts, label: 'Blog', key: 'blog' },
  mixingGuide: { pages: () => mixingGuides, label: 'Peptide Guides', key: 'peptide-guides' },
  guide: { pages: () => allPages.filter((entry) => entry.group === 'guide' && entry.kind === 'article'), label: 'Info Center', key: 'info-center' },
};

function ArticleTemplate(props) {
  const { page, site, lang } = props;
  const group = ARTICLE_GROUPS[page.group];
  const list = group.pages();
  const at = Math.max(0, list.findIndex((entry) => entry.en === page.en));
  const related = [1, 2, 3].map((step) => list[(at + step) % list.length])
    .filter((entry) => entry && entry.en !== page.en)
    .map((entry) => listed(entry, lang));
  return (
    <PostPage
      {...props}
      related={related}
      section={{ label: group.label, href: site.links[group.key] }}
    />
  );
}

/** The template for a page: by its URL, or by the kind of page it is. */
function templateFor(page, site) {
  if (!page) return null;
  if (TEMPLATES[page.en]) return TEMPLATES[page.en];
  if (page.group === 'city') return CityPage;
  if (ARTICLE_GROUPS[page.group] && (page.group !== 'guide' || page.kind === 'article')) return ArticleTemplate;
  if (page.group === 'category' || page.group === 'wooCategory') {
    const slug = categorySlugFor(page.slug);
    if (site && !site.categories.some((entry) => entry.slug === slug)) return null;
    return CategoryTemplate;
  }
  return null;
}

/** A category page; PageRoute passes the category's slug. */
function CategoryTemplate({ categorySlug, ...props }) {
  const category = props.site.categories.find((entry) => entry.slug === categorySlug);
  return <CategoryPage {...props} category={category} />;
}

/** True when a page has moved to the new design. */
export function hasNewDesign(page) {
  return Boolean(templateFor(page, null));
}

/**
 * A live page in the new design: the shell, and the template for its URL,
 * given the page's own H1 and copy.
 */
export default async function PageRoute({ page, lang }) {
  const site = await getSiteData(lang);
  const Template = templateFor(page, site);
  const alt = alternates(page.en);
  const extra = Template === CategoryTemplate ? { categorySlug: categorySlugFor(page.slug) } : {};
  return (
    <SiteShell lang={lang} altHref={lang === 'es' ? alt.en : alt.es}>
      {renderTemplate(Template, { lang, site, page, h1: liveH1(page, lang), copy: liveCopy(page.sections, lang), ...extra })}
    </SiteShell>
  );
}

/**
 * Renders the template chosen for a URL. Every template is a module-level
 * component (TEMPLATES, CategoryTemplate…), picked per page, never created
 * per render; the indirection keeps the static-components lint rule, which
 * cannot see that, from flagging the lookup.
 */
function renderTemplate(Template, props) {
  return <Template {...props} />;
}

/** A page the new design adds (`/our-process/`, `/es/nuestro-proceso/`…). */
export async function NewPageRoute({ pageKey, lang }) {
  const Template = NEW_TEMPLATES[pageKey];
  const site = await getSiteData(lang);
  const paths = NEW_PAGES[pageKey];
  return (
    <SiteShell lang={lang} altHref={lang === 'es' ? paths.en : paths.es}>
      <Template lang={lang} site={site} h1={null} copy={null} />
    </SiteShell>
  );
}
