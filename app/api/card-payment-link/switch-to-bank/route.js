// Copied from the catalog (src/app/api/card-payment-link/switch-to-bank/route.js) by scripts/sync-catalog-checkout.mjs. Do not edit.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/catalog/lib/supabaseAdmin';
import {
  cardPaymentAccessMatchesOrder,
  verifyCardPaymentAccessToken,
} from '@/catalog/lib/cardPaymentLink';
import {
  bankAvailability,
  bankPaymentSnapshot,
  isBankMethod,
  readBankSettings,
} from '@/catalog/lib/bankPayments.mjs';
import { createBankPaymentToken } from '@/catalog/lib/bankPaymentToken.mjs';
import { isAwaitingPayment } from '@/catalog/lib/orderAwaitingPayment.mjs';
import { readLimitedJson } from '@/catalog/lib/publicApiSecurity.mjs';

export const runtime = 'nodejs';

/**
 * Move an order that is waiting on a card to SINPE Móvil or bank transfer.
 *
 * The card page used to be a dead end: the order already existed, the page
 * offered one button, and a customer who wanted to pay another way could only
 * go back and order again — leaving the first order sitting in the admin as
 * "Pending - Card" forever. This switches the order that already exists.
 *
 * What makes it safe to do from the browser:
 * - The signed card link is the proof of ownership; it is the same token the
 *   page used to load the order, and it is checked against this order.
 * - Only an order still waiting for money may move. A paid one, a refused one,
 *   and one whose charge is in flight ('Processing - Card', which the card lock
 *   writes) all fail `isAwaitingPayment`, so a switch cannot race a charge.
 * - The write is a compare-and-swap on the status and method it read, so if the
 *   webhook marks the order paid in between, nothing is overwritten.
 * - Nothing about the money changes: the bank instructions are built by the
 *   same `bankPaymentSnapshot` the checkout uses, from the order's own total.
 */
export async function POST(request) {
  try {
    const { body } = await readLimitedJson(request, 4096);
    const orderNumber = String(body?.order || '').trim();
    const token = String(body?.token || '').trim();
    const method = String(body?.method || '').trim();

    if (!orderNumber || !token) {
      return NextResponse.json({ error: 'Payment link is missing order or token details' }, { status: 400 });
    }
    if (!isBankMethod(method)) {
      return NextResponse.json({ error: 'Unknown payment method' }, { status: 422 });
    }

    const access = verifyCardPaymentAccessToken(orderNumber, token);
    if (!access) {
      return NextResponse.json({ error: 'Payment link signature is invalid. Please request a fresh payment link.' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_number, status, payment_method, currency, total_usd, total_crc, activity_log')
      .eq('order_number', orderNumber)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (!cardPaymentAccessMatchesOrder(access, order)) {
      return NextResponse.json({ error: 'Payment link signature is invalid. Please request a fresh payment link.' }, { status: 403 });
    }
    if (!isAwaitingPayment(order.status)) {
      return NextResponse.json({
        error: 'This order is no longer waiting for payment. / Este pedido ya no está esperando pago.',
      }, { status: 409 });
    }

    const settings = await readBankSettings(supabase);
    if (!bankAvailability(settings)[method]) {
      return NextResponse.json({
        error: 'That payment method is not available right now. / Ese método de pago no está disponible ahora.',
      }, { status: 409 });
    }

    const payment = bankPaymentSnapshot(settings, { ...order, payment_method: method });
    const previous = Array.isArray(order.activity_log) ? order.activity_log : [];
    const at = new Date().toISOString();
    const activity_log = [
      {
        at,
        type: 'bank_payment_instructions',
        by: 'system',
        message: 'Awaiting BAC payment - verify received funds before marking paid.',
        payment,
      },
      {
        at,
        type: 'payment_method_changed',
        by: 'customer',
        message: `Customer switched from card to ${method === 'sinpe' ? 'SINPE Móvil' : 'bank transfer'} on the card page.`,
      },
      ...previous,
    ].slice(0, 100);

    // Compare-and-swap: if the webhook marked this order paid, or staff moved
    // it, between the read above and here, nothing is written.
    const { data: updated, error: updateError } = await supabase
      .from('orders')
      .update({ payment_method: method, status: 'Pending', activity_log })
      .eq('id', order.id)
      .eq('status', order.status)
      .eq('payment_method', order.payment_method)
      .select('id');

    if (updateError || !updated?.length) {
      return NextResponse.json({
        error: 'The order changed while you were switching. Refresh the page. / El pedido cambió. Recargue la página.',
      }, { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      method,
      bankPaymentToken: createBankPaymentToken(String(order.id)),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[card-payment-link/switch-to-bank]', err);
    return NextResponse.json({ error: 'Could not change the payment method. Please try again.' }, { status: err?.status || 500 });
  }
}
