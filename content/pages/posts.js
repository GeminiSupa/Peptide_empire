/**
 * Blog posts, at `/blog/<slug>/` and `/es/blog/<slug>/`.
 *
 * Kept out of the single-segment registry because they live under their own
 * prefix. Spanish keeps the `/blog/` segment but translates the post slug —
 * `/blog/what-is-retatrutide/` is served at `/es/blog/que-es-la-retatrutida/`.
 *
 * Harvested as JSON like every other page. The CMS is a separate phase; when it
 * lands these become `site_cms_page_sections` rows exactly like the rest, since
 * they already carry the shared `{ type, content }` section shape.
 */
import postData from '@/data/pages/blogPost.json';

const segment = (path) => path.replace(/^\/|\/$/g, '').split('/').pop();

const PAGES = postData.pages.map((page) => ({ ...page, group: 'blogPost' }));

const BY_EN = new Map(PAGES.map((p) => [segment(p.en), p]));
const BY_ES = new Map(PAGES.filter((p) => p.es).map((p) => [segment(p.es), p]));

export const posts = PAGES;

export const byEnglishSlug = (slug) => BY_EN.get(slug) ?? null;
export const bySpanishSlug = (slug) => BY_ES.get(slug) ?? null;

export const englishParams = () => [...BY_EN.keys()].map((slug) => ({ slug }));
export const spanishParams = () => [...BY_ES.keys()].map((slug) => ({ slug }));
