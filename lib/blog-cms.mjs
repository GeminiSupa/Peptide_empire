import { cache } from 'react';
import { load } from 'cheerio';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cbanvzipzfmllexraiei.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_zmywxSKfQ6uJmsQGSjzsBA_JRGHLLR2';
const BLOGS_URL = `${SUPABASE_URL}/rest/v1/blogs`;

const requestRows = cache(async (query) => {
  try {
    const response = await fetch(`${BLOGS_URL}?${query}`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      next: { revalidate: 30, tags: ['published-blogs'] },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return [];
    const rows = await response.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
});

const segment = (value) => String(value || '').replace(/^\/+|\/+$/g, '');
const faq = (value) => Array.isArray(value) ? value.map((entry) => ({ question: String(entry?.question || '').trim(), answer: String(entry?.answer || '').trim() })).filter((entry) => entry.question && entry.answer) : [];

export const getPublishedBlogs = cache(async () => requestRows('published=eq.true&select=*&order=published_at.desc.nullslast,created_at.desc'));

export const getPublishedBlogBySlug = cache(async (slug, lang = 'en') => {
  const clean = segment(slug);
  if (!clean) return null;
  if (lang === 'es') {
    const translated = await requestRows(`published=eq.true&slug_es=eq.${encodeURIComponent(clean)}&select=*&limit=1`);
    if (translated[0]) return translated[0];
  }
  const rows = await requestRows(`published=eq.true&slug=eq.${encodeURIComponent(clean)}&select=*&limit=1`);
  return rows[0] || null;
});

const escapeHtml = (value) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function simpleMarkdown(value) {
  return String(value || '').split(/\n{2,}/).map((block) => {
    const text = block.trim();
    if (!text) return '';
    const heading = text.match(/^(#{2,4})\s+(.+)$/s);
    if (heading) return `<h${heading[1].length}>${escapeHtml(heading[2])}</h${heading[1].length}>`;
    return `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

const ALLOWED = new Set(['p', 'br', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'blockquote', 'a', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'code', 'pre']);
const ATTRS = { a: new Set(['href', 'title']), img: new Set(['src', 'alt', 'title', 'width', 'height', 'loading']), h2: new Set(['id']), h3: new Set(['id']), h4: new Set(['id']) };
const safeUrl = (value) => /^(https?:|mailto:|tel:|\/|#)/i.test(String(value || '').trim());

/** Sanitize authenticated CMS HTML before it reaches a public page. */
export function sanitizeBlogHtml(value) {
  const source = /<[a-z][\s\S]*>/i.test(String(value || '')) ? String(value) : simpleMarkdown(value);
  const $ = load(`<div id="cms-blog-root">${source}</div>`, null, false);
  $('#cms-blog-root script, #cms-blog-root style, #cms-blog-root iframe, #cms-blog-root object, #cms-blog-root embed, #cms-blog-root form').remove();
  $('#cms-blog-root *').each((_, element) => {
    const tag = String(element.tagName || '').toLowerCase();
    if (!ALLOWED.has(tag)) { $(element).replaceWith($(element).contents()); return; }
    for (const name of Object.keys(element.attribs || {})) {
      if (!(ATTRS[tag]?.has(name))) $(element).removeAttr(name);
    }
    if (tag === 'a') {
      if (!safeUrl($(element).attr('href'))) $(element).removeAttr('href');
      else $(element).attr('rel', 'noopener noreferrer');
    }
    if (tag === 'img') {
      if (!safeUrl($(element).attr('src'))) { $(element).remove(); return; }
      $(element).attr('loading', 'lazy');
    }
  });
  return $('#cms-blog-root').html() || '';
}

export function blogPaths(row) {
  const enSlug = segment(row?.slug);
  const esSlug = segment(row?.slug_es) || enSlug;
  return { en: `/blog/${enSlug}/`, es: `/es/blog/${esSlug}/` };
}

export function blogToPage(row) {
  if (!row?.slug) return null;
  const paths = blogPaths(row);
  return {
    ...paths,
    slug: segment(row.slug),
    group: 'blogPost',
    head: {
      title_en: row.title_en,
      title_es: row.title_es || row.title_en,
      description_en: row.seo_description_en || row.excerpt_en,
      description_es: row.seo_description_es || row.excerpt_es || row.excerpt_en,
    },
    sections: [
      { type: 'heading', content: { level: 1, text_en: row.title_en, text_es: row.title_es || row.title_en } },
      { type: 'article', content: { html_en: sanitizeBlogHtml(row.content_en), html_es: sanitizeBlogHtml(row.content_es || row.content_en) } },
    ],
    cms: {
      image: row.image_url || null,
      author: row.author_name || 'Peptides Costa Rica',
      category: row.category || 'Research journal',
      tags: Array.isArray(row.tags) ? row.tags : [],
      summary_en: row.ai_summary_en || '',
      summary_es: row.ai_summary_es || row.ai_summary_en || '',
      faq_en: faq(row.faq_en),
      faq_es: faq(row.faq_es),
      published: row.published_at || row.created_at,
      modified: row.updated_at,
      seo_title_en: row.seo_title_en || row.title_en,
      seo_title_es: row.seo_title_es || row.title_es || row.title_en,
      focus_keyword_en: row.focus_keyword_en || '',
      focus_keyword_es: row.focus_keyword_es || '',
    },
  };
}

export function metadataForBlog(row, lang) {
  const page = blogToPage(row);
  if (!page) return {};
  const es = lang === 'es';
  const canonical = `https://peptidescostarica.net${es ? page.es : page.en}`;
  const title = page.cms[es ? 'seo_title_es' : 'seo_title_en'];
  const description = page.head[es ? 'description_es' : 'description_en'];
  const image = page.cms.image;
  const keywords = page.cms[es ? 'focus_keyword_es' : 'focus_keyword_en'];
  return {
    title: { absolute: title }, description, keywords: keywords ? [keywords, ...page.cms.tags] : page.cms.tags,
    authors: [{ name: page.cms.author }],
    alternates: { canonical, languages: { 'en-US': `https://peptidescostarica.net${page.en}`, 'es-CR': `https://peptidescostarica.net${page.es}`, 'x-default': `https://peptidescostarica.net${page.en}` } },
    openGraph: { type: 'article', url: canonical, siteName: 'Peptides Costa Rica', title, description, locale: es ? 'es_CR' : 'en_US', publishedTime: page.cms.published, modifiedTime: page.cms.modified, authors: [page.cms.author], images: image ? [{ url: image }] : undefined },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : undefined },
  };
}
