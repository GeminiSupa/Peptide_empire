"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';

/**
 * Second inventory: what the off-site packer is holding.
 * Total owned still lives on Products; this only moves the off-site count.
 */
export default function OffsiteInventoryManager() {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [migration, setMigration] = useState('');
  const [search, setSearch] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [qtyById, setQtyById] = useState({});
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setMigration('');
    try {
      const res = await adminFetch('/api/admin/offsite-inventory');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not load off-site stock');
        setMigration(data.migration || '');
        setRows([]);
        setTotals(null);
        return;
      }
      setRows(data.rows || []);
      setTotals(data.totals || null);
    } catch (err) {
      setError(err.message || 'Could not load off-site stock');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => String(row.product || '').toLowerCase().includes(q));
  }, [rows, search]);

  const move = async (row, direction) => {
    const qty = Math.floor(Number(qtyById[row.id] || 0));
    if (!qty) {
      setMessage('Enter a quantity first.');
      return;
    }
    const key = `${row.id}:${direction}`;
    setBusyKey(key);
    setMessage('');
    try {
      const res = await adminFetch('/api/admin/offsite-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: row.id, qty, direction }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || 'Move failed');
        if (data.migration) setMigration(data.migration);
        return;
      }
      setMessage(
        direction === 'to_offsite'
          ? `Gave him ${data.qty} × ${data.product}. He now holds ${data.offsite}.`
          : `Took back ${data.qty} × ${data.product}. He now holds ${data.offsite}.`,
      );
      setQtyById((prev) => ({ ...prev, [row.id]: '' }));
      await load();
    } catch (err) {
      setMessage(err.message || 'Move failed');
    } finally {
      setBusyKey('');
    }
  };

  return (
    <div className="admin-panel-card" style={{ padding: '20px 22px' }}>
      <div className="admin-toolbar" style={{ marginBottom: 16 }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Package size={18} /> Off-site stock
          </h3>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '0.85rem', maxWidth: 640 }}>
            Total inventory (Products tab) is everything you own. This list is only what you have
            given the off-site packer. Paid orders lower both. Give him more here when his pile runs low.
          </p>
        </div>
        <button type="button" className="admin-btn" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {totals && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          {[
            ['With him', totals.offsiteUnits],
            ['On site (with you)', totals.onSiteUnits],
            ['Total owned', totals.totalUnits],
            ['Empty with him', totals.emptyOffsite],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                minWidth: 140,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
              }}
            >
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{label}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {migration && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' }}>
          Run <code>{migration}</code> in the Supabase SQL editor, then refresh.
        </div>
      )}
      {error && !migration && (
        <div style={{ marginBottom: 12, color: '#f87171' }}>{error}</div>
      )}
      {message && (
        <div style={{ marginBottom: 12, color: '#86efac' }}>{message}</div>
      )}

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search product…"
        style={{
          width: 'min(360px, 100%)',
          marginBottom: 12,
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid rgba(148,163,184,0.25)',
          background: 'rgba(15,23,42,0.6)',
          color: '#e2e8f0',
        }}
      />

      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table" style={{ width: '100%', minWidth: 720 }}>
          <thead>
            <tr>
              <th>Product</th>
              <th style={{ width: 100 }}>With him</th>
              <th style={{ width: 100 }}>On site</th>
              <th style={{ width: 100 }}>Total</th>
              <th style={{ width: 280 }}>Move</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} style={{ color: '#94a3b8' }}>Loading…</td></tr>
            )}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={5} style={{ color: '#94a3b8' }}>No tracked products.</td></tr>
            )}
            {visible.map((row) => (
              <tr key={row.id} style={row.low ? { background: 'rgba(239, 68, 68, 0.08)' } : undefined}>
                <td>
                  <div style={{ fontWeight: 600 }}>{row.product}</div>
                  {row.low && (
                    <div style={{ fontSize: '0.72rem', color: '#fbbf24' }}>Nothing logged with him</div>
                  )}
                </td>
                <td style={{ fontWeight: 700 }}>{row.offsite}</td>
                <td>{row.onSite}</td>
                <td>{row.total}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={qtyById[row.id] ?? ''}
                      onChange={(e) => setQtyById((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      placeholder="Qty"
                      style={{
                        width: 72,
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid rgba(148,163,184,0.25)',
                        background: 'rgba(15,23,42,0.7)',
                        color: '#e2e8f0',
                      }}
                    />
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={busyKey === `${row.id}:to_offsite`}
                      onClick={() => move(row, 'to_offsite')}
                      title="Give vials to the off-site packer"
                    >
                      <ArrowRightLeft size={13} /> Give him
                    </button>
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={busyKey === `${row.id}:from_offsite`}
                      onClick={() => move(row, 'from_offsite')}
                      title="Take vials back on site"
                    >
                      Take back
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
