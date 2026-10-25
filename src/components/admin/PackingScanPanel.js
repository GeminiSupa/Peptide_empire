"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, CheckCircle2, ScanLine, Undo2, X, XCircle } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';
import { formatCrDate } from '@/lib/crTime.mjs';
import { parseStickerCode } from '@/lib/labBatches.mjs';
import { checkScan, packingProgress } from '@/lib/packingScan.mjs';

/**
 * Scan & pack: the packer scans every vial's sticker before the box closes.
 *
 * A right vial ticks green with a short beep. A wrong product or size, one
 * too many, or a sticker nobody printed stops them in red with a buzz. When
 * every line is ticked the record saves itself: which batch went into this
 * order, by whom, when. That is what the recall list on Lab batches reads.
 *
 * Two ways to scan, same box:
 *  - a USB / Bluetooth scanner, which simply types the sticker into the
 *    focused text box and presses Enter;
 *  - the phone or laptop camera.
 *
 * Saving changes nothing else: no status, no stock. The tracking number and
 * "Order Complete" still happen in the order itself, as before.
 */

// The camera sees the same sticker five times a second, and two vials from one
// batch carry identical stickers. So a code counts again only after it has
// been out of view this long: holding a vial still is one vial, and the next
// vial of the same batch counts once the first has left the frame. Erring this
// way matters — counting a held vial twice would let a box ship one short.
const SAME_CODE_GAP_MS = 800;

function useFeedbackSound() {
  const ctxRef = useRef(null);
  const ensure = useCallback(() => {
    try {
      if (!ctxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) ctxRef.current = new Ctx();
      }
      if (ctxRef.current?.state === 'suspended') ctxRef.current.resume();
    } catch { /* sound is a nicety; the colour carries the message */ }
  }, []);
  const play = useCallback((ok) => {
    try {
      ensure();
      const ctx = ctxRef.current;
      if (ctx) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = ok ? 'sine' : 'square';
        osc.frequency.value = ok ? 880 : 180;
        gain.gain.value = ok ? 0.15 : 0.2;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + (ok ? 0.12 : 0.45));
      }
      navigator.vibrate?.(ok ? 40 : [150, 80, 150]);
    } catch { /* see above */ }
  }, [ensure]);
  useEffect(() => () => { try { ctxRef.current?.close(); } catch { /* closing */ } }, []);
  return { play, ensure };
}

export default function PackingScanPanel({ order, onClose, onSaved, onOpenOrder }) {
  // Lines come from the server, which resolves each order name to its product
  // ("Agua Bacteriostática 3ml" is the BAC Water 3ml row) the way checkout does.
  const [lines, setLines] = useState(null);
  const [linesError, setLinesError] = useState('');
  const [entries, setEntries] = useState([]);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState(null); // { tone: 'ok' | 'error' | 'info', text }
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null); // { packedItems, packedAt, packedBy }
  const [saveError, setSaveError] = useState('');
  const [rescanning, setRescanning] = useState(!order.packed_at);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const loopRef = useRef(null);
  const batchCache = useRef(new Map());
  // Every place that changes `entries` writes this first, so a scan queued
  // behind another is checked against the list that already holds it.
  const entriesRef = useRef(entries);
  const queueRef = useRef(Promise.resolve());
  const enqueueRef = useRef(() => {});
  const lastCameraRead = useRef({ code: '', at: 0 });
  const { play, ensure } = useFeedbackSound();

  const progress = packingProgress(lines || [], entries);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminFetch(`/api/admin/packing?orderId=${encodeURIComponent(order.id)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setLinesError(data.error || 'Could not load this order');
        else setLines(data.lines || []);
      } catch (err) {
        if (!cancelled) setLinesError(err.message || 'Could not load this order');
      }
    })();
    return () => { cancelled = true; };
  }, [order.id]);

  const focusInput = useCallback(() => {
    // Not on a touch phone: focusing pops the keyboard over the camera view.
    if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) return;
    inputRef.current?.focus();
  }, []);

  useEffect(() => { if (rescanning) focusInput(); }, [rescanning, focusInput]);

  const lookupBatch = useCallback(async (code) => {
    if (batchCache.current.has(code)) return batchCache.current.get(code);
    const res = await adminFetch(`/api/admin/packing?code=${encodeURIComponent(code)}`);
    const data = await res.json().catch(() => ({}));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(data.error || 'Could not read that sticker');
    batchCache.current.set(code, data.batch);
    return data.batch;
  }, []);

  const processScan = useCallback(async (raw) => {
    const code = parseStickerCode(raw);
    if (!code) return;
    try {
      const batch = await lookupBatch(code);
      if (!batch) {
        play(false);
        setFeedback({ tone: 'error', text: `STOP — sticker ${code} is not a known batch. Set this vial aside.` });
        return;
      }
      const current = entriesRef.current;
      const verdict = checkScan(lines || [], current, batch.key);
      if (!verdict.ok) {
        play(false);
        setFeedback({
          tone: 'error',
          text: verdict.reason === 'not_in_order'
            ? `STOP — ${batch.product} is not in this order. Take it out.`
            : `STOP — one too many ${batch.product}. This order needs ${verdict.line?.needed ?? 'fewer'}.`,
        });
        return;
      }
      const { line } = verdict;
      const next = [...current, { method: 'scan', code: batch.code, batchId: batch.id, key: line.key, product: line.product, at: Date.now() }];
      entriesRef.current = next;
      setEntries(next);
      play(true);
      const done = next.filter((entry) => entry.key === line.key).length;
      setFeedback({ tone: 'ok', text: `✓ ${line.product} · ${batch.code} — ${done} of ${line.needed}` });
    } catch (err) {
      play(false);
      setFeedback({ tone: 'error', text: err.message || 'Could not read that sticker' });
    }
  }, [lines, lookupBatch, play]);

  // A USB scanner can fire two stickers faster than one lookup returns. Queue
  // them so the second is checked against a list that already holds the first.
  const enqueueScan = useCallback((raw) => {
    queueRef.current = queueRef.current.then(() => processScan(raw)).catch(() => {});
  }, [processScan]);
  // The camera loop is set up once and calls through this, so it always uses
  // the current rule rather than the one in place when the camera started.
  useEffect(() => { enqueueRef.current = enqueueScan; }, [enqueueScan]);

  const submitInput = () => {
    const value = input;
    setInput('');
    ensure();
    if (value.trim()) enqueueScan(value);
    focusInput();
  };

  const checkByHand = (line) => {
    const verdict = checkScan(lines || [], entriesRef.current, line.key);
    if (!verdict.ok) return;
    const next = [...entriesRef.current, { method: 'manual', key: line.key, product: line.product, at: Date.now() }];
    entriesRef.current = next;
    setEntries(next);
    play(true);
    setFeedback({ tone: 'info', text: `${line.product} checked by hand (no sticker). It is saved as "checked by hand".` });
    focusInput();
  };

  const undoLast = () => {
    const next = entriesRef.current.slice(0, -1);
    entriesRef.current = next;
    setEntries(next);
    setFeedback({ tone: 'info', text: 'Last item removed. Scan it again if it belongs.' });
    focusInput();
  };

  const stopCamera = useCallback(() => {
    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const startCamera = async () => {
    setCameraError('');
    ensure();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot use the camera here.');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      const { BarcodeDetector } = await import('barcode-detector/ponyfill');
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      let busy = false;
      loopRef.current = setInterval(async () => {
        const el = videoRef.current;
        if (busy || !el || el.readyState < 2) return;
        busy = true;
        try {
          const found = await detector.detect(el);
          const raw = found?.[0]?.rawValue;
          if (raw) {
            const now = Date.now();
            const same = raw === lastCameraRead.current.code;
            if (!same || now - lastCameraRead.current.at > SAME_CODE_GAP_MS) {
              enqueueRef.current(raw);
            }
            // Every sighting moves "last seen" forward, so one long hold is
            // still one vial.
            lastCameraRead.current = { code: raw, at: now };
          }
        } catch { /* a frame that will not decode is normal; try the next */ }
        busy = false;
      }, 200);
    } catch (err) {
      stopCamera();
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
      setCameraError(denied
        ? 'Camera permission was refused. Allow the camera for this site in the browser settings, or use a USB scanner.'
        : (err.message || 'Could not start the camera.'));
    }
  };

  useEffect(() => () => stopCamera(), [stopCamera]);

  const save = useCallback(async (toSave) => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await adminFetch('/api/admin/packing', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order.id,
          entries: toSave.map(({ method, code, key }) => (method === 'manual' ? { method, key } : { method, code })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.migration
          ? `Run ${data.migration} in the Supabase SQL editor first — the check is done but could not be saved.`
          : (data.error || 'Could not save the packing record'));
        return;
      }
      setSaved(data);
      setRescanning(false);
      stopCamera();
      onSaved?.(order.id, data);
    } catch (err) {
      setSaveError(err.message || 'Could not save the packing record');
    } finally {
      setSaving(false);
    }
  }, [onSaved, order.id, stopCamera]);

  // The box is right the moment the last item ticks; saving then is not a
  // decision anyone needs to be asked about.
  useEffect(() => {
    if (rescanning && progress.complete && !saving && !saved && !saveError) save(entries);
  }, [rescanning, progress.complete, saving, saved, saveError, save, entries]);

  const record = saved
    ? { items: saved.packedItems, at: saved.packedAt, by: saved.packedBy }
    : (order.packed_at ? { items: order.packed_items || [], at: order.packed_at, by: order.packed_by } : null);

  const toneStyle = {
    ok: { background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.5)', color: '#bbf7d0' },
    error: { background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.6)', color: '#fecaca' },
    info: { background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.3)', color: '#e2e8f0' },
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Scan and pack order ${order.order_number}`}
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.78)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 12, overflowY: 'auto' }}
    >
      <div className="admin-panel-card" style={{ width: 'min(640px, 100%)', padding: 18, marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem' }}>
              <ScanLine size={18} /> Scan & pack #{order.order_number}
            </h3>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 4 }}>{order.customer_name || 'Customer'}</div>
          </div>
          <button type="button" onClick={() => { stopCamera(); onClose(); }} aria-label="Close" style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {!rescanning && record && (
          <div style={{ ...toneStyle.ok, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={16} /> {saved ? 'All checked and saved.' : 'Already scan-checked.'}
            </div>
            <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
              {record.by ? `By ${record.by} · ` : ''}
              {formatCrDate(record.at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: '0.82rem' }}>
              {record.items.map((item, index) => (
                <li key={`${item.product}-${item.batch_code}-${index}`}>
                  {item.qty}× {item.product} — {item.method === 'manual' ? 'checked by hand' : `batch ${item.batch_code}`}
                </li>
              ))}
            </ul>
            <div style={{ fontSize: '0.8rem', marginTop: 10, color: '#e2e8f0' }}>
              Next: open the order, add the tracking number and set it to <strong>Order Complete</strong>.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button type="button" className="admin-btn admin-btn-primary" onClick={() => { stopCamera(); onOpenOrder?.(order); }}>
                Open order
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => { setEntries([]); entriesRef.current = []; setSaved(null); setSaveError(''); setFeedback(null); setRescanning(true); }}
              >
                Scan again
              </button>
            </div>
          </div>
        )}

        {rescanning && !lines && (
          <div style={{ padding: '16px 4px', color: linesError ? '#fca5a5' : '#94a3b8', fontSize: '0.9rem' }}>
            {linesError || 'Loading what goes in this box…'}
          </div>
        )}

        {rescanning && lines && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', flexWrap: 'wrap', marginBottom: 10 }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  // Scanners end with Enter; some are set to Tab instead.
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    submitInput();
                  }
                }}
                placeholder="Scan a sticker (USB scanner types here)…"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                style={{ flex: '1 1 240px', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.35)', background: 'rgba(15,23,42,0.7)', color: '#e2e8f0', fontSize: '0.95rem' }}
              />
              {cameraOn ? (
                <button type="button" className="admin-btn admin-btn-secondary" onClick={stopCamera}>
                  <CameraOff size={15} /> Stop camera
                </button>
              ) : (
                <button type="button" className="admin-btn admin-btn-primary" onClick={startCamera}>
                  <Camera size={15} /> Use camera
                </button>
              )}
            </div>

            {cameraError && <div style={{ color: '#fca5a5', fontSize: '0.8rem', marginBottom: 10 }}>{cameraError}</div>}

            <div style={{ display: cameraOn ? 'block' : 'none', marginBottom: 10 }}>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                style={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 10, background: '#000' }}
              />
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>
                Show one sticker, wait for the beep, move it out of view, then show the next vial.
              </div>
            </div>

            {feedback && (
              <div
                role="status"
                aria-live="assertive"
                style={{ ...toneStyle[feedback.tone], borderRadius: 10, padding: '12px 14px', marginBottom: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, fontSize: feedback.tone === 'error' ? '1rem' : '0.9rem' }}
              >
                {feedback.tone === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                {feedback.text}
              </div>
            )}

            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 6 }}>
              {progress.packed} of {progress.needed} checked
              {saving && ' · saving…'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {progress.lines.map((line) => {
                const done = line.packed >= line.needed;
                return (
                  <div
                    key={line.key}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                      padding: '10px 12px', borderRadius: 10,
                      background: done ? 'rgba(34,197,94,0.12)' : 'rgba(15,23,42,0.5)',
                      border: `1px solid ${done ? 'rgba(34,197,94,0.45)' : 'rgba(148,163,184,0.2)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      {done ? <CheckCircle2 size={16} color="#4ade80" /> : <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #64748b', flex: '0 0 auto' }} />}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{line.product}</div>
                        {/* The order may spell it differently from the sticker
                            ("Agua Bacteriostática 3ml" vs "BAC Water 3ml"). */}
                        {line.catalogName && line.catalogName.toLowerCase() !== line.product.toLowerCase() && (
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Sticker says: {line.catalogName}</div>
                        )}
                        {!line.scannable && (
                          <div style={{ fontSize: '0.72rem', color: '#fbbf24' }}>Not matched to a product in the list — check it by hand.</div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto' }}>
                      {!done && (
                        <button
                          type="button"
                          onClick={() => checkByHand(line)}
                          title="For a vial with no sticker yet"
                          style={{ background: 'none', border: 'none', padding: 0, color: '#94a3b8', fontSize: '0.72rem', textDecoration: 'underline', cursor: 'pointer' }}
                        >
                          {line.scannable ? 'No sticker? Check 1 by hand' : 'Check 1 by hand'}
                        </button>
                      )}
                      <strong style={{ color: done ? '#4ade80' : '#e2e8f0' }}>{line.packed} / {line.needed}</strong>
                    </div>
                  </div>
                );
              })}
            </div>

            {saveError && (
              <div style={{ ...toneStyle.error, borderRadius: 10, padding: '10px 12px', marginBottom: 10, fontSize: '0.85rem' }}>
                {saveError}
                <div style={{ marginTop: 8 }}>
                  <button type="button" className="admin-btn" onClick={() => { setSaveError(''); save(entriesRef.current); }} disabled={saving}>Try saving again</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="admin-btn admin-btn-secondary" onClick={undoLast} disabled={entries.length === 0 || saving}>
                <Undo2 size={14} /> Undo last
              </button>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                It saves by itself when every line is green.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
