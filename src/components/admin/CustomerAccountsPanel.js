'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Users, ShoppingBag, DollarSign, UserPlus } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';
import { accountKindLabel } from '@/lib/accountHome.mjs';
import { formatCrDate } from '@/lib/crTime.mjs';

const card = { padding: 16, border: '1px solid #334155', borderRadius: 12, background: 'linear-gradient(145deg,#0f172a,#172554)' };
const muted = { color: '#94a3b8', fontSize: '.82rem' };
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value || 0));

export default function CustomerAccountsPanel() {
  const [data, setData] = useState({ accounts: [], total: 0, page: 1, pageSize: 25 });
  const [query, setQuery] = useState('');
  const [draftQuery, setDraftQuery] = useState('');
  const [kind, setKind] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

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
  const summary = data.summary;
  const pages = Math.max(1, Math.ceil((data.total || 0) / (data.pageSize || 25)));

  return <section style={{ maxWidth: 1400, margin: '0 auto', color: '#e2e8f0' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', alignItems: 'end', marginBottom: 18 }}>
      <div><p style={{ ...muted, textTransform: 'uppercase', letterSpacing: 1.4, margin: '0 0 5px' }}>Account intelligence</p><h2 style={{ margin: 0 }}>Customer accounts</h2><p style={{ ...muted, marginBottom: 0 }}>Searchable login records and purchase health — separate from the order CRM.</p></div>
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
    <div style={{ overflowX: 'auto', border: '1px solid #334155', borderRadius: 12 }}><table style={{ width: '100%', minWidth: 870, borderCollapse: 'collapse', textAlign: 'left' }}><thead style={{ background: '#172554' }}><tr><th style={{ padding: 12 }}>Account</th><th>Type</th><th>Joined</th><th>Orders</th><th>Lifetime value</th><th>Last order</th><th /></tr></thead><tbody>{loading ? <tr><td colSpan="7" style={{ padding: 28, textAlign: 'center', ...muted }}>Loading account page…</td></tr> : data.accounts.length === 0 ? <tr><td colSpan="7" style={{ padding: 28, textAlign: 'center', ...muted }}>No customer accounts match these filters.</td></tr> : data.accounts.map((account) => <tr key={account.user_id} style={{ borderTop: '1px solid #334155' }}><td style={{ padding: 12 }}><strong>{account.display_name || account.email}</strong><div style={muted}>{account.email}{account.phone ? ` · ${account.phone}` : ''}{account.organization_name ? ` · ${account.organization_name}` : ''}</div></td><td>{accountKindLabel(account.account_kind, 'en') || '—'}</td><td>{account.created_at ? formatCrDate(account.created_at, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td><td>{account.order_count ?? '—'}</td><td>{account.lifetime_value === undefined ? '—' : money(account.lifetime_value)}</td><td>{account.last_order_at ? formatCrDate(account.last_order_at, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td><td><button type="button" disabled={busyId === account.user_id} onClick={() => removeAccount(account)} style={{ color: '#fca5a5' }}>{busyId === account.user_id ? 'Deleting…' : 'Delete'}</button></td></tr>)}</tbody></table></div>
    <div style={{ display: 'flex', justifyContent: 'end', alignItems: 'center', gap: 10, marginTop: 14 }}><button type="button" onClick={() => load(data.page - 1)} disabled={loading || data.page <= 1}><ChevronLeft size={16} /> Previous</button><button type="button" onClick={() => load(data.page + 1)} disabled={loading || data.page >= pages}>Next <ChevronRight size={16} /></button></div>
  </section>;
}
