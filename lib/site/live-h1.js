import { pageTitle } from '@/lib/page-title';

/**
 * The H1 a page shows on the live site today, from its harvested blocks.
 *
 * The brief keeps every page's H1 unchanged through the redesign, so a
 * template that draws its own heading takes the text from here rather than
 * from the prototype. Falls back to the page title (without the brand
 * suffix) for pages whose H1 was printed by the WordPress theme.
 */
export function liveH1(page, lang = 'en') {
  let found = null;
  const walk = (node) => {
    if (found || !node || typeof node !== 'object') return;
    if (node.type === 'heading' && node.content?.level === 1) {
      found = node.content[`text_${lang}`] || node.content.text_en || null;
      return;
    }
    for (const value of Object.values(node)) walk(value);
  };
  walk(page?.sections);
  return found || pageTitle(page, lang);
}
