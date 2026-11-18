export const BLOG_FIELDS = [
  'slug', 'slug_es', 'title_en', 'title_es', 'excerpt_en', 'excerpt_es',
  'content_en', 'content_es', 'image_url', 'seo_title_en', 'seo_title_es',
  'seo_description_en', 'seo_description_es', 'focus_keyword_en',
  'focus_keyword_es', 'ai_summary_en', 'ai_summary_es', 'author_name',
  'category', 'tags', 'faq_en', 'faq_es', 'published', 'published_at',
];

export function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

export function emptyBlog() {
  return {
    slug: '', slug_es: '', title_en: '', title_es: '', excerpt_en: '', excerpt_es: '',
    content_en: '', content_es: '', image_url: '', seo_title_en: '', seo_title_es: '',
    seo_description_en: '', seo_description_es: '', focus_keyword_en: '', focus_keyword_es: '',
    ai_summary_en: '', ai_summary_es: '', author_name: 'Peptidos Colombia', category: 'Research journal',
    tags: [], faq_en: [], faq_es: [], published: false, published_at: null, _slugAuto: true,
  };
}

export function normalizeFaq(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => ({ question: String(entry?.question || '').trim(), answer: String(entry?.answer || '').trim() }))
    .filter((entry) => entry.question || entry.answer);
}

export function blogPayload(blog, now = new Date().toISOString()) {
  const payload = Object.fromEntries(BLOG_FIELDS.map((field) => [field, blog[field] ?? null]));
  payload.slug = slugify(blog.slug);
  payload.slug_es = slugify(blog.slug_es) || payload.slug;
  payload.tags = Array.isArray(blog.tags) ? blog.tags.map((tag) => String(tag).trim()).filter(Boolean) : [];
  payload.faq_en = normalizeFaq(blog.faq_en);
  payload.faq_es = normalizeFaq(blog.faq_es);
  payload.published = Boolean(blog.published);
  payload.published_at = payload.published ? (blog.published_at || now) : (blog.published_at || null);
  return payload;
}

const stripHtml = (value) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const wordList = (value) => stripHtml(value).split(/\s+/).filter(Boolean);
const words = (value) => wordList(value).length;
const includes = (value, keyword) => !keyword || String(value || '').toLowerCase().includes(String(keyword).trim().toLowerCase());

// "to be" + past participle = the usual passive marker. A rough count, but good
// enough to flag an article that leans passive (the guide wants under ~10%).
const PASSIVE = /\b(?:is|are|was|were|be|been|being|am)\b\s+(?:\w+ed|done|made|given|taken|seen|known|shown|written|built|held|sent|found|kept|told|put)\b/i;

export function analyzeWriting(content, keyword) {
  const text = stripHtml(content);
  const total = wordList(text).length;
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length > 2);
  const passive = sentences.filter((s) => PASSIVE.test(s)).length;
  const passivePct = sentences.length ? Math.round((passive / sentences.length) * 100) : 0;
  let density = 0;
  const phrase = String(keyword || '').trim().toLowerCase();
  if (phrase && total) {
    const hits = (text.toLowerCase().match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    const phraseWords = phrase.split(/\s+/).length;
    density = Math.round(((hits * phraseWords) / total) * 1000) / 10;
  }
  return { words: total, sentences: sentences.length, passivePct, density };
}

// Builds the HTML we drop into the article body when an image is inserted, so
// every body image carries alt text (and an optional visible caption).
export function buildFigureHtml({ url, alt = '', caption = '' }) {
  const safe = (v) => String(v || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const text = (v) => String(v || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fig = caption ? `\n  <figcaption>${text(caption)}</figcaption>` : '';
  return `\n<figure class="blog-figure">\n  <img src="${safe(url)}" alt="${safe(alt)}" loading="lazy" />${fig}\n</figure>\n`;
}

export function seoChecklist(blog, lang) {
  const suffix = lang === 'es' ? 'es' : 'en';
  const title = blog[`seo_title_${suffix}`] || blog[`title_${suffix}`] || '';
  const description = blog[`seo_description_${suffix}`] || blog[`excerpt_${suffix}`] || '';
  const keyword = blog[`focus_keyword_${suffix}`];
  const content = String(blog[`content_${suffix}`] || '');
  const stats = analyzeWriting(content, keyword);
  // Every <img> in the body should carry non-empty alt text.
  const imgs = content.match(/<img\b[^>]*>/gi) || [];
  const imgsMissingAlt = imgs.filter((tag) => !/\balt\s*=\s*["'][^"']+["']/i.test(tag)).length;
  return [
    { label: 'SEO title is 45–65 characters', pass: title.length >= 45 && title.length <= 65 },
    { label: 'Description is 130–165 characters', pass: description.length >= 130 && description.length <= 165 },
    { label: 'Focus phrase appears in title', pass: Boolean(keyword) && includes(title, keyword) },
    { label: 'Focus phrase appears in description', pass: Boolean(keyword) && includes(description, keyword) },
    { label: 'Article has at least 300 words', pass: stats.words >= 300 },
    { label: 'Keyword density is under 2%', pass: Boolean(keyword) && stats.density > 0 && stats.density < 2 },
    { label: 'Passive voice is under 10%', pass: stats.words >= 50 && stats.passivePct < 10 },
    { label: 'Article contains a section heading', pass: /<h2\b|^##\s/m.test(content) },
    { label: 'Cover image is selected', pass: Boolean(blog.image_url) },
    { label: 'Every body image has alt text', pass: imgsMissingAlt === 0 },
    { label: 'Answer summary is completed', pass: Boolean(blog[`ai_summary_${suffix}`]?.trim()) },
  ];
}
