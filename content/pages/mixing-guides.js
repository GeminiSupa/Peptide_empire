/**
 * The mixing & dosage guides, at `/blog/guide/<slug>/` and
 * `/es/blog/guia/<slug>/`.
 *
 * A `guide` custom post type on the live WordPress, and a separate collection
 * from content/pages/registry.js for the same reason blog posts are: they live
 * under their own two-segment prefix, so keying them by last segment in the
 * root namespace could collide with a city or a product lander.
 *
 * Note the Spanish prefix is `guia`, not `guide` — TranslatePress translates the
 * post-type slug as well as the page slug, and /es/blog/guide/<slug>/ only 301s
 * to it. Both segments are reproduced exactly; see data/routes.json.
 */
import guideData from '@/data/pages/mixingGuide.json';

const segment = (path) =>
  String(path || '')
    .replace(/^\/|\/$/g, '')
    .split('/')
    .pop();

const PAGES = guideData.pages.map((page) => ({ ...page, group: 'mixingGuide' }));

const BY_EN = new Map(PAGES.map((p) => [segment(p.en), p]));
const BY_ES = new Map(PAGES.filter((p) => p.es).map((p) => [segment(p.es), p]));

export const mixingGuides = PAGES;

export const byEnglishSlug = (slug) => BY_EN.get(slug) ?? null;
export const bySpanishSlug = (slug) => BY_ES.get(slug) ?? null;

export const englishParams = () => [...BY_EN.keys()].map((slug) => ({ slug }));
export const spanishParams = () => [...BY_ES.keys()].map((slug) => ({ slug }));
