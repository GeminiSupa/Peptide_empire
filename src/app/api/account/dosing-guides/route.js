import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { CustomerSessionError, resolveCustomerOrderOwner } from '@/lib/customerOrderOwnership.mjs';
import { listDosingGuides } from '@/lib/dosingGuides.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const customer = await resolveCustomerOrderOwner(getSupabaseAdmin(), request.headers.get('authorization'));
    if (!customer?.id) return Response.json({ error: 'Sign in required.' }, { status: 401 });
    return Response.json({ guides: await listDosingGuides() }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof CustomerSessionError) return Response.json({ error: error.message }, { status: error.status });
    console.error('[account/dosing-guides]', error);
    return Response.json({ error: 'Unable to load the guide library.' }, { status: 500 });
  }
}
