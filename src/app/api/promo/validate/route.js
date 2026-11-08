import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { countPromoEligibleUnits, checkUnitLimits, unitLimitsMessage } from '@/lib/promoEligibility.mjs';
import { findLiveDealConflictForPromo, promoDealConflictMessage } from '@/lib/promoStackingSafety.mjs';

export async function POST(request) {
  try {
    const body = await request.json();
    const { code } = body;
    // The shopper's language, so a wrong or expired code is explained in it.
    const lang = body?.lang === 'en' ? 'en' : 'es';

    if (!code) {
      return NextResponse.json({ valid: false, error: lang === 'en' ? 'No code provided' : 'No se ingresó ningún código' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Standardize code to uppercase and trimmed
    const cleanCode = code.trim().toUpperCase();

    // Query the database for the code and join the affiliate table to get the commission rate
    const { data: promo, error } = await supabase
      .from('promo_codes')
      .select(`
        id,
        code,
        discount_pct,
        is_active,
        valid_from,
        valid_until,
        target_product,
        is_flash_sale,
        min_units,
        max_units,
        usage_limit,
        usage_count,
        affiliate_id,
        affiliates (
          commission_rate
        )
      `)
      .eq('code', cleanCode)
      .eq('is_active', true)
      .single();

    if (error || !promo) {
      return NextResponse.json({ valid: false, error: lang === 'en' ? 'Invalid or inactive promo code.' : 'Código promocional inválido o inactivo.' });
    }

    // Check date boundaries if they exist
    const now = new Date();
    if (promo.valid_from && now < new Date(promo.valid_from)) {
      return NextResponse.json({ valid: false, error: lang === 'en' ? 'Promo code is not yet active.' : 'El código promocional todavía no está activo.' });
    }
    if (promo.valid_until && now > new Date(promo.valid_until)) {
      return NextResponse.json({ valid: false, error: lang === 'en' ? 'Promo code has expired.' : 'El código promocional venció.' });
    }

    // Check usage limits
    if (promo.usage_limit !== null && promo.usage_count >= promo.usage_limit) {
      return NextResponse.json({ valid: false, error: lang === 'en' ? 'Promo code has already been used or reached its usage limit.' : 'El código promocional ya fue utilizado o alcanzó su límite de uso.' });
    }

    const dealConflict = await findLiveDealConflictForPromo(supabase, promo);
    if (dealConflict) {
      return NextResponse.json({
        valid: false,
        error: promoDealConflictMessage(promo, dealConflict.products, lang),
      });
    }

    // Unit conditions (minimum and maximum). Checked here rather than only in
    // the browser so they cannot be sidestepped by calling this endpoint
    // directly.
    // A targeted code counts only the products it covers, so the cart's own
    // total is the wrong number to judge it by. Recomputed here from the lines
    // themselves whenever the browser sends them, which also means the figure
    // the gate reads is no longer one the browser chose.
    //
    // unitCount stays as the fallback for an untargeted code, where the browser
    // has already excluded BAC water the way the volume tiers do.
    const unitCount = Array.isArray(body?.items) && String(promo.target_product || '').trim()
      ? countPromoEligibleUnits(promo, body.items)
      : body?.unitCount;

    const unitCheck = checkUnitLimits(promo, unitCount);
    if (!unitCheck.ok) {
      return NextResponse.json({
        valid: false,
        pending: unitCheck.reason === 'min',
        code: promo.code,
        discount_pct: promo.discount_pct,
        target_product: promo.target_product,
        is_flash_sale: promo.is_flash_sale,
        error: unitLimitsMessage(promo, unitCheck.unitCount, lang),
        min_units: unitCheck.minUnits,
        max_units: unitCheck.maxUnits,
        unit_count: unitCheck.unitCount,
      });
    }

    // Success: Return the discount and affiliate data to the frontend
    return NextResponse.json({
      valid: true,
      code: promo.code,
      discount_pct: promo.discount_pct,
      // Returned so the cart can re-check as items change, not just on entry.
      min_units: promo.min_units || 0,
      target_product: promo.target_product,
      is_flash_sale: promo.is_flash_sale,
      affiliate_id: promo.affiliate_id,
      commission_rate: promo.affiliates?.commission_rate || 0.10 // Fallback to 10% if undefined
    });

  } catch (err) {
    console.error('[Promo API] Validation error:', err);
    return NextResponse.json({ valid: false, error: 'Server error validating code / Error del servidor al validar el código' }, { status: 500 });
  }
}
