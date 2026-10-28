'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/adminApi';

const fields = ['email', 'legal_name', 'trading_name', 'corporation_number', 'contact_name', 'phone', 'billing_address', 'delivery_address'];
const empty = { status: 'pending', discount_pct: 0 };

export default function BusinessAccountsPanel() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    const res = await adminFetch('/api/admin/business-accounts');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setRows(data.businesses || []);
  }
  useEffect(() => { load().catch(err => setMessage(err.message)); }, []);
  async function act(body) {
    setBusy(true); setMessage('');
    try {
      const res = await adminFetch('/api/admin/business-accounts', { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const failed = (data.notifications || []).filter(result => !result.sent);
      setMessage(failed.length
        ? `Account saved. Staff email alerts failed for: ${failed.map(result => result.destination).join(', ')}. Check SMTP settings and retry the staff alert.`
        : body.action === 'notify' ? 'Staff alerts sent to Omer and info.' : body.action === 'invite' ? 'Invitation sent.' : 'Business account saved. Send the invitation when ready.');
      if (data.business) setForm(data.business);
      await load();
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  }
  return <section style={{ padding: 20, marginBottom: 24, border: '1px solid #334155', borderRadius: 14 }}>
    <h3>Business accounts</h3><p>Create a company, approve its discount, then send its customer-account invitation. Only the owner can manage these terms.</p>
    {message && <p role="status">{message}</p>}
    <button type="button" disabled={busy} onClick={() => setForm(empty)}>New business</button>
    <form onSubmit={event => { event.preventDefault(); act(form); }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, margin: '16px 0' }}>
      {fields.map(key => <label key={key} style={{ display: 'grid', gap: 6 }}>{key.replaceAll('_', ' ')}<input type={key === 'email' ? 'email' : 'text'} value={form[key] || ''} readOnly={key === 'email' && Boolean(form.id)} required={!['trading_name', 'delivery_address'].includes(key)} maxLength={key.endsWith('address') ? 1000 : 200} onChange={e => setForm({ ...form, [key]: e.target.value })} style={{ padding: 9, color: '#0f172a', background: '#fff', borderRadius: 6 }} /></label>)}
      <label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ display: 'block', padding: 9 }}><option value="pending">Pending</option><option value="approved">Approved</option><option value="suspended">Suspended</option></select></label>
      <label>Discount %<input type="number" min="0" max="100" step="0.01" required value={form.discount_pct} onChange={e => setForm({ ...form, discount_pct: e.target.value })} style={{ display: 'block', padding: 9 }} /></label>
      <button disabled={busy} type="submit">{busy ? 'Working…' : 'Save business account'}</button>
    </form>
    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left' }}><thead><tr><th>Company</th><th>Login email</th><th>Status</th><th>Discount</th><th>Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.legal_name}<br /><small>{row.corporation_number}</small></td><td>{row.email}</td><td>{row.status}</td><td>{row.discount_pct}%</td><td><button disabled={busy} onClick={() => setForm(row)}>Edit</button> <button disabled={busy || row.status !== 'approved'} onClick={() => act({ action: 'invite', id: row.id })}>Send invitation</button> <button disabled={busy} onClick={() => act({ action: 'notify', id: row.id })}>Resend staff alert</button></td></tr>)}</tbody></table></div>
  </section>;
}
