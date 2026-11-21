"use client";

import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, FileText, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';
import { formatCrDate } from '@/lib/crTime.mjs';
import { formatTestDate } from '@/lib/labPortal.mjs';

/**
 * Lab COA review queue (inside the Lab batches tab).
 *
 * Every certificate a partner lab uploads waits here. Approving publishes it:
 * the batch's QR sticker opens it from then on. Rejecting needs a reason, which
 * the lab reads on its own page. The PDF links are short-lived signed links to
 * a private bucket — nothing here is public until it is approved.
 */

const TABS = [
  { id: 'pending', label: 'Waiting' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid rgba(148,163,184,0.25)',
  background: 'rgba(15,23,42,0.6)',
  color: '#e2e8f0',
};

const when = (iso) => (iso ? formatCrDate(iso, { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function LabCoaReview({ onDecided }) {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [migration, setMigration] = useState('');
  const [message, setMessage] = useState('');
  const [rejecting, setRejecting] = useState({ id: '', note: '' });
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setMigration('');
    try {
      const res = await adminFetch(`/api/admin/lab-coa?status=${status}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not load lab uploads');
        setMigration(data.migration || '');
        setRows([]);
        return;
      }
      setRows(data.submissions || []);
      setPendingCount(data.pendingCount || 0);
    } catch (err) {
      setError(err.message || 'Could not load lab uploads');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const decide = async (row, decision, note = '') => {
    setBusyId(row.id);
    setMessage('');
    setError('');
    try {
      const res = await adminFetch('/api/admin/lab-coa', {
        method: 'POST',
        body: JSON.stringify({ id: row.id, decision, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not save the decision');
        return;
      }
      setMessage(`${row.batchCode}: ${data.message}`);
      setRejecting({ id: '', note: '' });
      await load();
      onDecided?.();
    } catch (err) {
      setError(err.message || 'Could not save the decision');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div style={{ padding: 16, borderRadius: 12, background: 'rgba(15,23,42,0.45)', border: '1px solid rgba(148,163,184,0.18)', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={16} /> Lab COA uploads
            {pendingCount > 0 && (
              <span style={{ background: 'rgba(245,158,11,0.18)', color: '#fbbf24', borderRadius: 999, padding: '1px 8px', fontSize: '0.75rem' }}>
                {pendingCount} waiting
              </span>
            )}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 4 }}>
            Partner labs upload certificates here from /lab. A certificate only appears on the batch QR once you approve it.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`admin-btn${status === tab.id ? ' admin-btn-primary' : ''}`}
              onClick={() => setStatus(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          <button type="button" className="admin-btn" onClick={load} disabled={loading} aria-label="Refresh lab uploads">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {migration && (
        <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', fontSize: '0.85rem' }}>
          Lab uploads are not switched on yet. Run <code>{migration}</code> in the Supabase SQL editor, then refresh.
        </div>
      )}
      {error && !migration && <div style={{ marginBottom: 10, color: '#f87171', fontSize: '0.85rem' }}>{error}</div>}
      {message && <div style={{ marginBottom: 10, color: '#86efac', fontSize: '0.85rem' }}>{message}</div>}

      {!migration && (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table" style={{ width: '100%', minWidth: 720 }}>
            <thead>
              <tr>
                <th>Batch</th>
                <th>Lab</th>
                <th>Purity</th>
                <th>Tested</th>
                <th>Uploaded</th>
                <th>PDF</th>
                <th style={{ width: 220 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ color: '#94a3b8' }}>Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} style={{ color: '#94a3b8' }}>
                  {status === 'pending' ? 'Nothing waiting for review.' : `No ${status} uploads yet.`}
                </td></tr>
              )}
              {!loading && rows.map((row) => [
                <tr key={row.id}>
                  <td>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>{row.batchCode}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{row.product}</div>
                  </td>
                  <td>
                    {row.labName}
                    {row.labNotes && <div style={{ fontSize: '0.75rem', color: '#94a3b8', maxWidth: 220 }}>“{row.labNotes}”</div>}
                  </td>
                  <td style={{ fontWeight: 700 }}>{row.purityPercent === null ? '—' : `${row.purityPercent}%`}</td>
                  <td>{formatTestDate(row.testDate)}</td>
                  <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    {when(row.createdAt)}
                    {row.reviewedBy && <div>{row.status} by {row.reviewedBy}</div>}
                    {row.reviewNote && <div style={{ color: row.status === 'rejected' ? '#fca5a5' : '#94a3b8' }}>{row.reviewNote}</div>}
                  </td>
                  <td>
                    {row.viewUrl
                      ? <a href={row.viewUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', display: 'inline-flex', alignItems: 'center', gap: 4 }}><FileText size={13} /> Open <ExternalLink size={11} /></a>
                      : <span style={{ color: '#64748b' }}>—</span>}
                  </td>
                  <td>
                    {row.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button type="button" className="admin-btn admin-btn-primary" disabled={busyId === row.id} onClick={() => decide(row, 'approve')}>
                          <Check size={13} /> {busyId === row.id ? 'Working…' : 'Approve & publish'}
                        </button>
                        <button
                          type="button"
                          className="admin-btn"
                          disabled={busyId === row.id}
                          onClick={() => setRejecting((prev) => (prev.id === row.id ? { id: '', note: '' } : { id: row.id, note: '' }))}
                        >
                          <X size={13} /> Reject
                        </button>
                      </div>
                    ) : row.publishedUrl ? (
                      <a href={row.publishedUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#86efac', fontSize: '0.8rem' }}>Public COA</a>
                    ) : null}
                  </td>
                </tr>,
                rejecting.id === row.id && (
                  <tr key={`${row.id}-reject`}>
                    <td colSpan={7} style={{ background: 'rgba(15,23,42,0.35)' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '6px 2px' }}>
                        <input
                          autoFocus
                          value={rejecting.note}
                          onChange={(e) => setRejecting({ id: row.id, note: e.target.value })}
                          placeholder="Why? The lab sees this, e.g. wrong batch number on page 1"
                          style={{ ...inputStyle, flex: '1 1 320px' }}
                        />
                        <button
                          type="button"
                          className="admin-btn"
                          disabled={!rejecting.note.trim() || busyId === row.id}
                          onClick={() => decide(row, 'reject', rejecting.note.trim())}
                        >
                          Reject upload
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              ])}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
