"use client";

import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Plus, UserX } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';

/**
 * Partner labs and their logins (inside the Lab batches tab, superadmin only).
 *
 * The route behind it refuses anyone but a superadmin, so for everybody else
 * this panel quietly renders nothing — it is not the lock, just the door.
 * A lab login can only ever open /lab, and only for batches assigned to it in
 * the "Tested by" column below.
 */

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid rgba(148,163,184,0.25)',
  background: 'rgba(15,23,42,0.6)',
  color: '#e2e8f0',
};
const labelStyle = { display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: 4 };

const LOGIN_LABEL = {
  no_login: { text: 'No login', color: '#94a3b8' },
  lab_login: { text: 'Can sign in at /lab', color: '#86efac' },
  not_lab_login: { text: 'Linked to a non-lab account (refused by /lab)', color: '#fbbf24' },
  missing_profile: { text: 'Login is broken — remove it and create a new one', color: '#fbbf24' },
};

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ ...inputStyle, paddingRight: 38 }}
      />
      <button
        type="button"
        onClick={() => setShow((on) => !on)}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{ position: 'absolute', top: 0, bottom: 0, right: 6, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

export default function LabPartnersPanel({ onLabsChanged }) {
  const [allowed, setAllowed] = useState(null); // null = checking
  const [labs, setLabs] = useState([]);
  const [error, setError] = useState('');
  const [migration, setMigration] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loginFor, setLoginFor] = useState({ id: '', password: '' });
  const [confirmRevoke, setConfirmRevoke] = useState('');

  const load = useCallback(async () => {
    setError('');
    setMigration('');
    try {
      const res = await adminFetch('/api/admin/lab-partners');
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) { setAllowed(false); return; }
      setAllowed(true);
      if (!res.ok) {
        setError(data.error || 'Could not load labs');
        setMigration(data.migration || '');
        return;
      }
      setLabs(data.labs || []);
    } catch (err) {
      setAllowed(true);
      setError(err.message || 'Could not load labs');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const post = async (payload, after) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await adminFetch('/api/admin/lab-partners', { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        if (data.migration) setMigration(data.migration);
        return;
      }
      setMessage(data.message || 'Saved.');
      after?.();
      await load();
      onLabsChanged?.();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) return null;

  return (
    <div style={{ padding: 16, borderRadius: 12, background: 'rgba(15,23,42,0.45)', border: '1px solid rgba(148,163,184,0.18)', marginBottom: 20 }}>
      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><KeyRound size={16} /> Partner labs & logins</div>
      <div style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 12px', maxWidth: 720 }}>
        A lab login opens <code>/lab</code> only. It sees the batches you assign to that lab in the
        “Tested by” column, uploads COA PDFs for them, and nothing else in the admin. Uploads wait for
        approval in “Lab COA uploads” before any QR shows them.
      </div>

      {migration && (
        <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', fontSize: '0.85rem' }}>
          Run <code>{migration}</code> in the Supabase SQL editor, then refresh.
        </div>
      )}
      {error && !migration && <div style={{ marginBottom: 10, color: '#f87171', fontSize: '0.85rem' }}>{error}</div>}
      {message && <div style={{ marginBottom: 10, color: '#86efac', fontSize: '0.85rem' }}>{message}</div>}

      {labs.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 14 }}>
          <table className="admin-table" style={{ width: '100%', minWidth: 640 }}>
            <thead>
              <tr><th>Lab</th><th>Login</th><th style={{ width: 80 }}>Batches</th><th style={{ width: 260 }}></th></tr>
            </thead>
            <tbody>
              {labs.map((lab) => {
                const state = LOGIN_LABEL[lab.loginState] || LOGIN_LABEL.no_login;
                return [
                  <tr key={lab.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{lab.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{lab.loginEmail || lab.contactEmail || 'No email yet'}</div>
                    </td>
                    <td style={{ color: state.color, fontSize: '0.85rem' }}>{state.text}</td>
                    <td>{lab.batchCount}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {lab.loginState === 'no_login' ? (
                          <button
                            type="button"
                            className="admin-btn"
                            disabled={busy || !lab.contactEmail}
                            title={lab.contactEmail ? '' : 'This lab has no email to sign in with'}
                            onClick={() => setLoginFor((prev) => (prev.id === lab.id ? { id: '', password: '' } : { id: lab.id, password: '' }))}
                          >
                            <KeyRound size={13} /> Give a login
                          </button>
                        ) : confirmRevoke === lab.id ? (
                          <>
                            <button type="button" className="admin-btn" disabled={busy} onClick={() => post({ action: 'revoke_login', labId: lab.id }, () => setConfirmRevoke(''))}>
                              Yes, remove login
                            </button>
                            <button type="button" className="admin-btn admin-btn-secondary" disabled={busy} onClick={() => setConfirmRevoke('')}>Keep</button>
                          </>
                        ) : (
                          <button type="button" className="admin-btn" disabled={busy} onClick={() => setConfirmRevoke(lab.id)}>
                            <UserX size={13} /> Remove login
                          </button>
                        )}
                      </div>
                      {confirmRevoke === lab.id && (
                        <div style={{ fontSize: '0.75rem', color: '#fbbf24', textAlign: 'right', marginTop: 4 }}>
                          They are signed out of /lab at once. The lab, its batches and its uploads stay.
                        </div>
                      )}
                    </td>
                  </tr>,
                  loginFor.id === lab.id && (
                    <tr key={`${lab.id}-login`}>
                      <td colSpan={4} style={{ background: 'rgba(15,23,42,0.35)' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '6px 2px' }}>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Signs in as {lab.contactEmail} with:</span>
                          <div style={{ flex: '1 1 220px' }}>
                            <PasswordInput
                              value={loginFor.password}
                              onChange={(e) => setLoginFor({ id: lab.id, password: e.target.value })}
                              placeholder="At least 8 characters"
                            />
                          </div>
                          <button
                            type="button"
                            className="admin-btn admin-btn-primary"
                            disabled={busy || loginFor.password.length < 8}
                            onClick={() => post({ action: 'create_login', labId: lab.id, password: loginFor.password }, () => setLoginFor({ id: '', password: '' }))}
                          >
                            Create login
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          post({ action: 'create', ...form }, () => setForm({ name: '', email: '', password: '' }));
        }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, alignItems: 'end' }}
      >
        <label><span style={labelStyle}>Lab name</span><input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={inputStyle} /></label>
        <label><span style={labelStyle}>Login email</span><input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} style={inputStyle} /></label>
        <label>
          <span style={labelStyle}>Password (blank = no login yet)</span>
          <PasswordInput value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
        </label>
        <button type="submit" className="admin-btn admin-btn-primary" disabled={busy || !form.name.trim()}>
          <Plus size={14} /> Add lab
        </button>
      </form>
    </div>
  );
}
