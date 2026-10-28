'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/adminApi';
import BusinessSuitePanel from './BusinessSuitePanel';

const fields = ['email', 'legal_name', 'trading_name', 'corporation_number', 'contact_name', 'phone', 'billing_address', 'delivery_address'];
const empty = { status: 'pending', discount_pct: 0, minimum_units:0,minimum_order_usd:0,rep_user_id:'',rep_commission_pct:0 };

export default function BusinessAccountsPanel() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reps,setReps]=useState([]);
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
      setMessage(data.customerNotification?.sent===false?'Account saved. Customer notification needs retry in Business operations.':failed.length
        ? `Account saved. Staff email alerts failed for: ${failed.map(result => result.destination).join(', ')}. Check SMTP settings and retry the staff alert.`
        : body.action === 'notify' ? 'Staff alerts sent to Omer and info.' : body.action === 'invite' ? 'Invitation sent.' : 'Business account saved. Send the invitation when ready.');
      if (data.business) setForm(data.business);
      await load();
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  }
  return <section style={{ padding: 20, marginBottom: 24, border: '1px solid #334155', borderRadius: 14 }}>
    <h3>Business accounts</h3>
    <p>Customer sign-in: <a href="/account/login?next=%2Faccount%2Fbusiness" target="_blank" rel="noopener noreferrer">Business account login</a>. Customers use the company login email below. Send an invitation after approval; first-time customers choose Email code, then set a password under Security.</p><p>Create a company, approve its discount, then send its customer-account invitation. Only the owner can manage these terms.</p>
    {message && <p role="status">{message}</p>}
    <button type="button" disabled={busy} onClick={() => setForm(empty)}>New business</button>
    <form onSubmit={event => { event.preventDefault(); act(form); }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, margin: '16px 0' }}>
      {fields.map(key => <label key={key} style={{ display: 'grid', gap: 6 }}>{key.replaceAll('_', ' ')}<input type={key === 'email' ? 'email' : 'text'} value={form[key] || ''} readOnly={key === 'email' && Boolean(form.id)} required={!['trading_name', 'delivery_address'].includes(key)} maxLength={key.endsWith('address') ? 1000 : 200} onChange={e => setForm({ ...form, [key]: e.target.value })} style={{ padding: 9, color: '#0f172a', background: '#fff', borderRadius: 6 }} /></label>)}
      <label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ display: 'block', padding: 9 }}><option value="pending">Pending</option><option value="approved">Approved</option><option value="suspended">Suspended</option></select></label>
      <label>Discount %<input type="number" min="0" max="100" step="0.01" required value={form.discount_pct} onChange={e => setForm({ ...form, discount_pct: e.target.value })} style={{ display: 'block', padding: 9 }} /></label>
      <label>Minimum merchandise units<input type="number" min="0" max="5000" required value={form.minimum_units||0} onChange={e=>setForm({...form,minimum_units:e.target.value})} style={{display:'block',padding:9}}/></label>
      <label>Minimum products total after discounts (USD)<input type="number" min="0" max="1000000" step="0.01" required value={form.minimum_order_usd||0} onChange={e=>setForm({...form,minimum_order_usd:e.target.value})} style={{display:'block',padding:9}}/></label>
      <label>Assigned sales rep<select value={form.rep_user_id||''} onChange={e=>setForm({...form,rep_user_id:e.target.value})} style={{display:'block',padding:9}}><option value="">Unassigned</option>{reps.filter(rep=>(rep.status||'active')==='active'&&(rep.tier||'staff')==='staff').map(rep=><option key={rep.user_id} value={rep.user_id}>{rep.name||rep.email}</option>)}</select></label>
      <label>Agreed rep commission %<input type="number" min="0" max="100" step="0.01" required value={form.rep_commission_pct||0} onChange={e=>setForm({...form,rep_commission_pct:e.target.value})} style={{display:'block',padding:9}}/></label>
      <button disabled={busy} type="submit">{busy ? 'Working…' : 'Save business account'}</button>
    </form>
    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left' }}><thead><tr><th>Company</th><th>Login email</th><th>Status</th><th>Discount</th><th>Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.legal_name}<br /><small>{row.corporation_number}</small></td><td>{row.email}</td><td>{row.status}</td><td>{row.discount_pct}%</td><td><button disabled={busy} onClick={() => setForm(row)}>Edit</button> <button disabled={busy || row.status !== 'approved'} onClick={() => act({ action: 'invite', id: row.id })}>Send invitation</button> <button disabled={busy} onClick={() => act({ action: 'notify', id: row.id })}>Resend staff alert</button></td></tr>)}</tbody></table></div>
    <BusinessSuitePanel businessId={form.id||null} onReps={setReps}/>
  </section>;
}
