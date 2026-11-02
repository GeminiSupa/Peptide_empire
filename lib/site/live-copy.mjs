// The live site's copy, reshaped for the new design.
//
// Every harvested page is a tree of Elementor widgets: groups, headings,
// paragraphs, cards, an FAQ, tabs. The new design does not draw that tree; it
// draws sections of its own. The brief says the live wording stays, so the
// text is lifted out of the tree here into plain blocks — a title, its
// paragraphs, its items, its links — that any template can lay out.
//
// Nothing is rewritten. Layout-only widgets (images, product grids, spacers)
// are dropped; every word a visitor or a crawler could read today is kept.

const text = (content, field, lang) => String(content?.[`${field}_${lang}`] ?? content?.[`${field}_en`] ?? '').trim();

/** A heading of this length is a paragraph set large, not a title. */
const LONG_HEADING = 140;

/** Tab bodies were harvested as one run of text; put the breaks back. */
function splitBody(body) {
  return String(body || '')
    .replace(/([.!?:])(?=[A-ZÁÉÍÓÚÑ¿¡])/g, '$1\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** True for a group laid out as numbered or captioned items ("01", "02"…). */
function isItemGroup(node) {
  const numbered = (node.content?.children || []).filter((child) => (
    child.type === 'group'
    && (child.content?.children || []).some((inner) => inner.type === 'heading' && inner.content?.level === 0)
  ));
  // One captioned group is a kicker over a title ("Common Questions"); a
  // run of them is a list of items.
  return numbered.length > 1;
}

/**
 * The copy of a harvested page.
 *
 * Returns `{ h1, blocks, faq }`: `blocks` in page order, each
 * `{ title, paras, items: [{ title, text }], links: [{ text, href }], faq }`
 * (the first may have no title — the page's intro), and `faq` as
 * `[question, answer]` pairs gathered from every FAQ widget on the page.
 */
export function liveCopy(sections, lang = 'en') {
  const blocks = [];
  const faq = [];
  let h1 = '';
  let current = null;

  const block = (title = '') => {
    current = { title, paras: [], items: [], links: [], faq: [] };
    blocks.push(current);
    return current;
  };
  const here = () => current || block();

  function walk(nodes, inItems) {
    for (const node of nodes || []) {
      const c = node.content || {};
      switch (node.type) {
        case 'heading': {
          const value = text(c, 'text', lang);
          if (!value) break;
          if (c.level === 1) { h1 = h1 || value; break; }
          // Level 0 is Elementor's "eyebrow": item numbers and kickers.
          if (c.level === 0) break;
          if (value.length > LONG_HEADING) { here().paras.push(value); break; }
          if (inItems) here().items.push({ title: value, text: '' });
          else block(value);
          break;
        }
        case 'paragraph': {
          const value = text(c, 'text', lang);
          if (!value) break;
          const items = here().items;
          const last = items[items.length - 1];
          if (inItems && last && !last.text) last.text = value;
          else here().paras.push(value);
          break;
        }
        case 'card':
          here().items.push({ title: text(c, 'title', lang), text: text(c, 'text', lang) });
          break;
        case 'cards':
          for (const item of c.items || []) {
            here().items.push({ title: text(item, 'title', lang), text: text(item, 'text', lang) });
          }
          break;
        case 'list':
          for (const item of c.items || []) {
            const value = typeof item === 'string' ? item : text(item, 'text', lang);
            if (value) here().items.push({ title: '', text: value });
          }
          break;
        case 'faq':
          for (const item of c.items || []) {
            const q = text(item, 'q', lang);
            const a = text(item, 'a', lang);
            if (q && a) { faq.push([q, a]); here().faq.push([q, a]); }
          }
          break;
        case 'tabs':
          for (const item of c.items || []) {
            const paras = splitBody(item[`body_${lang}`] ?? item.body_en);
            if (paras.length) block(text(item, 'label', lang)).paras.push(...paras);
          }
          break;
        case 'button': {
          const value = text(c, 'text', lang);
          if (value && c.href && !c.href.startsWith('#')) here().links.push({ text: value, href: c.href });
          break;
        }
        case 'group':
          walk(c.children, inItems || isItemGroup(node));
          break;
        default:
          break;
      }
    }
  }

  walk(sections, false);
  return {
    h1,
    blocks: blocks.filter((entry) => entry.paras.length || entry.items.length || entry.links.length || entry.faq.length),
    faq,
  };
}
