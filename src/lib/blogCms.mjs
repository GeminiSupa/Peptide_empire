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
    ai_summary_en: '', ai_summary_es: '', author_name: 'Peptides Costa Rica', category: 'Research journal',
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

const words = (value) => String(value || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
const includes = (value, keyword) => !keyword || String(value || '').toLowerCase().includes(String(keyword).trim().toLowerCase());

export function seoChecklist(blog, lang) {
  const suffix = lang === 'es' ? 'es' : 'en';
  const title = blog[`seo_title_${suffix}`] || blog[`title_${suffix}`];
  const description = blog[`seo_description_${suffix}`] || blog[`excerpt_${suffix}`];
  const keyword = blog[`focus_keyword_${suffix}`];
  const content = blog[`content_${suffix}`];
  return [
    { label: 'SEO title is 45–65 characters', pass: title.length >= 45 && title.length <= 65 },
    { label: 'Description is 130–165 characters', pass: description.length >= 130 && description.length <= 165 },
    { label: 'Focus phrase appears in title', pass: Boolean(keyword) && includes(title, keyword) },
    { label: 'Focus phrase appears in description', pass: Boolean(keyword) && includes(description, keyword) },
    { label: 'Article has at least 300 words', pass: words(content) >= 300 },
    { label: 'Article contains a section heading', pass: /<h2\b|^##\s/m.test(String(content || '')) },
    { label: 'Cover image is selected', pass: Boolean(blog.image_url) },
    { label: 'Answer summary is completed', pass: Boolean(blog[`ai_summary_${suffix}`]?.trim()) },
  ];
}
