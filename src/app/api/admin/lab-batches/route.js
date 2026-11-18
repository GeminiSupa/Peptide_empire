import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { scopedAdmin } from '@/lib/siteScopedAdmin.mjs';
import { verifyAdminSession } from '@/lib/adminAuth';
import { profileHasAnyAdminPermission } from '@/lib/adminApiPermissions.mjs';
import { recordAdminActivity } from '@/lib/adminActivityLog.mjs';
import { crStartOfDayIso } from '@/lib/crTime.mjs';
import {
  LAB_BATCHES_MIGRATION,
  batchCodeBase,
  cleanDateInput,
  cleanReportUrl,
  nextBatchCode,
  oldStockCode,
  productCodePrefix,
} from '@/lib/labBatches.mjs';

export const runtime = 'nodejs';

const BATCH_COLUMNS = 'id, code, kind, product_id, batch_number, supplier_name, vial_count, manufactured_date, expiry_date, coa_url, notes, created_at, created_by, products(product)';

function missingMigration(error) {
  const message = String(error?.message || '').toLowerCase();
  const namesOurColumn = ['code', 'kind', 'coa_url', 'created_by', 'packed_items', 'packed_at', 'packed_by', 'product_batches']
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

function shapeBatch(row) {
  return {
    id: row.id,
    code: row.code,
    kind: row.kind || 'batch',
    productId: row.product_id,
    product: row.products?.product || '',
    batchNumber: row.batch_number || '',
    supplierName: row.supplier_name || '',
    vialCount: Number(row.vial_count) || 0,
    madeDate: row.manufactured_date,
    expiryDate: row.expiry_date,
    coaUrl: row.coa_url || '',
    notes: row.notes || '',
    createdAt: row.created_at,
    createdBy: row.created_by || '',
  };
}

const actorName = (profile) => profile?.name || profile?.email || null;

/**
 * GET                  every batch, newest first, plus the product list for the form.
 * GET ?orders=<code>   the orders that batch was packed into (the recall list).
 */
export async function GET(request) {
  const auth = await verifyAdminSession(request, { requirePermission: 'lab_batches' });
  if (auth.error) return auth.error;

  try {
    const supabase = scopedAdmin(auth.activeSite);
    const { searchParams } = new URL(request.url);
    const recallCode = String(searchParams.get('orders') || '').trim().toUpperCase();

    if (recallCode) {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_phone, status, created_at, packed_at, packed_by, packed_items')
        // As a JSON string: given an array, supabase-js writes a Postgres
        // array literal, which a jsonb column refuses outright.
        .contains('packed_items', JSON.stringify([{ batch_code: recallCode }]))
        .order('packed_at', { ascending: false });
      if (error) {
        if (missingMigration(error)) return migrationResponse();
        throw error;
      }
      // Names and phone numbers are customer data: only people who can already
      // see orders or customers get them. Everyone else gets the count.
      const canSeeCustomers = profileHasAnyAdminPermission(auth.profile, ['orders', 'customers']);
      const orders = (data || []).map((order) => ({
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        createdAt: order.created_at,
        packedAt: order.packed_at,
        packedBy: order.packed_by,
        qty: (order.packed_items || [])
          .filter((item) => String(item?.batch_code || '').toUpperCase() === recallCode)
          .reduce((sum, item) => sum + (Number(item?.qty) || 0), 0),
        ...(canSeeCustomers
          ? { customerName: order.customer_name, customerPhone: order.customer_phone }
          : {}),
      }));
      return NextResponse.json({ code: recallCode, orders, customersHidden: !canSeeCustomers });
    }

    const [batchesResult, productsResult] = await Promise.all([
      supabase.from('product_batches').select(BATCH_COLUMNS).order('created_at', { ascending: false }),
      supabase.from('products').select('id, product, status, inventory_count').order('product', { ascending: true }),
    ]);
    if (batchesResult.error) {
      if (missingMigration(batchesResult.error)) return migrationResponse();
      throw batchesResult.error;
    }
    if (productsResult.error) throw productsResult.error;

    return NextResponse.json({
      // Rows from before this feature have no code and cannot be printed or scanned.
      batches: (batchesResult.data || []).filter((row) => row.code).map(shapeBatch),
      products: (productsResult.data || []).map((product) => ({
        id: product.id,
        product: product.product,
        status: product.status,
        inventoryCount: product.inventory_count,
      })),
    });
  } catch (err) {
    console.error('[lab-batches] list failed:', err);
    return NextResponse.json({ error: err.message || 'Could not load batches' }, { status: 500 });
  }
}

async function codesStartingWith(supabase, start) {
  const { data, error } = await supabase.from('product_batches').select('code').like('code', `${start}%`);
  if (error) throw error;
  return (data || []).map((row) => row.code);
}

/**
 * Create a batch and give it its sticker code.
 * Body: { kind: 'batch' | 'old_stock', productId, vialCount, batchNumber,
 *         supplierName, madeDate, expiryDate, coaUrl, notes }
 *
 * 'old_stock' is one per product: asking again hands back the existing one,
 * so reprinting old-stock stickers never makes a second code for the same shelf.
 */
export async function POST(request) {
  const auth = await verifyAdminSession(request, { requirePermission: 'lab_batches' });
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const kind = body?.kind === 'old_stock' ? 'old_stock' : 'batch';
    const productId = String(body?.productId || '').trim();
    if (!productId) return NextResponse.json({ error: 'Pick a product.' }, { status: 400 });

    const vialCount = Math.max(0, Math.floor(Number(body?.vialCount) || 0));
    if (kind === 'batch' && vialCount < 1) {
      return NextResponse.json({ error: 'Enter how many vials are in this batch.' }, { status: 400 });
    }
    const madeDate = cleanDateInput(body?.madeDate);
    const expiryDate = cleanDateInput(body?.expiryDate);
    const coaUrl = cleanReportUrl(body?.coaUrl);
    if (String(body?.coaUrl || '').trim() && !coaUrl) {
      return NextResponse.json({ error: 'The lab report link is not a valid web address.' }, { status: 400 });
    }

    const supabase = scopedAdmin(auth.activeSite);
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, product')
      .eq('id', productId)
      .maybeSingle();
    if (productError) throw productError;
    if (!product) return NextResponse.json({ error: 'That product no longer exists.' }, { status: 404 });

    if (kind === 'old_stock') {
      const { data: existing, error: existingError } = await supabase
        .from('product_batches')
        .select(BATCH_COLUMNS)
        .eq('product_id', product.id)
        .eq('kind', 'old_stock')
        .limit(1);
      if (existingError) {
        if (missingMigration(existingError)) return migrationResponse();
        throw existingError;
      }
      if (existing?.[0]) return NextResponse.json({ batch: shapeBatch(existing[0]), reused: true });
    }

    // Two people creating a batch for the same product in the same second can
    // pick the same free code; the unique index refuses the second, and it
    // simply takes the next one.
    let created = null;
    for (let attempt = 0; attempt < 4 && !created; attempt += 1) {
      const code = kind === 'old_stock'
        ? oldStockCode(product.product, await codesStartingWith(supabase, `${productCodePrefix(product.product)}-OLD`))
        : nextBatchCode(batchCodeBase(product.product), await codesStartingWith(supabase, `${batchCodeBase(product.product)}-`));
      if (!code) return NextResponse.json({ error: 'No free sticker code left for this product this month.' }, { status: 409 });

      const { data, error } = await supabase
        .from('product_batches')
        .insert({
          product_id: product.id,
          code,
          kind,
          batch_number: String(body?.batchNumber || '').trim() || (kind === 'old_stock' ? 'Old stock' : code),
          supplier_name: String(body?.supplierName || '').trim() || null,
          vial_count: vialCount,
          manufactured_date: madeDate ? crStartOfDayIso(madeDate) : null,
          expiry_date: expiryDate ? crStartOfDayIso(expiryDate) : null,
          coa_url: coaUrl || null,
          notes: String(body?.notes || '').trim() || null,
          created_by: actorName(auth.profile),
        })
        .select(BATCH_COLUMNS)
        .single();
      if (error) {
        if (missingMigration(error)) return migrationResponse();
        if (error.code === '23505') continue;
        throw error;
      }
      created = data;
    }
    if (!created) return NextResponse.json({ error: 'Could not reserve a sticker code. Try again.' }, { status: 409 });

    await recordAdminActivity(supabase, {
      actor: auth.profile,
      action: kind === 'old_stock' ? 'lab_batch.old_stock_created' : 'lab_batch.created',
      subjectType: 'product_batch',
      subjectId: created.id,
      subjectLabel: `${created.code} · ${product.product}`,
      detail: kind === 'old_stock' ? 'Old-stock sticker code' : `${vialCount} vial(s)`,
      request,
    }).catch(() => {});

    return NextResponse.json({ batch: shapeBatch(created), reused: false });
  } catch (err) {
    console.error('[lab-batches] create failed:', err);
    return NextResponse.json({ error: err.message || 'Could not create the batch' }, { status: 500 });
  }
}

/**
 * Edit a batch's details. The code, product and kind never change: stickers
 * carrying them may already be on vials.
 * Body: { id, batchNumber?, supplierName?, vialCount?, madeDate?, expiryDate?, coaUrl?, notes? }
 */
export async function PATCH(request) {
  const auth = await verifyAdminSession(request, { requirePermission: 'lab_batches' });
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing batch id.' }, { status: 400 });

    const changes = {};
    if (body.batchNumber !== undefined) {
      const batchNumber = String(body.batchNumber || '').trim();
      if (!batchNumber) return NextResponse.json({ error: 'Batch number cannot be empty.' }, { status: 400 });
      changes.batch_number = batchNumber;
    }
    if (body.supplierName !== undefined) changes.supplier_name = String(body.supplierName || '').trim() || null;
    if (body.vialCount !== undefined) changes.vial_count = Math.max(0, Math.floor(Number(body.vialCount) || 0));
    if (body.madeDate !== undefined) {
      const madeDate = cleanDateInput(body.madeDate);
      changes.manufactured_date = madeDate ? crStartOfDayIso(madeDate) : null;
    }
    if (body.expiryDate !== undefined) {
      const expiryDate = cleanDateInput(body.expiryDate);
      changes.expiry_date = expiryDate ? crStartOfDayIso(expiryDate) : null;
    }
    if (body.coaUrl !== undefined) {
      const coaUrl = cleanReportUrl(body.coaUrl);
      if (String(body.coaUrl || '').trim() && !coaUrl) {
        return NextResponse.json({ error: 'The lab report link is not a valid web address.' }, { status: 400 });
      }
      changes.coa_url = coaUrl || null;
    }
    if (body.notes !== undefined) changes.notes = String(body.notes || '').trim() || null;
    if (Object.keys(changes).length === 0) return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });

    const supabase = scopedAdmin(auth.activeSite);
    const { data, error } = await supabase
      .from('product_batches')
      .update(changes)
      .eq('id', id)
      .select(BATCH_COLUMNS)
      .maybeSingle();
    if (error) {
      if (missingMigration(error)) return migrationResponse();
      throw error;
    }
    if (!data) return NextResponse.json({ error: 'That batch no longer exists.' }, { status: 404 });

    await recordAdminActivity(supabase, {
      actor: auth.profile,
      action: 'lab_batch.edited',
      subjectType: 'product_batch',
      subjectId: data.id,
      subjectLabel: `${data.code} · ${data.products?.product || ''}`,
      detail: `Changed: ${Object.keys(changes).join(', ')}`,
      request,
    }).catch(() => {});

    return NextResponse.json({ batch: shapeBatch(data) });
  } catch (err) {
    console.error('[lab-batches] edit failed:', err);
    return NextResponse.json({ error: err.message || 'Could not save the batch' }, { status: 500 });
  }
}
