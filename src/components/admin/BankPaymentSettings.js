'use client';
import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/adminApi';

export default function BankPaymentSettings() {
  const [settings, setSettings] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState([]);
  useEffect(() => {
    adminFetch('/api/admin/bank-payments').then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setSettings(data.settings);
      setPending(data.pending || []);
    }).catch(e => setMessage(e.message));
  }, []);
  async function save(e) {
    e.preventDefault(); setSaving(true); setMessage('');
    try {
      const r = await adminFetch('/api/admin/bank-payments', { method: 'PUT', body: JSON.stringify(settings) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setSettings(data.settings); setMessage('Saved. Disabled methods remain Coming soon in checkout.');
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  }
  async function confirmPayment(order) {
    if (!window.confirm(`Have you verified receipt of ₡${Number(order.total_crc).toLocaleString()} for ${order.order_number} in BAC? This marks the order paid and starts the normal fulfillment process.`)) return;
    setSaving(true); setMessage('');
    try {
      const r = await adminFetch('/api/admin/orders/update', { method: 'POST', body: JSON.stringify({ orderId: order.id, updates: { status: 'Paid' }, activity: { type: 'status_change', message: 'Paid — BAC funds verified by staff' } }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Could not confirm payment');
      setPending(rows => rows.filter(row => row.id !== order.id));
      setMessage(`${order.order_number}: payment confirmed.`);
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  }
  return <section className="dashboard-section" style={{ padding: 20, marginBottom: 20 }}>
    <h3>BAC · SINPE & bank transfers</h3>
    <p>Add the receiving account details, then enable each method when mobile banking is ready. Payments require manual verification in BAC.</p>
    <p>Use receiving details only. No banking password, PIN or one-time code is needed.</p>
    {settings && <form onSubmit={save} style={{ display: 'grid', gap: 12, maxWidth: 600 }}>
      {[['recipient', 'Account holder / recipient name'], ['legalId', 'Business legal ID (optional)'], ['sinpePhone', 'SINPE Móvil number (8 digits)'], ['accountCrc', 'BAC CRC account number'], ['ibanCrc', 'BAC CRC IBAN'], ['accountUsd', 'BAC USD account number'], ['ibanUsd', 'BAC USD IBAN']].map(([key, label]) => <label key={key}>{label}<input value={settings[key] || ''} maxLength={160} onChange={e => setSettings({ ...settings, [key]: e.target.value })} style={{ display: 'block', width: '100%', padding: 10 }} /></label>)}
      {[['sinpeEnabled', 'Enable SINPE Móvil'], ['transferEnabled', 'Enable bank transfers']].map(([key, label]) => <label key={key}><input type="checkbox" checked={settings[key]} onChange={e => setSettings({ ...settings, [key]: e.target.checked })} /> {label}</label>)}
      <button disabled={saving}>{saving ? 'Saving…' : 'Save BAC payment settings'}</button>
    </form>}
    {message && <p role="status">{message}</p>}
    <h4>Payments reported · verify in BAC ({pending.length})</h4>
    <button disabled={saving} type="button" onClick={async () => {
      try {
        const r = await adminFetch('/api/admin/bank-payments'); const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setPending(data.pending || []);
      } catch (error) { setMessage(error.message); }
    }}>Refresh verification queue</button>
    {pending.map(order => <div key={order.id} style={{ borderTop: '1px solid #64748b', padding: '14px 0' }}>
      <strong>{order.order_number} · {order.customer_name} · ₡{Number(order.total_crc).toLocaleString()}</strong>
      <p>{order.activity_log?.find(entry => entry.type === 'bank_payment_reported')?.message}</p>
      <button type="button" disabled={saving} onClick={() => confirmPayment(order)}>I verified funds in BAC — mark paid</button>
    </div>)}
  </section>;
}
