"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlaskConical, Pencil, Printer, RefreshCw, Users, X } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';
import { formatCrDate, isoToCrWall } from '@/lib/crTime.mjs';
import { STICKER_SIZES, printStickers } from '@/lib/stickerPrint';
import CoaUploadField from './CoaUploadField';
import LabCoaReview from './LabCoaReview';
import LabPartnersPanel from './LabPartnersPanel';

const SIZE_STORAGE_KEY = 'labBatches.stickerSize';

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid rgba(148,163,184,0.25)',
  background: 'rgba(15,23,42,0.6)',
  color: '#e2e8f0',
};

const labelStyle = { display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: 4 };

const emptyForm = {
  productId: '', vialCount: '', madeDate: '', expiryDate: '', coaUrl: '', batchNumber: '', supplierName: '', notes: '',
};

const shortDate = (iso) => (iso ? formatCrDate(iso, { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const dateInputValue = (iso) => (iso ? isoToCrWall(iso).slice(0, 10) : '');

function readSavedSize() {
  try {
    const saved = window.localStorage.getItem(SIZE_STORAGE_KEY);
    return STICKER_SIZES.some((size) => size.id === saved) ? saved : STICKER_SIZES[0].id;
  } catch {
    return STICKER_SIZES[0].id;
  }
}

function saveSize(sizeId) {
  try { window.localStorage.setItem(SIZE_STORAGE_KEY, sizeId); } catch { /* per-viewer nicety only */ }
}

function Field({ label, children, hint }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={labelStyle}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginTop: 3 }}>{hint}</span>}
    </label>
  );
}

/**
 * Which partner lab tests a batch. The lab sees and uploads COAs only for
 * batches set here; changing it takes the batch off the old lab's page at once.
 */
function LabAssignSelect({ batch, labs, onSaved, onError }) {
  const [saving, setSaving] = useState(false);
  const change = async (event) => {
    const labPartnerId = event.target.value || null;
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/lab-batches', {
        method: 'PATCH',
        body: JSON.stringify({ id: batch.id, labPartnerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { onError(data.error || 'Could not assign the lab'); return; }
      onSaved(data.batch);
    } catch (err) {
      onError(err.message || 'Could not assign the lab');
    } finally {
      setSaving(false);
    }
  };
  return (
    <select
      value={batch.labPartnerId || ''}
      onChange={change}
      disabled={saving}
      aria-label={`Lab that tests ${batch.code}`}
      style={{ ...inputStyle, padding: '5px 8px', fontSize: '0.8rem', minWidth: 130 }}
    >
      <option value="">No lab</option>
      {labs.map((lab) => <option key={lab.id} value={lab.id}>{lab.name}</option>)}
    </select>
  );
}

/**
 * Lab batches & stickers.
 *
 * The lab enters a batch when a filling run is done, prints its QR stickers,
 * and the packers scan those stickers in Fulfillment. Every scan records which
 * batch went to which customer, so "Who got it" on a batch is the recall list.
 *
 * Nothing here changes stock. Total stock still lives on the Products tab.
 */

/** "How many, what size" — the one question before a print window opens. */
function PrintDialog({ title, defaultCopies, onCancel, onPrint, busy }) {
  const [copies, setCopies] = useState(String(defaultCopies || 1));
  const [sizeId, setSizeId] = useState(STICKER_SIZES[0].id);
  useEffect(() => { setSizeId(readSavedSize()); }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div className="admin-panel-card" style={{ width: 'min(440px, 100%)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}><Printer size={16} /> {title}</h3>
          <button type="button" onClick={onCancel} aria-label="Close" style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="How many QR codes">
            <input type="number" min="1" max="1000" step="1" value={copies} onChange={(e) => setCopies(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="QR code size">
            <select value={sizeId} onChange={(e) => { setSizeId(e.target.value); saveSize(e.target.value); }} style={inputStyle}>
              {STICKER_SIZES.map((size) => <option key={size.id} value={size.id}>{size.label}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            disabled={busy || !(Number(copies) >= 1)}
            onClick={() => onPrint({ copies: Number(copies), sizeId })}
          >
            <Printer size={14} /> {busy ? 'Preparing…' : 'Print'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditBatchForm({ batch, onSaved, onCancel }) {
  const [draft, setDraft] = useState({
    batchNumber: batch.batchNumber,
    vialCount: String(batch.vialCount ?? ''),
    madeDate: dateInputValue(batch.madeDate),
    expiryDate: dateInputValue(batch.expiryDate),
    coaUrl: batch.coaUrl,
    supplierName: batch.supplierName,
    notes: batch.notes,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/lab-batches', {
        method: 'PATCH',
        body: JSON.stringify({ id: batch.id, ...draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not save');
        return;
      }
      onSaved(data.batch);
    } catch (err) {
      setError(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, padding: '12px 4px' }}>
      <Field label="Batch number"><input value={draft.batchNumber} onChange={set('batchNumber')} style={inputStyle} /></Field>
      <Field label="Vials"><input type="number" min="0" value={draft.vialCount} onChange={set('vialCount')} style={inputStyle} /></Field>
      <Field label="Made on"><input type="date" value={draft.madeDate} onChange={set('madeDate')} style={inputStyle} /></Field>
      <Field label="Expires"><input type="date" value={draft.expiryDate} onChange={set('expiryDate')} style={inputStyle} /></Field>
      <Field label="Lab report / COA"><input value={draft.coaUrl} onChange={set('coaUrl')} placeholder="https://…" style={inputStyle} /><CoaUploadField value={draft.coaUrl} subject={batch.product} lot={draft.batchNumber||batch.code} onChange={(url)=>setDraft(prev=>({...prev,coaUrl:url}))} disabled={saving} compact/></Field>
      <Field label="Supplier"><input value={draft.supplierName} onChange={set('supplierName')} placeholder="Blank = our lab" style={inputStyle} /></Field>
      <div style={{ gridColumn: '1 / -1' }}>
        <Field label="Notes"><input value={draft.notes} onChange={set('notes')} style={inputStyle} /></Field>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="admin-btn admin-btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        <button type="button" className="admin-btn admin-btn-secondary" onClick={onCancel}>Cancel</button>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>The QR code and product cannot change — QR codes may already be on vials.</span>
        {error && <span style={{ color: '#f87171', fontSize: '0.8rem' }}>{error}</span>}
      </div>
    </div>
  );
}

function RecallList({ code }) {
  const [state, setState] = useState({ loading: true, error: '', orders: [], customersHidden: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminFetch(`/api/admin/lab-batches?orders=${encodeURIComponent(code)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setState({ loading: false, error: data.error || 'Could not load', orders: [], customersHidden: false });
        else setState({ loading: false, error: '', orders: data.orders || [], customersHidden: Boolean(data.customersHidden) });
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err.message || 'Could not load', orders: [], customersHidden: false });
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  if (state.loading) return <div style={{ padding: '10px 4px', color: '#94a3b8', fontSize: '0.85rem' }}>Looking up orders…</div>;
  if (state.error) return <div style={{ padding: '10px 4px', color: '#f87171', fontSize: '0.85rem' }}>{state.error}</div>;
  if (state.orders.length === 0) {
    return (
      <div style={{ padding: '10px 4px', color: '#94a3b8', fontSize: '0.85rem' }}>
        No packed order has a QR code from {code} yet. Orders appear here once a packer scans this batch in Fulfillment.
      </div>
    );
  }
  const totalVials = state.orders.reduce((sum, order) => sum + order.qty, 0);
  return (
    <div style={{ padding: '10px 4px' }}>
      <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: 8 }}>
        {totalVials} vial{totalVials === 1 ? '' : 's'} from {code} went into {state.orders.length} order{state.orders.length === 1 ? '' : 's'}:
        {state.customersHidden && <span style={{ color: '#64748b' }}> (customer names hidden — you do not have Orders access)</span>}
      </div>
      <table className="admin-table" style={{ width: '100%' }}>
        <thead>
          <tr><th>Order</th>{!state.customersHidden && <th>Customer</th>}<th>Vials</th><th>Packed</th></tr>
        </thead>
        <tbody>
          {state.orders.map((order) => (
            <tr key={order.id}>
              <td>#{order.orderNumber}</td>
              {!state.customersHidden && (
                <td>{order.customerName || '—'}{order.customerPhone ? <span style={{ color: '#64748b' }}> · {order.customerPhone}</span> : null}</td>
              )}
              <td>{order.qty}</td>
              <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                {order.packedAt ? formatCrDate(order.packedAt, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
                {order.packedBy ? ` · ${order.packedBy}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LabBatchesManager() {
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [labs, setLabs] = useState([]);
  const [labPortalReady, setLabPortalReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [migration, setMigration] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [oldStockProductId, setOldStockProductId] = useState('');
  const [printing, setPrinting] = useState(null); // { title, defaultCopies, getBatch }
  const [printBusy, setPrintBusy] = useState(false);
  const [expanded, setExpanded] = useState({ id: '', mode: '' }); // mode: 'edit' | 'recall'

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setMigration('');
    try {
      const res = await adminFetch('/api/admin/lab-batches');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not load batches');
        setMigration(data.migration || '');
        return;
      }
      setBatches(data.batches || []);
      setProducts(data.products || []);
      setLabs(data.labs || []);
      setLabPortalReady(Boolean(data.labPortalReady));
    } catch (err) {
      setError(err.message || 'Could not load batches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return batches;
    return batches.filter((batch) => [batch.code, batch.product, batch.batchNumber, batch.supplierName]
      .some((value) => String(value || '').toLowerCase().includes(q)));
  }, [batches, search]);

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const createBatch = async (e) => {
    e.preventDefault();
    setFormError('');
    setMessage('');
    if (!form.productId) { setFormError('Pick a product.'); return; }
    if (!(Number(form.vialCount) >= 1)) { setFormError('Enter how many vials are in this batch.'); return; }
    setCreating(true);
    try {
      const res = await adminFetch('/api/admin/lab-batches', {
        method: 'POST',
        body: JSON.stringify({ kind: 'batch', ...form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error || 'Could not create the batch');
        if (data.migration) setMigration(data.migration);
        return;
      }
      setBatches((prev) => [data.batch, ...prev]);
      setForm(emptyForm);
      setMessage(`Batch ${data.batch.code} created for ${data.batch.product}. Print its QR codes next.`);
      setPrinting({
        title: `QR codes for ${data.batch.code}`,
        defaultCopies: data.batch.vialCount,
        getBatch: async () => data.batch,
      });
    } catch (err) {
      setFormError(err.message || 'Could not create the batch');
    } finally {
      setCreating(false);
    }
  };

  const startOldStockPrint = () => {
    setMessage('');
    const product = products.find((candidate) => candidate.id === oldStockProductId);
    if (!product) { setMessage('Pick a product first.'); return; }
    setPrinting({
      title: `Old-stock QR codes · ${product.product}`,
      defaultCopies: Math.max(1, Number(product.inventoryCount) || 1),
      // Created (or found) only once Print is pressed, so cancelling makes nothing.
      getBatch: async () => {
        const res = await adminFetch('/api/admin/lab-batches', {
          method: 'POST',
          body: JSON.stringify({ kind: 'old_stock', productId: product.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data.migration) setMigration(data.migration);
          throw new Error(data.error || 'Could not get an old-stock code');
        }
        if (!data.reused) setBatches((prev) => [data.batch, ...prev]);
        return data.batch;
      },
    });
  };

  const runPrint = async ({ copies, sizeId }) => {
    if (!printing) return;
    setPrintBusy(true);
    try {
      const batch = await printStickers({ getBatch: printing.getBatch, copies, sizeId });
      setMessage(`Print window opened: ${copies} QR code${copies === 1 ? '' : 's'} for ${batch.code}.`);
      setPrinting(null);
    } catch (err) {
      setMessage(err.message || 'Could not open the print window');
    } finally {
      setPrintBusy(false);
    }
  };

  const toggle = (id, mode) => setExpanded((prev) => (prev.id === id && prev.mode === mode ? { id: '', mode: '' } : { id, mode }));

  return (
    <div className="admin-panel-card" style={{ padding: '20px 22px' }}>
      <div className="admin-toolbar" style={{ marginBottom: 16 }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <FlaskConical size={18} /> Lab batches & QR codes
          </h3>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '0.85rem', maxWidth: 680 }}>
            When a filling run is done, enter the batch here and print its QR codes. Packers scan the
            QR codes in Fulfillment, which records which batch went to which customer. This does not change
            stock — total stock still lives on the Products tab.
          </p>
        </div>
        <button type="button" className="admin-btn" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {migration && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' }}>
          Run <code>{migration}</code> in the Supabase SQL editor, then refresh.
        </div>
      )}
      {error && !migration && <div style={{ marginBottom: 12, color: '#f87171' }}>{error}</div>}
      {message && <div style={{ marginBottom: 12, color: '#86efac' }}>{message}</div>}

      {!migration && <LabCoaReview onDecided={load} />}
      {!migration && <LabPartnersPanel onLabsChanged={load} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 20 }}>
        <form onSubmit={createBatch} style={{ padding: 16, borderRadius: 12, background: 'rgba(15,23,42,0.45)', border: '1px solid rgba(148,163,184,0.18)' }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>1. New batch</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Product">
                <select value={form.productId} onChange={setField('productId')} style={inputStyle}>
                  <option value="">Pick a product…</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.product}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Vials in this batch"><input type="number" min="1" step="1" value={form.vialCount} onChange={setField('vialCount')} style={inputStyle} /></Field>
            <Field label="Made on"><input type="date" value={form.madeDate} onChange={setField('madeDate')} style={inputStyle} /></Field>
            <Field label="Expires"><input type="date" value={form.expiryDate} onChange={setField('expiryDate')} style={inputStyle} /></Field>
            <Field label="Batch number" hint="Blank = use the QR code"><input value={form.batchNumber} onChange={setField('batchNumber')} style={inputStyle} /></Field>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Lab report / COA (optional)"><input value={form.coaUrl} onChange={setField('coaUrl')} placeholder="Paste a URL or upload below" style={inputStyle} /><CoaUploadField value={form.coaUrl} subject={products.find(product=>product.id===form.productId)?.product||'batch'} lot={form.batchNumber||'new-batch'} onChange={(url)=>setForm(prev=>({...prev,coaUrl:url}))} disabled={creating}/></Field>
            </div>
            <Field label="Supplier" hint="Blank = made in our lab"><input value={form.supplierName} onChange={setField('supplierName')} style={inputStyle} /></Field>
            <Field label="Notes"><input value={form.notes} onChange={setField('notes')} style={inputStyle} /></Field>
          </div>
          {formError && <div style={{ color: '#f87171', fontSize: '0.8rem', marginTop: 10 }}>{formError}</div>}
          <button type="submit" className="admin-btn admin-btn-primary" disabled={creating || Boolean(migration)} style={{ marginTop: 12 }}>
            {creating ? 'Creating…' : 'Create batch & print QR codes'}
          </button>
        </form>

        <div style={{ padding: 16, borderRadius: 12, background: 'rgba(15,23,42,0.45)', border: '1px solid rgba(148,163,184,0.18)' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>2. QR codes for vials already on the shelf</div>
          <p style={{ margin: '0 0 12px', color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.5 }}>
            Vials made before this screen existed have no batch. Print them an "old stock" QR code so the
            packers can scan them too. Each product gets one old-stock code; printing again reuses it.
          </p>
          <Field label="Product">
            <select value={oldStockProductId} onChange={(e) => setOldStockProductId(e.target.value)} style={inputStyle}>
              <option value="">Pick a product…</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.product}{Number.isFinite(Number(product.inventoryCount)) && product.inventoryCount !== null ? ` · ${product.inventoryCount} in stock` : ''}
                </option>
              ))}
            </select>
          </Field>
          <button type="button" className="admin-btn" onClick={startOldStockPrint} disabled={Boolean(migration)} style={{ marginTop: 12 }}>
            <Printer size={14} /> Print old-stock QR codes
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ fontWeight: 700 }}>All batches ({batches.length})</div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search code, product, batch…"
          style={{ ...inputStyle, width: 'min(320px, 100%)' }}
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table" style={{ width: '100%', minWidth: 760 }}>
          <thead>
            <tr>
              <th>QR code</th>
              <th>Product</th>
              <th style={{ width: 70 }}>Vials</th>
              <th>Made</th>
              <th>Expires</th>
              <th>Lab report</th>
              {labPortalReady && <th>Tested by</th>}
              <th style={{ width: 300 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={labPortalReady ? 8 : 7} style={{ color: '#94a3b8' }}>Loading…</td></tr>}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={labPortalReady ? 8 : 7} style={{ color: '#94a3b8' }}>{batches.length === 0 ? 'No batches yet. Create the first one above.' : 'Nothing matches that search.'}</td></tr>
            )}
            {visible.map((batch) => {
              const isOpen = expanded.id === batch.id;
              return [
                <tr key={batch.id}>
                  <td>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>{batch.code}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {batch.kind === 'old_stock' ? 'Old stock' : `Batch ${batch.batchNumber}`}
                      {batch.supplierName ? ` · ${batch.supplierName}` : ''}
                    </div>
                  </td>
                  <td>{batch.product}</td>
                  <td>{batch.kind === 'old_stock' ? '—' : batch.vialCount}</td>
                  <td>{shortDate(batch.madeDate)}</td>
                  <td>{shortDate(batch.expiryDate)}</td>
                  <td>
                    {batch.coaUrl
                      ? <a href={batch.coaUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>Open</a>
                      : <span style={{ color: '#64748b' }}>—</span>}
                    {batch.coaPurityPercent !== null && batch.coaPurityPercent !== undefined && (
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{batch.coaPurityPercent}% pure</div>
                    )}
                  </td>
                  {labPortalReady && (
                    <td>
                      <LabAssignSelect
                        batch={batch}
                        labs={labs}
                        onError={(text) => { setMessage(''); setError(text); }}
                        onSaved={(saved) => {
                          setBatches((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
                          const lab = labs.find((row) => row.id === saved.labPartnerId);
                          setMessage(lab ? `${saved.code} is now tested by ${lab.name}.` : `${saved.code} has no lab now.`);
                        }}
                      />
                    </td>
                  )}
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={() => setPrinting({ title: `QR codes for ${batch.code}`, defaultCopies: batch.vialCount || 1, getBatch: async () => batch })}
                      >
                        <Printer size={13} /> Print
                      </button>
                      <button type="button" className="admin-btn" onClick={() => toggle(batch.id, 'recall')} aria-expanded={isOpen && expanded.mode === 'recall'}>
                        <Users size={13} /> Who got it
                      </button>
                      <button type="button" className="admin-btn" onClick={() => toggle(batch.id, 'edit')} aria-expanded={isOpen && expanded.mode === 'edit'}>
                        <Pencil size={13} /> Edit
                      </button>
                    </div>
                  </td>
                </tr>,
                isOpen && (
                  <tr key={`${batch.id}-more`}>
                    <td colSpan={labPortalReady ? 8 : 7} style={{ background: 'rgba(15,23,42,0.35)' }}>
                      {expanded.mode === 'edit'
                        ? (
                          <EditBatchForm
                            batch={batch}
                            onCancel={() => setExpanded({ id: '', mode: '' })}
                            onSaved={(saved) => {
                              setBatches((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
                              setExpanded({ id: '', mode: '' });
                              setMessage(`Saved ${saved.code}.`);
                            }}
                          />
                        )
                        : <RecallList code={batch.code} />}
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>

      {printing && (
        <PrintDialog
          title={printing.title}
          defaultCopies={printing.defaultCopies}
          busy={printBusy}
          onCancel={() => setPrinting(null)}
          onPrint={runPrint}
        />
      )}
    </div>
  );
}
