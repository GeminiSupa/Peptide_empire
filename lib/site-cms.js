import { cache } from 'react';
import globalData from '@/data/global.json';
import { scrubUsdForPage, withoutHarvestedCommerce, withoutHarvestedGlobal } from '@/lib/harvest-commerce.mjs';

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
  return withoutHarvestedCommerce(merged, { scrubUsd: scrubUsdForPage(sourcePage.group, sourcePage.en) });
}

export async function getPublishedGlobal() {
  return withoutHarvestedGlobal((await publishedDocument('/site-global/')) || globalData);
}
