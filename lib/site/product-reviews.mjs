/**
 * Customer reviews staff approved in the catalog admin (`product_reviews`,
 * status "Approved"), read with the public key as the catalog's product view
 * reads them. A review belongs to the exact product string it was left on
 * ("Tesamorelin 10mg"); a compound page shows those of all its strengths.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cbanvzipzfmllexraiei.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_zmywxSKfQ6uJmsQGSjzsBA_JRGHLLR2';

const URL = `${SUPABASE_URL}/rest/v1/product_reviews`
  + '?select=id,product_name,customer_name,rating,comment,created_at&status=eq.Approved&order=created_at.desc&limit=500';

/** Every approved review. Never throws: none on failure. Refreshed every 10 minutes. */
export async function getApprovedReviews() {
  try {
    const response = await fetch(URL, {
      headers: { apikey: SUPABASE_ANON_KEY },
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return [];
    const rows = await response.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** The reviews for `compound`: those left on any of its strengths, newest first. */
export function reviewsForCompound(reviews, compound) {
  const names = new Set((compound?.variants || []).map((variant) => variant.product));
  return (reviews || []).filter((review) => names.has(review.product_name) && String(review.comment || '').trim());
}

/** "María Fernanda López" → "María Fernanda L." — the public page shows no surnames. */
export function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(' ')} ${parts.at(-1)[0]}.`;
}
