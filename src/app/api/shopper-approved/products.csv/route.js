import { supabase } from '@/lib/supabase';
import { LIVE_SITE_URL } from '@/lib/publicUrl';
import { getProductFallbackImage } from '@/lib/catalogProducts';
import { isBacWater, isSellableBacWater } from '@/lib/bacWater.mjs';
import { shopperApprovedFeedCsv, shopperApprovedFeedRows } from '@/lib/shopperApproved.mjs';

export const dynamic = 'force-dynamic';

/**
 * Product feed for Shopper Approved (Setup > Product Integration > dynamic feed).
 *
 * They read it about once a week, so a product added in the admin reaches them
 * without anyone uploading a file. The ids match what the thank-you page sends
 * in `sa_products`; without that match a product review attaches to nothing.
 *
 * Lists what the public catalog lists: hidden products and BAC sizes that are
 * not for sale are left out, as in the sitemap.
 */
export async function GET() {
  const [{ data: rows, error }, { data: hiddenRow }] = await Promise.all([
    supabase.from('products').select('product, category, image_url, vial_size').order('priority', { ascending: true }),
    supabase.from('site_settings').select('value').eq('id', 'hidden_products').maybeSingle(),
  ]);

  if (error) {
    console.error('[shopper-approved feed] products read failed:', error.message);
    return new Response('Product feed unavailable', { status: 503 });
  }

  const hidden = new Set(Array.isArray(hiddenRow?.value?.names) ? hiddenRow.value.names : []);
  const listed = (rows || [])
    .filter((row) => row?.product && !hidden.has(row.product))
    .filter((row) => !isBacWater(row.product) || isSellableBacWater(row.product))
    .map((row) => ({
      product: row.product,
      vialSize: row.vial_size,
      imageUrl: row.image_url || getProductFallbackImage(row.product, row.category),
    }));

  return new Response(shopperApprovedFeedCsv(shopperApprovedFeedRows(listed, LIVE_SITE_URL)), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
