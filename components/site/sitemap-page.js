import Link from 'next/link';
import coreData from '@/data/pages/core.json';
import categoryData from '@/data/pages/category.json';
import landerData from '@/data/pages/productLander.json';
import wooCategoryData from '@/data/pages/wooCategory.json';
import guideData from '@/data/pages/guide.json';
import mixingGuideData from '@/data/pages/mixingGuide.json';
import cityData from '@/data/pages/city.json';
import legalData from '@/data/pages/legal.json';
import { posts } from '@/content/pages/posts';
import { products } from '@/content/pages/products';
import { NEW_PAGES } from '@/lib/site/links.mjs';
import { translator } from '@/lib/storefront/i18n.mjs';
import Breadcrumbs from '@/components/site/breadcrumbs';

/**
 * The HTML sitemap in the prototype's layout (`sitemapHTML`), listing the
 * same groups the live page lists, in the same order, plus the pages the new
 * design adds.
 */
const GROUPS = [
  ['Main Pages', () => coreData.pages],
  ['Shop By Category', () => categoryData.pages],
  ['Products', () => landerData.pages],
  ['Product Categories', () => wooCategoryData.pages],
  ['All Products', () => products],
  ['Guides', () => guideData.pages],
  ['Mixing & Dosage Guides', () => mixingGuideData.pages],
  ['Blog', () => posts],
  ['Service Locations', () => cityData.pages],
  ['Policies', () => legalData.pages],
];

const NEW_TITLES = {
  'our-process': 'Our Process',
  'explore-our-app': 'Explore Our App',
  'for-professionals': 'For Professionals',
  'deal-of-the-week': 'Deal of the Week',
};

const brandless = (title) => String(title || '').replace(/\s*[|–-]\s*P[ée]ptid(e|o)s Costa Rica\s*$/i, '').trim();

export default function SitemapPage({ lang, site, h1, page }) {
  const t = translator(lang);
  const path = (page) => (lang === 'es' ? page.es || page.en : page.en);
  const groups = GROUPS.map(([title, pages]) => [title, pages().filter((page) => path(page))]);
  groups[0][1] = [
    ...groups[0][1],
    ...Object.entries(NEW_TITLES).map(([key, title]) => ({ en: NEW_PAGES[key].en, es: NEW_PAGES[key].es, head: { title_en: title, title_es: t(title) } })),
  ];

  return (
    <div className="pagev">
      <div className="wrap">
        <Breadcrumbs
          label={t('Breadcrumb')}
          url={(lang === 'es' ? page?.es : page?.en) || page?.en || '/html-sitemap/'}
          items={[{ name: t('Home'), href: site.links.home }, { name: h1 }]}
        />
        <header className="phead">
          <h1>{h1}</h1>
          <p>{t('Every page on the site.')}</p>
        </header>
        <div className="pbody">
          <div className="sitemap">
            {groups.map(([title, pages]) => (
              <div className="smg" key={title}>
                <h2 className="h3">{t(title)}</h2>
                {pages.map((page) => (
                  <Link href={path(page)} key={page.en}>
                    {brandless(page.head?.[`title_${lang}`] || page.head?.title_en) || path(page)}
                    <code>{path(page)}</code>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
