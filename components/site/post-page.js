import Link from 'next/link';
import Ms from '@/components/storefront/icon';
import ProductGrid from '@/components/site/product-grid';
import ReadingProgress from '@/components/site/reading-progress';
import { imageUrl } from '@/lib/images';
import { pathHref } from '@/lib/site/links.mjs';
import { translator } from '@/lib/storefront/i18n.mjs';
import Breadcrumbs from '@/components/site/breadcrumbs';
import JsonLd from '@/components/site/json-ld';
import { SITE_URL } from '@/lib/indexing';
import { seoForPath } from '@/lib/seo';
import { articleNode } from '@/lib/site/structured-data.mjs';
import ARTICLE_DATES from '@/data/site/article-dates.json';

/**
 * The prototype's article view (`postHTML`) for every blog post, guide and
 * mixing guide: reading bar, header with the live H1, a contents list built
 * from the article's own headings, the live article body untouched, the
 * compounds it names, and further reading.
 *
 * The body is the article's harvested HTML (sanitised at harvest time, see
 * components/guide-article.js), drawn as it is: decomposing it would lose its
 * tables and inline markup. Its first H1 moves into the header.
 */

const strip = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const slugId = (text, index) => `s${index}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;

/** The article body, its H1 removed and its H2s given ids, plus the contents list. */
export function articleParts(sections, lang) {
  let h1 = '';
  let html = '';
  for (const section of sections || []) {
    const c = section.content || {};
    if (section.type === 'heading' && c.level === 1 && !h1) { h1 = c[`text_${lang}`] || c.text_en || ''; continue; }
    if (section.type === 'article') html += c[`html_${lang}`] || c.html_en || '';
    if (section.type === 'heading') {
      const level = Math.min(6, Math.max(2, c.level || 2));
      html += `<h${level}>${c[`text_${lang}`] || c.text_en || ''}</h${level}>`;
    }
    if (section.type === 'paragraph') html += `<p>${c[`text_${lang}`] || c.text_en || ''}</p>`;
    if (section.type === 'image' && c.src) {
      html += `<p><img src="${imageUrl(c.src)}" alt="${String(c[`alt_${lang}`] || c.alt_en || '').replace(/"/g, '&quot;')}" loading="lazy"></p>`;
    }
  }
  html = html.replace(/<h1(\b[^>]*)>([\s\S]*?)<\/h1>/i, (match, attrs, body) => {
    if (!h1) h1 = strip(body);
    return '';
  });
  // Any further H1 is demoted, as the live renderer does, to keep one H1.
  html = html.replace(/<h1(\b[^>]*)>([\s\S]*?)<\/h1>/gi, '<h2$1>$2</h2>');

  const toc = [];
  html = html.replace(/<h2(\b[^>]*)>([\s\S]*?)<\/h2>/gi, (match, attrs, body) => {
    const text = strip(body);
    if (!text) return match;
    const existing = attrs.match(/\bid="([^"]+)"/);
    const id = existing ? existing[1] : slugId(text, toc.length);
    toc.push({ id, text });
    return existing ? match : `<h2${attrs} id="${id}">${body}</h2>`;
  });
  const words = strip(html).split(' ').length;
  return { h1, html, toc, minutes: Math.max(1, Math.round(words / 230)) };
}

/** The compounds an article is about: those its title names, longest name first. */
function namedCompounds(title, compounds) {
  const text = String(title || '').toLowerCase();
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = [];
  for (const compound of [...compounds].sort((a, b) => b.name.length - a.name.length)) {
    const name = compound.name.toLowerCase();
    if (name.length < 3 || found.some((other) => other.name.toLowerCase().includes(name))) continue;
    if (new RegExp(`(^|[^a-z0-9])${escape(name)}([^a-z0-9]|$)`).test(text)) found.push(compound);
    if (found.length === 3) break;
  }
  return found;
}

export default function PostPage({ lang, site, page, h1, related = [], section }) {
  const t = translator(lang);
  const { links, compounds } = site;
  const parts = articleParts(page.sections, lang);
  const title = h1 || parts.h1 || page.head?.[`title_${lang}`] || '';
  const prods = namedCompounds(title, compounds);
  const lead = prods[0];
  const url = (lang === 'es' ? page.es : page.en) || page.en;
  const seo = seoForPath(url) || seoForPath(page.en);
  const firstImage = parts.html.match(/<img[^>]+src="([^"]+)"/)?.[1];

  return (
    <>
      <JsonLd
        nodes={[articleNode({
          base: SITE_URL,
          url,
          headline: title,
          description: seo?.description,
          image: seo?.openGraph?.['og:image'] || firstImage,
          lang,
          section: t(section.label),
          dates: ARTICLE_DATES[page.en],
        })]}
      />
      <ReadingProgress />
      <article className="article">
        <div className="wrap">
          <Breadcrumbs
            label={t('Breadcrumb')}
            url={url}
            items={[{ name: t('Home'), href: links.home }, { name: t(section.label), href: section.href }, { name: title }]}
          />
          <header className="ahead">
            <small className="acat">{t(section.label)}</small>
            <h1>{title}</h1>
            <div className="byl">
              <span className="av">PC</span>
              <div>
                <b>Peptides Costa Rica</b>
                <small>{t(`${parts.minutes} min read`)}</small>
              </div>
            </div>
          </header>
          <div className="alay">
            <aside className="atoc">
              {parts.toc.length ? (
                <details open>
                  <summary>{t('On this page')}</summary>
                  {parts.toc.map((entry) => <a href={`#${entry.id}`} key={entry.id}>{entry.text}</a>)}
                </details>
              ) : null}
              {prods.length ? (
                <div className="tocprod">
                  <small>{t('Compounds in this article')}</small>
                  {prods.map((compound) => (
                    <Link href={compound.href} key={compound.slug}>
                      {compound.image ? <img src={compound.image} alt="" /> : null}
                      {compound.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </aside>
            <div className="abody prose">
              {/* eslint-disable-next-line react/no-danger -- sanitised at harvest time */}
              <div className="pcr-article" lang={lang} dangerouslySetInnerHTML={{ __html: parts.html }} />
              <div className="midcta">
                <Ms name="sell" />
                <div>
                  <b>{lead ? t(`Researching ${lead.name}?`) : t('Researching peptides?')}</b>
                  <small>{t('15% off 5+ vials, 20% off 10+. COA on most products.')}</small>
                </div>
                <Link className="btn sm" href={lead ? lead.href : links.catalog}>{t('Shop now')}</Link>
              </div>
              <p className="disc">{t('For laboratory research only. This article is educational and is not medical advice. We don\'t provide dosing or treatment guidance.')}</p>
            </div>
          </div>
        </div>
      </article>

      {prods.length ? (
        <section className="pb alt">
          <div className="wrap">
            <div className="hh"><h2>{t('Compounds in this article')}</h2></div>
            <ProductGrid compounds={prods} />
          </div>
        </section>
      ) : null}

      {related.length ? (
        <section className="pb">
          <div className="wrap">
            <div className="hh"><h2>{t('Keep reading')}</h2></div>
            <div className="posts">
              {related.map((post) => (
                <Link className="post" href={pathHref(post.en, lang)} key={post.en}>
                  <div className="pimg"><Ms name="article" /></div>
                  <small>{t(section.label)}</small>
                  <b>{post.title}</b>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <div className="stickycta" id="stickyCta">
        <div>
          <b>{lead ? lead.name : t('Research peptides')}</b>
          <small>{t('Batch COA · 2–4 day delivery')}</small>
        </div>
        <Link className="btn sm" href={lead ? lead.href : links.catalog}>{t('Shop')}</Link>
      </div>
    </>
  );
}
