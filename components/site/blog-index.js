import Link from 'next/link';
import Ms from '@/components/storefront/icon';
import ListFilter from '@/components/site/list-filter';
import { posts } from '@/content/pages/posts';
import { mixingGuides } from '@/content/pages/mixing-guides';
import { translator } from '@/lib/storefront/i18n.mjs';
import Breadcrumbs from '@/components/site/breadcrumbs';
import { blogToPage, getPublishedBlogs } from '@/lib/blog-cms.mjs';

/** What each listing page lists: the same sources the live pages list. */
export const LISTINGS = {
  '/blog/': { pages: () => posts, label: 'Blog', lead: 'Compound guides, comparisons and research news, written by the Peptides Colombia team.' },
  '/peptide-guides/': { pages: () => mixingGuides, label: 'Peptide Guides', lead: 'Mixing and handling guides for each compound, written by the Peptides Colombia team.' },
};

/** One listed article, for the index and the "keep reading" row. */
export function listed(page, lang) {
  const title = page.head?.[`title_${lang}`] || page.head?.title_en || '';
  return { en: page.en, es: page.es, href: (lang === 'es' ? page.es : page.en) || page.en, title: title.replace(/\s*[|–-]\s*P[ée]ptid(e|o)s Colombia\s*$/i, '').trim() };
}

/**
 * The prototype's blog index (`PAGES.blog`): hero with search, the newest
 * article featured, then every article. Each card links the live article URL.
 */
export default async function BlogIndex({ lang, site, page, h1 }) {
  const t = translator(lang);
  const listing = LISTINGS[page.en];
  const cmsPages = page.en === '/blog/' ? (await getPublishedBlogs()).map(blogToPage).filter(Boolean) : [];
  const merged = [...cmsPages, ...listing.pages()].filter((entry, index, all) => all.findIndex((other) => other.en === entry.en) === index);
  const items = merged.map((entry) => listed(entry, lang)).filter((entry) => entry.title);
  const [first, ...rest] = items;

  return (
    <div className="pagev">
      <section className="bhero">
        <div className="wrap">
          <Breadcrumbs
            label={t('Breadcrumb')}
            url={(lang === 'es' ? page.es : page.en) || page.en}
            items={[{ name: t('Home'), href: site.links.home }, { name: t(listing.label) }]}
          />
          <h1>{h1}</h1>
          <p>{t(listing.lead)}</p>
          <ListFilter target="#postGrid .post" placeholder={t('Search articles')} />
        </div>
      </section>

      <section className="pb">
        <div className="wrap">
          {first ? (
            <Link className="feat-post" href={first.href}>
              <div className="pimg big"><Ms name="article" /><em>{t('Featured')}</em></div>
              <div>
                <small>{t(listing.label)}</small>
                <h2>{first.title}</h2>
                <span className="rm">{t('Read the article')}<Ms name="arrow_forward" /></span>
              </div>
            </Link>
          ) : null}
          <div className="posts" id="postGrid">
            {rest.map((entry) => (
              <Link className="post" href={entry.href} key={entry.en}>
                <div className="pimg"><Ms name="article" /></div>
                <small>{t(listing.label)}</small>
                <b>{entry.title}</b>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="band cta">
        <div className="wrap">
          <div>
            <span className="eyebrow">{t('Bulk Savings Program')}</span>
            <h2>{t('15% off 5+ vials. 20% off 10+.')}</h2>
            <p>{t('Same product, applied automatically. No codes, no minimum spend.')}</p>
          </div>
          <Link className="btn" href={site.links.catalog}>{t('Shop the catalog')}<Ms name="arrow_forward" /></Link>
        </div>
      </section>
    </div>
  );
}
