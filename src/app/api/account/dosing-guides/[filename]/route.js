import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { CustomerSessionError, resolveCustomerOrderOwner } from '@/lib/customerOrderOwnership.mjs';
import { readDosingGuide } from '@/lib/dosingGuides.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const customer = await resolveCustomerOrderOwner(getSupabaseAdmin(), request.headers.get('authorization'));
    if (!customer?.id) return Response.json({ error: 'Sign in required.' }, { status: 401 });
    const { filename } = await params;
    const pdf = await readDosingGuide(filename);
    if (!pdf) return Response.json({ error: 'Guide not found.' }, { status: 404 });
    return new Response(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`, 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof CustomerSessionError) return Response.json({ error: error.message }, { status: error.status });
    console.error('[account/dosing-guide]', error);
    return Response.json({ error: 'Unable to open this guide.' }, { status: 500 });
  }
}
