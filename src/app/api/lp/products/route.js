import { NextResponse } from 'next/server';
import { fetchCatalogProductsServer } from '@/lib/catalogProducts';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [{ products, dbBacked }, hiddenResult] = await Promise.all([
      fetchCatalogProductsServer(),
      getSupabaseAdmin().from('site_settings').select('value').eq('id', 'hidden_products').maybeSingle(),
    ]);
    if (hiddenResult.error) throw hiddenResult.error;
    const hiddenNames = new Set(Array.isArray(hiddenResult.data?.value?.names) ? hiddenResult.data.value.names : []);
    const visibleProducts = products.filter((product) => !hiddenNames.has(product.product));
    return NextResponse.json({
      ok: true,
      dbBacked,
      products: visibleProducts.map((p) => ({
        product: p.product,
        category: p.category,
        priceUsd: p.priceUsd,
        priceCrc: p.priceCrc,
        status: p.status,
        inventoryCount: p.inventoryCount,
        coa: p.coa,
        imageUrl: p.imageUrl,
        vialSize: p.vialSize,
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[api/lp/products] Could not load the live catalog:', error);
    return NextResponse.json({ ok: false, error: 'Could not load the live catalog' }, { status: 500 });
  }
}
