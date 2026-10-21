import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminSession } from '@/lib/adminAuth';
import { writeDroppingMissingColumns } from '@/lib/optionalColumns.mjs';
import { recordAdminActivity } from '@/lib/adminActivityLog.mjs';
import {
  planOffsiteTransfer,
  summariseOffsiteStock,
} from '@/lib/offsiteInventory.mjs';

export const runtime = 'nodejs';

const MIGRATION = 'add-offsite-inventory.sql';

function missingOffsiteColumn(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('offsite_inventory_count')
    && (message.includes('schema cache') || message.includes('does not exist') || message.includes('could not find'));
}

/** List every tracked product with total / off-site / on-site counts. */
export async function GET(request) {
  const auth = await verifyAdminSession(request, { requirePermission: 'offsite_inventory' });
  if (auth.error) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('products')
      .select('id, product, status, inventory_count, offsite_inventory_count')
      .order('product', { ascending: true });

    if (error) {
      if (missingOffsiteColumn(error)) {
        return NextResponse.json({
          error: `Run ${MIGRATION} in the Supabase SQL editor first.`,
          migration: MIGRATION,
          rows: [],
        }, { status: 503 });
      }
      throw error;
    }

    const rows = summariseOffsiteStock(data || []);
    return NextResponse.json({
      rows,
      totals: {
        products: rows.length,
        offsiteUnits: rows.reduce((sum, row) => sum + row.offsite, 0),
        onSiteUnits: rows.reduce((sum, row) => sum + row.onSite, 0),
        totalUnits: rows.reduce((sum, row) => sum + row.total, 0),
        emptyOffsite: rows.filter((row) => row.low).length,
      },
    });
  } catch (err) {
    console.error('[offsite-inventory] list failed:', err);
    return NextResponse.json({ error: err.message || 'Failed to load off-site stock' }, { status: 500 });
  }
}

/**
 * Move vials to the off-site packer, or take them back.
 * Body: { productId or product, qty, direction: 'to_offsite' | 'from_offsite' }
 */
export async function POST(request) {
  const auth = await verifyAdminSession(request, { requirePermission: 'offsite_inventory' });
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const qty = Number(body?.qty);
    const direction = String(body?.direction || '').trim();
    const productId = String(body?.productId || '').trim();
    const productName = String(body?.product || '').trim();

    if (!productId && !productName) {
      return NextResponse.json({ error: 'Pick a product.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('products')
      .select('id, product, status, inventory_count, offsite_inventory_count');
    query = productId ? query.eq('id', productId) : query.eq('product', productName);
    const { data: product, error: readError } = await query.maybeSingle();

    if (readError) {
      if (missingOffsiteColumn(readError)) {
        return NextResponse.json({
          error: `Run ${MIGRATION} in the Supabase SQL editor first.`,
          migration: MIGRATION,
        }, { status: 503 });
      }
      throw readError;
    }
    if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });

    const plan = planOffsiteTransfer(product, { qty, direction });
    if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: 409 });

    const { error: writeError } = await writeDroppingMissingColumns(
      { offsite_inventory_count: plan.after },
      ['offsite_inventory_count'],
      (row) => {
        if (!('offsite_inventory_count' in row)) {
          return Promise.resolve({
            error: { message: `column offsite_inventory_count does not exist — run ${MIGRATION}` },
          });
        }
        return supabase.from('products').update(row).eq('id', product.id);
      },
    );

    if (writeError) {
      if (missingOffsiteColumn(writeError) || String(writeError.message || '').includes(MIGRATION)) {
        return NextResponse.json({
          error: `Run ${MIGRATION} in the Supabase SQL editor first.`,
          migration: MIGRATION,
        }, { status: 503 });
      }
      throw writeError;
    }

    const verb = direction === 'to_offsite' ? 'Gave' : 'Took back';
    await recordAdminActivity(supabase, {
      actor: auth.profile,
      action: direction === 'to_offsite' ? 'offsite.gave' : 'offsite.took_back',
      subjectType: 'product',
      subjectId: product.id,
      subjectLabel: product.product,
      detail: `${verb} ${plan.qty} vial(s) (${plan.before} → ${plan.after} off site)`,
      request,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      product: product.product,
      direction,
      qty: plan.qty,
      offsite: plan.after,
      onSite: plan.total - plan.after,
      total: plan.total,
    });
  } catch (err) {
    console.error('[offsite-inventory] transfer failed:', err);
    return NextResponse.json({ error: err.message || 'Could not move stock' }, { status: 500 });
  }
}
