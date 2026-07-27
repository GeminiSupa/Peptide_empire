import { DEFAULT_LANG } from '@/lib/routes';

/**
 * Read a bilingual field out of a content object.
 *
 * Every text field in content/ and data/ is stored twice, suffixed `_en` and
 * `_es`. Components never read `content.title` — they call `t(content, 'title',
 * lang)` so that adding a language, or moving this content into the database
 * later, changes nothing in the components.
 *
 * Missing Spanish falls back to English rather than rendering an empty element:
 * a page with a hole in it is worse than a page with one section in the wrong
 * language, and `missingTranslations()` reports them so they can be filled in.
 */
export function t(content, key, lang = DEFAULT_LANG) {
  if (!content) return '';
  const wanted = content[`${key}_${lang}`];
  if (wanted != null && wanted !== '') return wanted;
  const fallback = content[`${key}_en`] ?? content[`${key}_es`];
  return fallback ?? '';
}

/** Same as `t`, but for a `{ label_en, label_es }`-shaped item. */
export function label(item, lang = DEFAULT_LANG) {
  return t(item, 'label', lang);
}

/** True when the requested language has no value and a fallback was used. */
export function isFallback(content, key, lang) {
  if (!content) return false;
  const wanted = content[`${key}_${lang}`];
  return (wanted == null || wanted === '') && Boolean(content[`${key}_en`] || content[`${key}_es`]);
}

/**
 * Walk a content object and list every text key missing a translation.
 * Used by scripts/validate-content.mjs, not at render time.
 */
export function missingTranslations(node, lang = 'es', path = '') {
  const missing = [];
  if (Array.isArray(node)) {
    node.forEach((item, i) => missing.push(...missingTranslations(item, lang, `${path}[${i}]`)));
    return missing;
  }
  if (!node || typeof node !== 'object') return missing;

  for (const [key, value] of Object.entries(node)) {
    if (value && typeof value === 'object') {
      missing.push(...missingTranslations(value, lang, path ? `${path}.${key}` : key));
      continue;
    }
    if (!key.endsWith('_en')) continue;
    const base = key.slice(0, -3);
    const other = node[`${base}_${lang}`];
    if (other == null || other === '') {
      missing.push(`${path ? `${path}.` : ''}${base}`);
    }
  }
  return missing;
}
