import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { scopedAdmin } from '@/lib/siteScopedAdmin.mjs';
import { verifyAdminSession } from '@/lib/adminAuth';
import { recordAdminActivity } from '@/lib/adminActivityLog.mjs';
import { LAB_BATCHES_MIGRATION, parseStickerCode } from '@/lib/labBatches.mjs';
import { packingLinesForOrder, productMatchKey, verifyPackingEntries } from '@/lib/packingScan.mjs';

export const runtime = 'nodejs';

// Same "gone" statuses the Fulfillment queue drops, so a packer cannot record
// a box for an order nobody is going to ship.
const DEAD_STATUSES = new Set(['cancelled', 'declined', 'refunded']);

function missingMigration(error) {
  const message = String(error?.message || '').toLowerCase();
  const namesOurColumn = ['code', 'kind', 'packed_items', 'packed_at', 'packed_by']
    .some((column) => message.includes(column));
  return namesOurColumn
    && (message.includes('schema cache') || message.includes('does not exist') || message.includes('could not find'));
}

function migrationResponse() {
  return NextResponse.json({
    error: `Run ${LAB_BATCHES_MIGRATION} in the Supabase SQL editor first.`,
    migration: LAB_BATCHES_MIGRATION,
  }, { status: 503 });
}

// Every product, hidden and retired ones included: an old order may name one.
async function allProducts(supabase) {
  const { data, error } = await supabase.from('products').select('id, product');
  if (error) throw error;
  return data || [];
}

/**
 * GET ?orderId=<id>  ->  what has to go in that box, each line resolved to its product.
 * GET ?code=<whatever the scanner read>  ->  which product and batch that sticker is.
 */
export async function GET(request) {
  const auth = await verifyAdminSession(request, { requirePermission: 'fulfillment' });
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const supabase = scopedAdmin(auth.activeSite);

    const orderId = String(searchParams.get('orderId') || '').trim();
    if (orderId) {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, items')
        .eq('id', orderId)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order) return NextResponse.json({ error: 'That order no longer exists.' }, { status: 404 });
      return NextResponse.json({ lines: packingLinesForOrder(order, await allProducts(supabase)) });
    }

    const code = parseStickerCode(searchParams.get('code'));
    if (!code) return NextResponse.json({ error: 'Nothing was scanned.' }, { status: 400 });

    const { data, error } = await supabase
      .from('product_batches')
      .select('id, code, kind, product_id, batch_number, expiry_date, products(product)')
      .eq('code', code)
      .maybeSingle();
    if (error) {
      if (missingMigration(error)) return migrationResponse();
      throw error;
    }
    if (!data) {
      return NextResponse.json({ error: `Sticker ${code} is not a known batch.`, code }, { status: 404 });
    }
    return NextResponse.json({
      batch: {
        id: data.id,
        code: data.code,
        kind: data.kind || 'batch',
        product: data.products?.product || '',
        // What the packing screen compares against each line's key.
        key: productMatchKey({ id: data.product_id, product: data.products?.product }),
        batchNumber: data.batch_number || '',
        expiryDate: data.expiry_date,
      },
    });
  } catch (err) {
    console.error('[packing] sticker lookup failed:', err);
    return NextResponse.json({ error: err.message || 'Could not read that sticker' }, { status: 500 });
  }
}

/**
 * Save the packing record once every item in the box is checked.
 * Body: { orderId, entries: [{ method: 'scan', code } | { method: 'manual', key }] }
 *
 * Writes packed_items / packed_at / packed_by and nothing else: no status
 * change, no stock change. Packing it again simply replaces the record.
 */
export async function POST(request) {
  const auth = await verifyAdminSession(request, { requirePermission: 'fulfillment' });
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const orderId = String(body?.orderId || '').trim();
    const entries = Array.isArray(body?.entries) ? body.entries.slice(0, 500) : [];
    if (!orderId) return NextResponse.json({ error: 'Missing order.' }, { status: 400 });

    const supabase = scopedAdmin(auth.activeSite);
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, status, items')
      .eq('id', orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ error: 'That order no longer exists.' }, { status: 404 });
    if (DEAD_STATUSES.has(String(order.status || '').toLowerCase())) {
      return NextResponse.json({ error: `Order #${order.order_number} is ${order.status}; it should not be packed.` }, { status: 409 });
    }

    const codes = [...new Set(entries
      .filter((entry) => entry?.method !== 'manual')
      .map((entry) => String(entry?.code || '').toUpperCase())
      .filter(Boolean))];
    const batchesByCode = new Map();
    if (codes.length > 0) {
      const { data: batches, error: batchError } = await supabase
        .from('product_batches')
        .select('id, code, product_id, products(product)')
        .in('code', codes);
      if (batchError) {
        if (missingMigration(batchError)) return migrationResponse();
        throw batchError;
      }
      for (const batch of batches || []) {
        batchesByCode.set(String(batch.code).toUpperCase(), {
          id: batch.id,
          product_id: batch.product_id,
          product: batch.products?.product || '',
        });
      }
    }

    const verdict = verifyPackingEntries(order, entries, batchesByCode, await allProducts(supabase));
    if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: 400 });

    const packedAt = new Date().toISOString();
    const packedBy = auth.profile?.name || auth.profile?.email || null;
    const { error: updateError } = await supabase
      .from('orders')
      .update({ packed_items: verdict.packedItems, packed_at: packedAt, packed_by: packedBy })
      .eq('id', order.id);
    if (updateError) {
      if (missingMigration(updateError)) return migrationResponse();
      throw updateError;
    }

    const manualCount = verdict.packedItems
      .filter((item) => item.method === 'manual')
      .reduce((sum, item) => sum + item.qty, 0);
    await recordAdminActivity(supabase, {
      actor: auth.profile,
      action: 'order.packed',
      subjectType: 'order',
      subjectId: order.id,
      subjectLabel: `#${order.order_number}`,
      detail: manualCount
        ? `Scan-checked, ${manualCount} item(s) checked by hand`
        : 'Every item scan-checked',
      request,
    }).catch(() => {});

    return NextResponse.json({
      packedItems: verdict.packedItems,
      packedAt,
      packedBy,
    });
  } catch (err) {
    console.error('[packing] save failed:', err);
    return NextResponse.json({ error: err.message || 'Could not save the packing record' }, { status: 500 });
  }
}
