'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Users, ShoppingBag, DollarSign, UserPlus, MessageCircle, Mail, Sparkles, X, Eye } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';
import { accountKindLabel } from '@/lib/accountHome.mjs';
import { formatCrDate } from '@/lib/crTime.mjs';

const card = { padding: 16, border: '1px solid #334155', borderRadius: 12, background: 'linear-gradient(145deg,#0f172a,#172554)' };
const muted = { color: '#94a3b8', fontSize: '.82rem' };
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value || 0));
const actionButton = { display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 38, padding: '8px 12px', border: '1px solid #334155', borderRadius: 9, background: '#172554', color: '#e0f2fe', fontWeight: 700, cursor: 'pointer' };

export default function CustomerAccountsPanel() {
  const [data, setData] = useState({ accounts: [], total: 0, page: 1, pageSize: 25 });
  const [query, setQuery] = useState('');
  const [draftQuery, setDraftQuery] = useState('');
  const [kind, setKind] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [ai, setAi] = useState(null);

  const load = useCallback(async (page = 1, nextQuery = query, nextKind = kind) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (nextQuery) params.set('q', nextQuery);
      if (nextKind) params.set('kind', nextKind);
      const response = await adminFetch(`/api/admin/crm/customer-accounts?${params}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not load accounts');
      setData(body);
    } catch (loadError) { setError(loadError.message || 'Could not load accounts'); }
    finally { setLoading(false); }
  }, [query, kind]);

  useEffect(() => { load(); }, [load]);
  const applySearch = (event) => { event?.preventDefault(); const next = draftQuery.trim(); setQuery(next); load(1, next, kind); };
  const changeKind = (next) => { setKind(next); load(1, query, next); };
  const removeAccount = async (account) => {
    const name = account.display_name || account.email;
    if (!window.confirm(`Delete the login for ${name}? Orders stay, but the profile and saved addresses are removed.`)) return;
    setBusyId(account.user_id); setError('');
    try {
      const response = await adminFetch('/api/admin/crm/customer-accounts', { method: 'DELETE', body: JSON.stringify({ userId: account.user_id }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not delete the account');
      await load(data.accounts.length === 1 && data.page > 1 ? data.page - 1 : data.page);
    } catch (deleteError) { setError(deleteError.message || 'Could not delete the account'); }
    finally { setBusyId(''); }
  };
  const openAccount = async (account) => {
    setSelected({ account, detail: null, error: '' }); setAi(null); setDetailLoading(true);
    try { const response = await adminFetch(`/api/admin/crm/customer-accounts/${account.user_id}`); const body = await response.json(); if (!response.ok) throw new Error(body.error); setSelected({ account, detail: body, error: '' }); }
    catch (loadError) { setSelected({ account, detail: null, error: loadError.message || 'Could not load account intelligence.' }); }
    finally { setDetailLoading(false); }
  };
  const getAi = async () => {
    if (!selected?.account) return; setAiLoading(true); setAi(null);
    try { const response = await adminFetch(`/api/admin/crm/customer-accounts/${selected.account.user_id}`, { method: 'POST' }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setAi(body.insight); }
    catch (aiError) { setAi({ error: aiError.message || 'Could not create AI insight.' }); }
    finally { setAiLoading(false); }
  };
  const summary = data.summary;
  const pages = Math.max(1, Math.ceil((data.total || 0) / (data.pageSize || 25)));

  return <section style={{ maxWidth: 1400, margin: '0 auto', color: '#e2e8f0' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', alignItems: 'end', marginBottom: 18 }}>
      <div><p style={{ ...muted, textTransform: 'uppercase', letterSpacing: 1.4, margin: '0 0 5px' }}>Customer workspace · individual accounts</p><h2 style={{ margin: 0 }}>Individual customer accounts</h2><p style={{ ...muted, marginBottom: 0 }}>Purchase health, product interest, and outreach actions for people—not company accounts.</p></div>
      <button type="button" onClick={() => load(data.page)} disabled={loading}>Refresh</button>
    </div>
    {summary ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 18 }}>
      {[[Users, 'Accounts', summary.total_accounts], [UserPlus, 'New · 30 days', summary.new_accounts_30d], [ShoppingBag, 'Customers who bought', summary.purchasing_accounts], [DollarSign, 'Lifetime value', money(summary.total_lifetime_value)]].map(([Icon, label, value]) => <div key={label} style={card}><Icon size={18} color="#38bdf8" /><span style={{ ...muted, display: 'block', marginTop: 10 }}>{label}</span><strong style={{ fontSize: 25 }}>{value}</strong></div>)}
    </div> : <p style={{ ...muted, marginBottom: 18 }}>Apply <code>customer-account-analytics.sql</code> to enable purchase KPIs and segment analytics.</p>}
    {summary && <div style={{ ...card, marginBottom: 18 }}><strong>Account mix</strong><div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, ...muted }}>{[['Individual', summary.individual_accounts], ['Research', summary.research_accounts], ['Clinic', summary.clinic_accounts], ['Other', summary.other_accounts]].map(([label, value]) => <span key={label}><b style={{ color: '#f8fafc' }}>{value}</b> {label}</span>)}</div></div>}
    {!data.questionsReady && <p style={{ color: '#fbbf24' }}>Run <code>customer-account-questions.sql</code> to filter by account type and organization.</p>}
    {!data.analyticsReady && <p style={{ color: '#fbbf24' }}>Purchase metrics are temporarily unavailable; account search and management remain active.</p>}
    {error && <p style={{ color: '#f87171' }}>{error}</p>}
    <form onSubmit={applySearch} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      <label style={{ flex: '1 1 320px', position: 'relative' }}><Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} /><input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="Search name, email, phone, organization" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 10px 10px 34px' }} /></label>
      <select value={kind} onChange={(event) => changeKind(event.target.value)}><option value="">All account types</option><option value="individual">Individual</option><option value="research">Research</option><option value="clinic">Clinic</option><option value="other">Other</option></select><button type="submit">Search</button>
    </form>
    <p style={{ ...muted, margin: '0 0 8px' }}>{data.total || 0} matching account{data.total === 1 ? '' : 's'} · page {data.page} of {pages}</p>
    <div style={{ overflowX: 'auto', border: '1px solid #334155', borderRadius: 12 }}><table style={{ width: '100%', minWidth: 930, borderCollapse: 'collapse', textAlign: 'left' }}><thead style={{ background: '#172554' }}><tr><th style={{ padding: 12 }}>Account</th><th>Type</th><th>Joined</th><th>Orders</th><th>Lifetime value</th><th>Last order</th><th /></tr></thead><tbody>{loading ? <tr><td colSpan="7" style={{ padding: 28, textAlign: 'center', ...muted }}>Loading account page…</td></tr> : data.accounts.length === 0 ? <tr><td colSpan="7" style={{ padding: 28, textAlign: 'center', ...muted }}>No customer accounts match these filters.</td></tr> : data.accounts.map((account) => <tr key={account.user_id} style={{ borderTop: '1px solid #334155' }}><td style={{ padding: 12 }}><strong>{account.display_name || account.email}</strong><div style={muted}>{account.email}{account.phone ? ` · ${account.phone}` : ''}{account.organization_name ? ` · ${account.organization_name}` : ''}</div></td><td>{accountKindLabel(account.account_kind, 'en') || '—'}</td><td>{account.created_at ? formatCrDate(account.created_at, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td><td>{account.order_count ?? '—'}</td><td>{account.lifetime_value === undefined ? '—' : money(account.lifetime_value)}</td><td>{account.last_order_at ? formatCrDate(account.last_order_at, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td><td style={{ whiteSpace: 'nowrap' }}><button type="button" onClick={() => openAccount(account)} style={actionButton}><Eye size={15} /> View profile</button> <button type="button" disabled={busyId === account.user_id} onClick={() => removeAccount(account)} style={{ ...actionButton, marginLeft: 6, color: '#fca5a5', background: 'transparent', borderColor: '#7f1d1d' }}>{busyId === account.user_id ? 'Deleting…' : 'Delete'}</button></td></tr>)}</tbody></table></div>
    <div style={{ display: 'flex', justifyContent: 'end', alignItems: 'center', gap: 10, marginTop: 14 }}><button type="button" onClick={() => load(data.page - 1)} disabled={loading || data.page <= 1}><ChevronLeft size={16} /> Previous</button><button type="button" onClick={() => load(data.page + 1)} disabled={loading || data.page >= pages}>Next <ChevronRight size={16} /></button></div>
    {selected && <div role="dialog" aria-modal="true" style={{ position: 'fixed', zIndex: 30, inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(2,6,23,.78)', padding: 18 }}><div style={{ width: 'min(900px, 100%)', maxHeight: 'calc(100vh - 36px)', overflowY: 'auto', background: '#0f172a', border: '1px solid #334155', borderRadius: 16, padding: 22, boxShadow: '0 24px 70px rgba(0,0,0,.5)' }}><div style={{ position: 'sticky', top: -22, zIndex: 1, display: 'flex', justifyContent: 'space-between', gap: 12, padding: '22px 0 14px', marginTop: -22, background: '#0f172a', borderBottom: '1px solid #1e293b' }}><div><p style={{ ...muted, margin: 0 }}>Individual account intelligence</p><h2 style={{ margin: '4px 0' }}>{selected.account.display_name || selected.account.email}</h2><p style={{ ...muted, margin: 0 }}>{selected.account.email} {selected.account.phone ? `· ${selected.account.phone}` : ''}</p></div><button onClick={() => setSelected(null)} aria-label="Close profile" title="Close profile" style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', borderRadius: 10, border: '1px solid #475569', background: '#172554', color: '#e2e8f0', cursor: 'pointer' }}><X size={20} /></button></div>{detailLoading ? <p style={{ padding: 30, ...muted }}>Loading purchases and interests…</p> : selected.error ? <p style={{ color: '#fca5a5' }}>{selected.error}</p> : selected.detail && <><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0' }}><a href={`mailto:${selected.detail.account.email}`}><button style={actionButton}><Mail size={16} /> Email customer</button></a>{selected.detail.account.phone && <a target="_blank" rel="noreferrer" href={`https://wa.me/${String(selected.detail.account.phone).replace(/\D/g, '')}`}><button style={actionButton}><MessageCircle size={16} /> WhatsApp</button></a>}<button disabled={aiLoading} onClick={getAi} style={{ ...actionButton, background: '#4c1d95', borderColor: '#7c3aed' }}><Sparkles size={16} /> {aiLoading ? 'Preparing brief…' : 'Ask AI for next step'}</button></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>{[['Relationship', selected.detail.account.state.label], ['Orders', selected.detail.account.order_count], ['Lifetime value', money(selected.detail.account.lifetime_value)], ['Products of interest', selected.detail.account.interests.length]].map(([label, value]) => <div key={label} style={card}><small style={muted}>{label}</small><strong style={{ display: 'block', marginTop: 4 }}>{value}</strong></div>)}</div><div style={{ ...card, marginTop: 14 }}><strong>Product interest</strong><p style={{ ...muted }}>Derived from the customer’s actual order history—not inferred health or research intent.</p><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{selected.detail.account.interests.length ? selected.detail.account.interests.map(product => <span key={product} style={{ padding: '6px 9px', borderRadius: 99, background: '#1e3a8a' }}>{product}</span>) : <span style={muted}>No product interest recorded yet.</span>}</div></div>{ai && <div style={{ ...card, marginTop: 14, borderColor: '#7c3aed' }}>{ai.error ? <p style={{ color: '#fca5a5' }}>{ai.error}</p> : <><strong><Sparkles size={16} /> AI customer brief</strong><p>{ai.summary}</p><p><b>Recommended action:</b> {ai.recommended_action}</p><details><summary>Review suggested WhatsApp</summary><p style={{ whiteSpace: 'pre-wrap' }}>{ai.whatsapp}</p></details><details><summary>Review suggested email</summary><p><b>{ai.email_subject}</b></p><p style={{ whiteSpace: 'pre-wrap' }}>{ai.email}</p></details></>}</div>}<h3 style={{ marginTop: 20 }}>Recent orders</h3>{selected.detail.orders.map(order => <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: '1px solid #334155' }}><span><b>{order.order_number || 'Order'}</b> · {cleanItemsForUi(order.items).join(', ') || 'Products unavailable'}</span><span>{money(order.total_usd)} · {formatCrDate(order.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>)}</>}</div></div>}
  </section>;
}

function cleanItemsForUi(value) { try { const items = Array.isArray(value) ? value : JSON.parse(value || '[]'); return items.map(item => item?.product || item?.name).filter(Boolean).slice(0, 4); } catch { return []; } }
