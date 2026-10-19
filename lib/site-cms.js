import { cache } from 'react';
import globalData from '@/data/global.json';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://cbanvzipzfmllexraiei.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || 'sb_publishable_zmywxSKfQ6uJmsQGSjzsBA_JRGHLLR2';

const publishedDocument = cache(async (path) => {
  try {
    const url = `${SUPABASE_URL}/rest/v1/site_cms_documents?path=eq.${encodeURIComponent(path)}&state=eq.published&select=page&limit=1`;
    const response = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY },
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const rows = await response.json();
    return rows?.[0]?.page && typeof rows[0].page === 'object' ? rows[0].page : null;
  } catch {
    return null;
  }
});

// WooCommerce page bodies include old standalone price widgets and an old
// shipping threshold. Commerce details must come from the current catalog.
function withoutHarvestedCommerce(node) {
  if (Array.isArray(node)) return node.map(withoutHarvestedCommerce).filter((item) => item !== null);
  if (!node || typeof node !== 'object') return node;
  if (node.type === 'heading' && /^₡\s*[\d,.]+$/.test(node.content?.text_en || '')) return null;
  if (/^(?:FREE Shipping Over|Envío GRATIS a partir de)\s*₡/i.test(node.text_en || node.text_es || '')) return null;
  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, withoutHarvestedCommerce(value)]));
}

/** Published CMS content replaces the harvested copy, while routes stay fixed for SEO. */
export async function getPublishedPage(sourcePage) {
  if (!sourcePage) return null;
  const path = sourcePage.en || '/';
  const page = await publishedDocument(path);
  const merged = page ? {
    ...sourcePage,
    ...page,
    en: sourcePage.en,
    es: sourcePage.es,
    slug: sourcePage.slug,
    kind: sourcePage.kind,
    group: sourcePage.group,
  } : sourcePage;
  return sourcePage.group === 'wooProduct'
    ? { ...merged, sections: withoutHarvestedCommerce(merged.sections) }
    : merged;
}

export async function getPublishedGlobal() {
  return (await publishedDocument('/site-global/')) || globalData;
}
