'use client';

/**
 * The lab partner portal.
 *
 * Its own page rather than tabs inside /admin, for the same reason as the
 * affiliate dashboard: a lab is an outside partner, and nothing here imports an
 * admin component. Everything on this screen comes from /api/lab/*, which works
 * out which lab is asking from the login. This page never sends a lab id.
 *
 * A lab sees the batches assigned to it, uploads a COA PDF with the purity and
 * test date, and follows each upload's status. An upload is not public until
 * staff approve it; only then does the batch QR sticker open it.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { adminFetch } from '@/lib/adminApi';
import { formatCrDate } from '@/lib/crTime.mjs';
import { formatTestDate } from '@/lib/labPortal.mjs';
import { Eye, EyeOff } from 'lucide-react';

const COLORS = {
  bg: '#0b1120',
  panel: '#151d2e',
  panelRaised: '#1c2438',
  border: '#2a3348',
  text: '#e8ecf4',
  muted: '#93a0b5',
  good: '#4ade80',
  warn: '#f0b429',
  bad: '#f87171',
};

const STATUS = {
  pending: { label: 'Waiting for review', color: COLORS.warn },
  approved: { label: 'Approved · on the QR', color: COLORS.good },
  rejected: { label: 'Rejected', color: COLORS.bad },
};

const uploadedOn = (iso) => (iso ? formatCrDate(iso, { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const today = () => new Date().toISOString().slice(0, 10);

export default function LabPortal() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [lab, setLab] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [openBatch, setOpenBatch] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setCheckingSession(false);
      return undefined;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data?.session || null);
      setCheckingSession(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next || null));
    return () => {
      active = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await adminFetch('/api/lab/batches');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data.error || 'Could not load your batches.');
        return;
      }
      setLab(data.lab || null);
      setBatches(data.batches || []);
    } catch (err) {
      setLoadError(err.message || 'Something went wrong loading your batches.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  const signOut = () => supabase.auth.signOut();

  if (checkingSession) return <Shell><p style={{ color: COLORS.muted }}>Loading…</p></Shell>;
  if (!session) return <SignIn onDone={setSession} />;

  if (loadError) {
    return (
      <Shell>
        <div style={panel}>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>We could not open the lab portal</h2>
          <p style={{ ...muted, margin: '0 0 16px' }}>{loadError}</p>
          <p style={{ ...muted, margin: '0 0 16px' }}>
            This page is for partner testing labs. Staff review lab uploads in the admin, under Lab batches.
          </p>
          <button className="lab-press" style={ghostButton} onClick={signOut}>Sign out</button>
        </div>
      </Shell>
    );
  }

  const waiting = batches.filter((batch) => batch.hasPending).length;
  const needed = batches.filter((batch) => !batch.hasPending && batch.latestStatus !== 'approved').length;

  return (
    <Shell>
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem' }}>{lab?.name || 'Lab portal'}</h1>
          <p style={{ margin: '4px 0 0', color: COLORS.muted, fontSize: '0.85rem' }}>
            Upload a certificate of analysis for each batch assigned to you.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="lab-press" style={ghostButton} onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
          <button className="lab-press" style={ghostButton} onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Stat label="Batches assigned" value={batches.length} />
        <Stat label="Need a COA" value={needed} tone={needed ? COLORS.text : COLORS.muted} />
        <Stat label="Waiting for review" value={waiting} tone={waiting ? COLORS.warn : COLORS.muted} />
      </div>

      {notice && <div style={{ ...panel, padding: 12, marginBottom: 12, borderColor: `${COLORS.good}66`, color: COLORS.good }}>{notice}</div>}

      {!loading && batches.length === 0 && (
        <div style={panel}>
          <p style={{ ...muted, margin: 0 }}>No batches are assigned to your lab yet. They appear here as soon as the team assigns one.</p>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {batches.map((batch) => (
          <BatchCard
            key={batch.id}
            batch={batch}
            open={openBatch === batch.id}
            onToggle={() => setOpenBatch((prev) => (prev === batch.id ? '' : batch.id))}
            onUploaded={async () => {
              setOpenBatch('');
              setNotice(`COA for ${batch.code} uploaded. It goes on the QR once the team approves it.`);
              await load();
            }}
          />
        ))}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------ one batch -- */

function BatchCard({ batch, open, onToggle, onUploaded }) {
  const latest = batch.submissions[0];
  const status = latest ? STATUS[latest.status] : null;
  const canUpload = !batch.hasPending;

  return (
    <section style={panel}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 700, fontSize: '1rem' }}>{batch.code}</div>
          <div style={{ color: COLORS.text, marginTop: 2 }}>{batch.product || '—'}</div>
          <div style={{ ...muted, fontSize: '0.8rem' }}>
            Batch {batch.batchNumber || '—'}
            {batch.madeDate ? ` · made ${uploadedOn(batch.madeDate)}` : ''}
            {batch.expiryDate ? ` · expires ${uploadedOn(batch.expiryDate)}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {status
            ? <span style={{ ...chip, color: status.color, borderColor: `${status.color}66` }}>{status.label}</span>
            : <span style={{ ...chip, color: COLORS.muted }}>No COA yet</span>}
          <div style={{ marginTop: 10 }}>
            <button className="lab-press" style={canUpload ? primaryButton : ghostButton} onClick={onToggle} disabled={!canUpload}>
              {canUpload ? (open ? 'Cancel' : latest ? 'Upload a new COA' : 'Upload COA') : 'Waiting for review'}
            </button>
          </div>
        </div>
      </div>

      {latest?.status === 'rejected' && latest.reviewNote && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.bad}55`, background: 'rgba(248,113,113,0.07)', fontSize: '0.85rem' }}>
          <strong>Why it was rejected:</strong> {latest.reviewNote}
        </div>
      )}

      {open && canUpload && <UploadForm batch={batch} onUploaded={onUploaded} />}

      {batch.submissions.length > 0 && (
        <div style={{ marginTop: 14, overflowX: 'auto' }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Uploaded</th>
                <th style={th}>Purity</th>
                <th style={th}>Tested</th>
                <th style={th}>File</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {batch.submissions.map((row) => {
                const s = STATUS[row.status] || STATUS.pending;
                return (
                  <tr key={row.id}>
                    <td style={td}>{uploadedOn(row.createdAt)}</td>
                    <td style={td}>{row.purityPercent === null ? '—' : `${row.purityPercent}%`}</td>
                    <td style={td}>{formatTestDate(row.testDate)}</td>
                    <td style={td}><ViewFile id={row.id} name={row.fileName} /></td>
                    <td style={{ ...td, color: s.color }}>
                      {s.label}
                      {row.status === 'rejected' && row.reviewNote ? <div style={{ ...muted, fontSize: '0.75rem' }}>{row.reviewNote}</div> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Opens the lab's own upload through a short-lived signed link. */
function ViewFile({ id, name }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    // Opened first, filled in after: a window opened after an await is blocked
    // as a pop-up. (Not 'noopener' — that makes window.open return null.)
    const win = window.open('', '_blank');
    if (win) win.opener = null;
    try {
      const res = await adminFetch(`/api/lab/coa?id=${encodeURIComponent(id)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        if (win) win.location.href = data.url;
        else window.location.href = data.url;
      } else if (win) {
        win.close();
      }
    } catch {
      if (win) win.close();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={open} disabled={busy} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0, fontSize: '0.85rem', textAlign: 'left' }}>
      {busy ? 'Opening…' : (name || 'coa.pdf')}
    </button>
  );
}

function UploadForm({ batch, onUploaded }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [purity, setPurity] = useState('');
  const [testDate, setTestDate] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!file) { setError('Choose the COA PDF.'); return; }
    if (file.size > 20 * 1024 * 1024) { setError('The COA must be 20 MB or smaller.'); return; }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('batchId', batch.id);
      form.append('file', file);
      form.append('purity', purity);
      form.append('testDate', testDate);
      form.append('notes', notes);
      const res = await adminFetch('/api/lab/coa', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'The upload failed.');
        return;
      }
      await onUploaded();
    } catch (err) {
      setError(err.message || 'The upload failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ marginTop: 14, padding: 14, borderRadius: 8, background: COLORS.panelRaised, border: `1px solid ${COLORS.border}` }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={label} htmlFor={`file-${batch.id}`}>COA (PDF, up to 20 MB)</label>
          <input
            id={`file-${batch.id}`}
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ ...input, padding: 8 }}
          />
        </div>
        <div>
          <label style={label} htmlFor={`purity-${batch.id}`}>Purity (%)</label>
          <input
            id={`purity-${batch.id}`}
            style={input}
            inputMode="decimal"
            placeholder="e.g. 99.12"
            value={purity}
            onChange={(e) => setPurity(e.target.value)}
            required
          />
        </div>
        <div>
          <label style={label} htmlFor={`date-${batch.id}`}>Test date</label>
          <input
            id={`date-${batch.id}`}
            style={input}
            type="date"
            max={today()}
            value={testDate}
            onChange={(e) => setTestDate(e.target.value)}
            required
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={label} htmlFor={`notes-${batch.id}`}>Notes for the team (optional)</label>
          <input id={`notes-${batch.id}`} style={input} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        </div>
      </div>
      {error && <p style={{ color: COLORS.bad, fontSize: '0.85rem', margin: '10px 0 0' }}>{error}</p>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
        <button className="lab-press" style={primaryButton} disabled={busy}>{busy ? 'Uploading…' : 'Send for review'}</button>
        <span style={{ ...muted, fontSize: '0.8rem' }}>Customers only see it after the team approves it.</span>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------- sign in -- */

function SignIn({ onDone }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!supabase) { setError('Sign-in is not available right now.'); return; }
    setBusy(true);
    setError('');
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError('That email and password did not match. Try again.');
      setBusy(false);
      return;
    }
    onDone(data.session);
  };

  return (
    <Shell>
      <form onSubmit={submit} style={{ ...panel, maxWidth: 380, margin: '8vh auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.2rem', textAlign: 'center' }}>Lab sign in</h1>
        <p style={{ ...muted, marginTop: 0, textAlign: 'center' }}>Upload certificates of analysis for your assigned batches.</p>

        <label style={label} htmlFor="lab-email">Email</label>
        <input id="lab-email" style={input} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label style={{ ...label, marginTop: 12 }} htmlFor="lab-password">Password</label>
        <div style={{ position: 'relative' }}>
          <input
            id="lab-password"
            style={{ ...input, paddingRight: 44 }}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((on) => !on)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            style={{ position: 'absolute', top: 0, bottom: 0, right: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: COLORS.muted }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {error && <p style={{ color: COLORS.bad, fontSize: '0.85rem', marginTop: 10 }}>{error}</p>}

        <button className="lab-press" style={{ ...primaryButton, marginTop: 16, width: '100%' }} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p style={{ ...muted, fontSize: '0.75rem', textAlign: 'center', margin: '12px 0 0' }}>
          No login yet? The Peptide Empire team creates lab logins.
        </p>
      </form>
    </Shell>
  );
}

/* ---------------------------------------------------------------- bits -- */

function Shell({ children }) {
  return (
    <main style={{ minHeight: '100vh', background: COLORS.bg, color: COLORS.text, padding: '24px 16px', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif' }}>
      <style>{`
        .lab-press { transition: transform 90ms ease, filter 90ms ease; }
        .lab-press:hover:not(:disabled) { filter: brightness(1.15); }
        .lab-press:active:not(:disabled) { transform: scale(0.96); }
        .lab-press:disabled { opacity: 0.55; cursor: default; }
        @media (prefers-reduced-motion: reduce) {
          .lab-press { transition: none }
          .lab-press:active:not(:disabled) { transform: none }
        }
      `}</style>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>{children}</div>
    </main>
  );
}

function Stat({ label: text, value, tone }) {
  return (
    <div style={{ ...panel, padding: 14 }}>
      <div style={{ ...muted, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.6 }}>{text}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 4, color: tone || COLORS.text }}>{value}</div>
    </div>
  );
}

const panel = { background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18 };
const muted = { color: COLORS.muted, fontSize: '0.85rem', lineHeight: 1.6 };
const label = { display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.6, color: COLORS.muted, marginBottom: 6 };
const input = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#0b1220', color: COLORS.text, fontSize: '0.95rem' };
const primaryButton = { padding: '10px 16px', borderRadius: 8, border: `1px solid ${COLORS.text}`, background: COLORS.panelRaised, color: COLORS.text, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' };
const ghostButton = { padding: '8px 14px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.text, cursor: 'pointer', fontSize: '0.85rem' };
const chip = { display: 'inline-block', padding: '3px 10px', borderRadius: 999, border: `1px solid ${COLORS.border}`, fontSize: '0.8rem', fontWeight: 600 };
const table = { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' };
const th = { textAlign: 'left', padding: '8px 10px', borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5 };
const td = { padding: '10px', borderBottom: `1px solid ${COLORS.border}` };
