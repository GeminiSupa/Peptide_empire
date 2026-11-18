import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { scopedAdmin } from '@/lib/siteScopedAdmin.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const cleanItems = (value) => {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch { return []; }
};
const productNames = (orders) => [...new Set(orders.flatMap(order => cleanItems(order.items).map(item => String(item?.product || item?.name || '').trim()).filter(Boolean)))].slice(0, 12);
const customerState = (account, orders) => {
  const last = orders[0]?.created_at ? Date.parse(orders[0].created_at) : 0;
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  if (!orders.length) return { label: 'Needs activation', tone: 'slate', reason: 'Has an account but no completed purchase yet.' };
  if (days <= 30) return { label: 'Active', tone: 'green', reason: `Purchased ${days === 0 ? 'today' : `${days} days ago`}.` };
  if (days <= 90) return { label: 'Due for follow-up', tone: 'amber', reason: `Last purchase was ${days} days ago.` };
  return { label: 'At risk', tone: 'red', reason: `No purchase in ${days} days.` };
};

async function detail(admin, userId) {
  const { data: account, error } = await admin.from('customer_profiles').select('user_id,email,display_name,phone,locale,created_at,account_kind,organization_name').eq('user_id', userId).maybeSingle();
  if (error || !account) return { error: 'Customer account not found.', status: 404 };
  const { data: orders, error: ordersError } = await admin.from('orders').select('id,order_number,items,total_usd,status,created_at').eq('customer_user_id', userId).order('created_at', { ascending: false }).limit(100);
  if (ordersError) return { error: 'Could not load customer orders.', status: 503 };
  const rows = orders || [];
  const spend = rows.reduce((total, order) => total + (['cancelled', 'canceled'].includes(String(order.status || '').toLowerCase()) ? 0 : Number(order.total_usd || 0)), 0);
  return { account: { ...account, order_count: rows.length, lifetime_value: spend, interests: productNames(rows), state: customerState(account, rows) }, orders: rows.slice(0, 12) };
}

export async function GET(request, { params }) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true });
  if (auth.error) return auth.error;
  const { userId } = await params;
  const result = await detail(scopedAdmin(auth.activeSite), userId);
  return result.error ? NextResponse.json({ error: result.error }, { status: result.status }) : NextResponse.json(result);
}

export async function POST(request, { params }) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true });
  if (auth.error) return auth.error;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI is not configured on the server.' }, { status: 503 });
  const { userId } = await params;
  const result = await detail(scopedAdmin(auth.activeSite), userId);
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
  const account = result.account;
  const prompt = `You are a careful customer-success assistant for a Costa Rica research-peptide retailer. Create JSON with keys summary, recommended_action, whatsapp, email_subject, email. Base it only on this account data: name=${account.display_name || 'Customer'}; language=${account.locale || 'es'}; orders=${account.order_count}; lifetime_value_usd=${account.lifetime_value}; last-state=${account.state.label}; products=${account.interests.join(', ') || 'none'}. Be concise, helpful, and never give dosage, medical, therapeutic, or research-result claims. Do not pressure the customer. Write WhatsApp and email in ${account.locale === 'en' ? 'English' : 'Spanish'}.`;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: 'gpt-4o-mini', response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }], temperature: 0.4 }), signal: AbortSignal.timeout(20000) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || 'AI drafting failed');
    const insight = JSON.parse(body.choices?.[0]?.message?.content || '{}');
    return NextResponse.json({ insight, model: 'gpt-4o-mini' });
  } catch (error) { return NextResponse.json({ error: error.message || 'AI drafting failed.' }, { status: 502 }); }
}
