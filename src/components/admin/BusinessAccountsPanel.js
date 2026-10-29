'use client';

import { useEffect, useRef, useState } from 'react';
import { adminFetch } from '@/lib/adminApi';
import BusinessSuitePanel from './BusinessSuitePanel';
import styles from './BusinessAccountsPanel.module.css';

const fields = [
  { key: 'email', label: 'Company login email', type: 'email', complete: 'email' },
  { key: 'legal_name', label: 'Legal company name', complete: 'organization' },
  { key: 'trading_name', label: 'Trading name (optional)' },
  { key: 'corporation_number', label: 'Cédula jurídica' },
  { key: 'contact_name', label: 'Contact name', complete: 'name' },
  { key: 'phone', label: 'Phone number', type: 'tel', complete: 'tel' },
  { key: 'billing_address', label: 'Billing address', multiline: true },
  { key: 'delivery_address', label: 'Delivery address (optional)', multiline: true },
];
const empty = { status: 'pending', discount_pct: 0, minimum_units: 0, minimum_order_usd: 0, rep_user_id: '', rep_commission_pct: 0, preferred_language: 'es' };
const statuses = { pending: 'Pending review', approved: 'Approved', suspended: 'Suspended' };
const loginUrl = '/account/login?next=%2Faccount%2Fbusiness';

export default function BusinessAccountsPanel() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reps, setReps] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const editor = useRef(null);
  async function load() {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/business-accounts');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load business accounts.');
      setRows(data.businesses || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load().catch(err => setError(err.message)); }, []);
  function openEditor(row) {
    setForm({ ...empty, ...row }); setEditing(true); setMessage(''); setError('');
    requestAnimationFrame(() => editor.current?.focus());
  }
  async function act(body) {
    setBusy(true); setMessage(''); setError('');
    try {
      const res = await adminFetch('/api/admin/business-accounts', { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update this business.');
      const failed = (data.notifications || []).filter(result => !result.sent);
      const recipient = data.recipient || data.business?.email || rows.find(row => row.id === body.id)?.email || body.email;
      setMessage(data.customerNotification?.sent === false ? `Account saved, but the customer email to ${recipient} was not sent. Use Resend welcome email for an approved account, or retry the notification in Business operations.` : failed.length
        ? `Account saved. Staff email alerts failed for: ${failed.map(result => result.destination).join(', ')}. Check SMTP settings and retry the staff alert.`
        : body.action === 'notify' ? 'Staff alerts sent to Omer and info.' : body.action === 'invite' ? `Welcome email sent to ${recipient}.` : data.customerNotification?.welcome ? `Business approved. Welcome email sent to ${recipient}.` : data.business?.status === 'pending' ? `Business saved as Pending review. Open Manage business to approve it and send the welcome email to ${recipient}.` : 'Business account saved.');
      if (data.business) setForm(data.business);
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function permanentlyDelete(row) {
    const confirmEmail = window.prompt(`Permanently delete ${row.legal_name}? This cannot be undone. Business pricing, memberships, saved lists, quotes and email history will be removed. Customer logins and historical orders will remain. Type the business login email (${row.email}) to confirm:`);
    if (confirmEmail === null) return;
    if (confirmEmail.trim().toLowerCase() !== row.email) {
      setMessage('Email did not match. The business was not deleted.');
      return;
    }
    setBusy(true); setMessage('');
    try {
      const res = await adminFetch('/api/admin/business-accounts', { method: 'DELETE', body: JSON.stringify({ id: row.id, confirmEmail }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete this business.');
      setRows(previous => previous.filter(business => business.id !== row.id));
      setForm(previous => previous.id === row.id ? empty : previous);
      if (form.id === row.id) setEditing(false);
      setMessage(`${row.legal_name} was permanently deleted. Customer logins and historical orders remain.`);
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  }
  const counts = Object.fromEntries(Object.keys(statuses).map(status => [status, rows.filter(row => row.status === status).length]));
  const query = search.trim().toLocaleLowerCase();
  const visible = rows.filter(row => (filter === 'all' || row.status === filter) && [row.legal_name, row.trading_name, row.email, row.corporation_number, row.contact_name].some(value => String(value || '').toLocaleLowerCase().includes(query)));
  function numberField(key, label, max, step = '1', help) {
    return <label className={styles.field}>{label}<input type="number" inputMode={step === '1' ? 'numeric' : 'decimal'} min="0" max={max} step={step} required value={form[key] ?? 0} onChange={event => setForm({ ...form, [key]: event.target.value })} />{help && <small>{help}</small>}</label>;
  }
  return <section className={styles.panel} aria-label="Business accounts">
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Company partnerships</p><h2>Business accounts</h2><p>Review applications, agree on pricing, and invite approved companies.</p></div>
      <button className={styles.primary} disabled={busy} onClick={() => openEditor(empty)}>+ New business</button>
    </header>
    <div className={styles.summary}>
      <div><strong>{counts.pending}</strong><span>Awaiting review</span></div>
      <div><strong>{counts.approved}</strong><span>Approved partners</span></div>
      <div><strong>{rows.length}</strong><span>Total businesses</span></div>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {message && <p className={styles.notice} role="status">{message}</p>}

    {editing && <section className={styles.editor} aria-labelledby="business-editor-heading">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>{form.id ? statuses[form.status] : 'New company'}</p><h3 id="business-editor-heading" ref={editor} tabIndex={-1}>{form.id ? form.legal_name : 'Create business account'}</h3></div><button disabled={busy} onClick={() => setEditing(false)}>Close editor</button></div>
      <p>Check company details, set the agreed discount, then choose Approved and save. Approval automatically sends the styled welcome email with Korinne’s contact details.</p>
      <form onSubmit={event => { event.preventDefault(); act(event.nativeEvent.submitter?.value === 'approve' ? { ...form, status: 'approved' } : form); }}>
        <fieldset disabled={busy}><legend>Company & contact</legend><div className={styles.formGrid}>
          {fields.map(field => <label key={field.key} className={`${styles.field} ${field.multiline ? styles.wide : ''}`}>{field.label}
            {field.multiline ? <textarea rows={3} value={form[field.key] || ''} required={field.key === 'billing_address'} maxLength={1000} onChange={event => setForm({ ...form, [field.key]: event.target.value })} /> : <input type={field.type || 'text'} autoComplete={field.complete} value={form[field.key] || ''} readOnly={field.key === 'email' && Boolean(form.id)} required={!['trading_name', 'delivery_address'].includes(field.key)} maxLength={200} onChange={event => setForm({ ...form, [field.key]: event.target.value })} />}
            {field.key === 'email' && <small>This is where the customer receives the welcome email and sign-in codes. {form.id ? 'Login email is fixed for this company.' : 'Enter the business customer’s email address.'}</small>}
          </label>)}
        </div></fieldset>
        <fieldset disabled={busy}><legend>Approval & pricing</legend><div className={styles.formGrid}>
          <label className={styles.field}>Account status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className={styles.field}>Language for emails and account<select value={form.preferred_language === 'en' ? 'en' : 'es'} onChange={event => setForm({ ...form, preferred_language: event.target.value })}><option value="es">Español</option><option value="en">English</option></select></label>
          {numberField('discount_pct', 'Agreed discount (%)', 100, '0.01')}
          {numberField('minimum_units', 'Minimum merchandise units', 5000, '1', 'Use 0 for no unit minimum.')}
          {numberField('minimum_order_usd', 'Minimum products total (USD)', 1000000, '0.01', 'After discounts; use 0 for no minimum.')}
        </div></fieldset>
        <fieldset disabled={busy}><legend>Sales representative</legend><div className={styles.formGrid}>
          <label className={styles.field}>Assigned sales rep<select value={form.rep_user_id || ''} onChange={event => setForm({ ...form, rep_user_id: event.target.value })}><option value="">Unassigned</option>{reps.filter(rep => (rep.status || 'active') === 'active' && (rep.tier || 'staff') === 'staff').map(rep => <option key={rep.user_id} value={rep.user_id}>{rep.name || rep.email}</option>)}</select></label>
          {numberField('rep_commission_pct', 'Agreed rep commission (%)', 100, '0.01')}
        </div></fieldset>
        <p>{form.email ? `Customer emails go to ${form.email}. ` : 'Enter the company login email above. '}Saving as Pending review does not approve the account. Approval activates business pricing and sends the welcome email with Korinne’s photo.</p>
        <div className={styles.saveBar}><button className={styles.primary} disabled={busy} type="submit">{busy ? 'Working…' : 'Save business account'}</button>{rows.find(row => row.id === form.id)?.status !== 'approved' && <button className={styles.primary} disabled={busy} type="submit" name="intent" value="approve">Approve & send welcome email</button>}<button disabled={busy} type="button" onClick={() => setEditing(false)}>Cancel</button></div>
      </form>
      {form.id && <div className={styles.nextStep}><strong>Welcome email</strong><p>Approval sends the welcome email to {form.email} automatically. Resend it below when needed.</p><button disabled={busy || rows.find(row => row.id === form.id)?.status !== 'approved'} onClick={() => act({ action: 'invite', id: form.id })}>Resend welcome email</button></div>}
    </section>}

    <section aria-labelledby="business-list-heading">
      <div className={styles.sectionHeading}><h3 id="business-list-heading">Applications & partners</h3><button disabled={loading || busy} onClick={() => { setError(''); load().catch(err => setError(err.message)); }}>Refresh</button></div>
      <div className={styles.filters}><label className={styles.field}>Search businesses<input type="search" placeholder="Company, email or cédula jurídica" value={search} onChange={event => setSearch(event.target.value)} /></label><label className={styles.field}>Status<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All statuses ({rows.length})</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label} ({counts[value]})</option>)}</select></label></div>
      {loading ? <p className={styles.empty} role="status">Loading business accounts…</p> : !visible.length ? <p className={styles.empty}>{rows.length ? 'No businesses match these filters.' : 'No applications yet. New business applications will appear here, or create a business above.'}</p> : <div className={styles.cards}>{visible.map(row => <article className={styles.card} key={row.id}>
        <div className={styles.cardTitle}><h4>{row.trading_name || row.legal_name}</h4><span className={`${styles.badge} ${styles[row.status] || ''}`}>{statuses[row.status] || row.status}</span></div>
        {row.trading_name && <p>{row.legal_name}</p>}<a className={styles.email} href={`mailto:${row.email}`}>{row.email}</a><p>Welcome email recipient: {row.email}</p>
        <dl><div><dt>Cédula jurídica</dt><dd>{row.corporation_number}</dd></div><div><dt>Discount</dt><dd>{row.discount_pct}%</dd></div><div><dt>Contact</dt><dd>{row.contact_name || '—'}</dd></div></dl>
        <div className={styles.cardActions}><button className={styles.primary} disabled={busy} onClick={() => openEditor(row)}>{row.status === 'pending' ? 'Review application' : 'Manage business'}</button>{row.status === 'approved' && <button disabled={busy} onClick={() => act({ action: 'invite', id: row.id })}>Resend welcome email</button>}</div>
        <details className={styles.more}><summary>More actions</summary><button disabled={busy} onClick={() => act({ action: 'notify', id: row.id })}>Resend staff alert</button><button type="button" disabled={busy} onClick={() => permanentlyDelete(row)}>Permanently delete</button></details>
      </article>)}</div>}
      {!loading && rows.length > 0 && <p className={styles.hint}>Showing {visible.length} of {rows.length} loaded businesses{rows.length === 500 ? ' (latest 500)' : ''}.</p>}
    </section>
    <details className={styles.help}><summary>How do I approve a manually created account?</summary><p>Open Review application or Manage business, check the company email and terms, then select Approve &amp; send welcome email. You can also select Approved in Account status and save. The welcome email goes to the company login email shown on the card. For an already approved account, use Resend welcome email. Customers follow the email’s account link and choose Email code to sign in with that same email address. They can set a password under Security.</p><a href={loginUrl} target="_blank" rel="noopener noreferrer">Open business account login ↗</a></details>
    <details className={styles.operations}><summary>Business operations <span>Pricing, quotes, sales reports & brochure links</span></summary><BusinessSuitePanel businessId={editing ? form.id || null : null} onReps={setReps} /></details>
  </section>;
}
