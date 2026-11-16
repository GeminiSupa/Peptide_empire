'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Moon, RefreshCw, Sun } from 'lucide-react';
import { adminFetch, getAdminAuthHeaders } from '@/lib/adminApi';
import { channelInfo } from '@/lib/channelAttribution.mjs';

/**
 * Reports · Revenue by channel (Belhassen's design, 9 Nov 2026).
 *
 * Paid orders from the CRM, each counted once in one channel. Every figure is
 * worked out on the server (src/lib/revenueByChannel.mjs); this screen only
 * draws it and sends the filters.
 */

const DAY_MS = 86400000;
const crToday = () => new Date(Date.now() - 6 * 3600000).toISOString().slice(0, 10);
const shiftDate = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const mondayOf = (date) => {
  const d = new Date(`${date}T12:00:00Z`);
  return shiftDate(date, -((d.getUTCDay() + 6) % 7));
};

const PRESETS = [
  { key: '7', label: 'Last 7 days', range: () => [shiftDate(crToday(), -6), crToday()] },
  { key: '30', label: 'Last 30 days', range: () => [shiftDate(crToday(), -29), crToday()] },
  { key: 'week', label: 'This week', range: () => [mondayOf(crToday()), crToday()] },
  { key: 'lastweek', label: 'Last week', range: () => [shiftDate(mondayOf(crToday()), -7), shiftDate(mondayOf(crToday()), -1)] },
  { key: 'month', label: 'This month', range: () => [`${crToday().slice(0, 8)}01`, crToday()] },
  { key: 'custom', label: 'Custom…', range: null },
];

const CAPTURE_LABELS = {
  website: 'Website visit (UTM / click ID / referrer)',
  whatsapp_ref: 'WhatsApp ref code',
  agent: 'Set by agent',
  partner_api: 'Partner / API lead',
  unknown: 'Unknown',
};

const pct = (value) => `${Math.round((value || 0) * 100)}%`;
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const fmtDay = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
const fmtPaid = (ms) => new Date(ms - 6 * 3600000).toLocaleString('en-US', {
  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
});

function Segmented({ value, options, onChange, label }) {
  return (
    <div className="rbc-seg" role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button type="button" key={key} aria-pressed={value === key} onClick={() => onChange(key)}>{text}</button>
      ))}
    </div>
  );
}

function StackedBars({ days, money }) {
  const max = Math.max(1, ...days.map((d) => d.paid + d.organic + d.unknown));
  const step = max > 4 ? Math.pow(10, Math.floor(Math.log10(max))) : 1;
  const top = Math.ceil(max / step) * step;
  const ticks = [top, top * 0.66, top * 0.33, 0];
  return (
    <div className="rbc-chart" role="img" aria-label="Paid, organic and unknown revenue by day">
      <div className="rbc-axis">{ticks.map((tick) => <span key={tick}>{money(tick, true)}</span>)}</div>
      <div className="rbc-bars">
        {days.map((d) => (
          <div className="rbc-col" key={d.day} title={`${d.week ? 'Week of ' : ''}${d.day}: paid ${money(d.paid)}, organic ${money(d.organic)}, unknown ${money(d.unknown)}`}>
            <div className="rbc-stack">
              <i className="u" style={{ height: `${(d.unknown / top) * 100}%` }} />
              <i className="o" style={{ height: `${(d.organic / top) * 100}%` }} />
              <i className="p" style={{ height: `${(d.paid / top) * 100}%` }} />
            </div>
            <small>{d.week ? `wk ${d.day.slice(5)}` : fmtDay(d.day)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdSpendBox({ report, onSaved, fetcher }) {
  const paid = (report.channelsList || []).filter((c) => c.type === 'paid');
  const [week, setWeek] = useState(mondayOf(crToday()));
  const [channel, setChannel] = useState(paid[0]?.key || 'google_ads');
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState('');
  const save = async () => {
    setMsg('');
    const res = await fetcher('/api/admin/reports/revenue-by-channel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week_start: mondayOf(week), channel, amount_usd: Number(amount) }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(body.error || 'Could not save.'); return; }
    setMsg('Saved.');
    setAmount('');
    onSaved();
  };
  return (
    <section className="rbc-card">
      <h2>Ad spend</h2>
      <p className="rbc-sub">Type each paid channel's spend for the week (Monday to Sunday) to see ROAS. 0 removes it.</p>
      <div className="rbc-spend">
        <label>Week of<input type="date" value={week} onChange={(e) => setWeek(e.target.value)} /></label>
        <label>Channel
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            {paid.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <label>Amount (USD)<input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label>
        <button type="button" className="rbc-btn primary" onClick={save} disabled={amount === ''}>Save</button>
      </div>
      {msg ? <p className="rbc-sub">{msg}</p> : null}
      {report.adSpend?.length ? (
        <table className="rbc-table compact">
          <thead><tr><th>Week of</th><th>Channel</th><th className="r">Spend</th><th>Entered by</th></tr></thead>
          <tbody>
            {report.adSpend.slice(0, 12).map((row) => (
              <tr key={`${row.week_start}-${row.channel}`}>
                <td>{row.week_start}</td><td>{channelInfo(row.channel).label}</td>
                <td className="r">${Number(row.amount_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td>{row.entered_by || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

export default function RevenueByChannel({ onOpenOrder, fetcher = adminFetch }) {
  const [preset, setPreset] = useState('7');
  const [range, setRange] = useState(PRESETS[0].range());
  const [view, setView] = useState('last');
  const [customers, setCustomers] = useState('all');
  const [agent, setAgent] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drill, setDrill] = useState(null);
  const [light, setLight] = useState(false);
  // Orders from before tracking started have no source, and right after
  // go-live they are nearly all of it: shown, they flatten paid and organic
  // into a sliver. Hidden by default; the Unknown card still shows the share.
  const [showUnknown, setShowUnknown] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.getAttribute('data-theme') === 'light');
  }, []);
  const toggleTheme = () => {
    const next = light ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch {}
    setLight(!light);
  };

  const query = useMemo(() => new URLSearchParams({
    from: range[0], to: range[1], view, customers, ...(agent ? { agent } : {}),
  }).toString(), [range, view, customers, agent]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetcher(`/api/admin/reports/revenue-by-channel?${query}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not load the report.');
      setReport(body);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [query, fetcher]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    const res = await fetch(`/api/admin/reports/revenue-by-channel?${query}&format=csv`, { headers: await getAdminAuthHeaders() });
    if (!res.ok) { setError('Could not export.'); return; }
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = `revenue-by-channel-${range[0]}-to-${range[1]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const rate = Number(report?.rate) || 0;
  const money = useCallback((usd, short = false) => {
    const value = currency === 'CRC' && rate ? usd * rate : usd;
    const symbol = currency === 'CRC' ? '₡' : '$';
    if (short && value >= 1000) return `${symbol}${Math.round(value / 100) / 10}k`;
    return `${symbol}${Math.round(value).toLocaleString('en-US')}`;
  }, [currency, rate]);

  const t = report?.totals;
  const unknownShare = report ? report.byType.unknown.share : 0;
  const unknown = report?.byType.unknown || { orders: 0, usd: 0 };
  const knownUsd = t ? t.usd - unknown.usd : 0;
  const knownOrders = t ? t.orders - unknown.orders : 0;
  const tableRows = !report ? [] : showUnknown
    ? report.channels
    : report.channels
      .filter((row) => row.key !== 'unknown')
      .map((row) => ({ ...row, share: knownUsd > 0 ? row.usd / knownUsd : 0 }));
  const chartDays = !report ? [] : showUnknown ? report.days : report.days.map((day) => ({ ...day, unknown: 0 }));
  const totalRow = !t ? null : showUnknown
    ? { label: 'Total', orders: t.orders, usd: t.usd, avgUsd: t.avgUsd, newCustomers: t.newCustomers }
    : {
      label: 'Total (known source)',
      orders: knownOrders,
      usd: knownUsd,
      avgUsd: knownOrders ? knownUsd / knownOrders : 0,
      newCustomers: tableRows.reduce((sum, row) => sum + row.newCustomers, 0),
    };
  const hiddenNote = !showUnknown && unknown.orders > 0
    ? `Hiding ${plural(unknown.orders, 'order')} (${money(unknown.usd)}) with no known source — mostly orders from before tracking started. Choose "Show unknown" to include them.`
    : '';
  const drillRows = report && drill ? report.orders.filter((row) => row.channel === drill) : [];

  return (
    <div className="rbc">
      <div className="rbc-top">
        <span>PCR Admin · Reports</span>
        <button type="button" className="rbc-btn" onClick={toggleTheme} aria-label="Switch between light and dark">
          {light ? <Moon size={16} /> : <Sun size={16} />}{light ? 'Dark mode' : 'Light mode'}
        </button>
      </div>

      <header className="rbc-head">
        <div>
          <p className="rbc-eyebrow">Reports</p>
          <h1>Revenue by channel</h1>
          <p className="rbc-sub">Paid orders only, from the CRM. Each order counts once, in one channel.</p>
        </div>
        <div className="rbc-actions">
          <select className="rbc-btn" value={preset} onChange={(e) => {
            const next = PRESETS.find((p) => p.key === e.target.value);
            setPreset(next.key);
            if (next.range) setRange(next.range());
          }} aria-label="Date range">
            {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          {preset === 'custom' ? (
            <>
              <input className="rbc-btn" type="date" value={range[0]} max={range[1]} onChange={(e) => setRange([e.target.value, range[1]])} aria-label="From" />
              <input className="rbc-btn" type="date" value={range[1]} min={range[0]} onChange={(e) => setRange([range[0], e.target.value])} aria-label="To" />
            </>
          ) : null}
          <button type="button" className="rbc-btn" onClick={load} aria-label="Refresh"><RefreshCw size={16} /></button>
          <button type="button" className="rbc-btn primary" onClick={exportCsv}><Download size={16} />Export CSV</button>
        </div>
      </header>

      <div className="rbc-card rbc-filters">
        <Segmented label="Credit" value={view} onChange={setView} options={[['last', 'Last touch'], ['first', 'First touch']]} />
        <Segmented label="Customers" value={customers} onChange={setCustomers} options={[['all', 'All customers'], ['new', 'New'], ['returning', 'Returning']]} />
        <Segmented label="Currency" value={currency} onChange={setCurrency} options={[['USD', 'USD'], ['CRC', 'CRC']]} />
        <Segmented label="Unknown source" value={showUnknown ? 'show' : 'hide'} onChange={(value) => setShowUnknown(value === 'show')} options={[['hide', 'Hide unknown'], ['show', 'Show unknown']]} />
        <label className="rbc-agent">Agent
          <select value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value="">All agents</option>
            {(report?.agents || []).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </div>

      {report && !report.tracking?.ready ? (
        <p className="rbc-warn">Channel tracking is not switched on yet: run <b>add-order-channel-attribution.sql</b> in Supabase. Until then only older Google, TikTok, email and affiliate signals show; everything else is Unknown.</p>
      ) : null}
      {error ? <p className="rbc-warn">{error}</p> : null}
      {loading && !report ? <p className="rbc-sub">Loading…</p> : null}

      {report ? (
        <div className={`rbc-body${loading ? ' busy' : ''}`}>
          <div className="rbc-kpis">
            <div className="rbc-card kpi">
              <span>Revenue</span>
              <b>{money(t.usd)}</b>
              {t.changePct === null ? <small>No sales in the previous period</small> : (
                <small className={t.changePct >= 0 ? 'up' : 'down'}>{t.changePct >= 0 ? '▲' : '▼'} {pct(Math.abs(t.changePct))} vs previous period</small>
              )}
            </div>
            <div className="rbc-card kpi">
              <span><i className="dot p" />Paid channels</span>
              <b>{money(report.byType.paid.usd)}</b>
              <small>{pct(report.byType.paid.share)} of revenue · {plural(report.byType.paid.orders, 'order')}</small>
            </div>
            <div className="rbc-card kpi">
              <span><i className="dot o" />Organic channels</span>
              <b>{money(report.byType.organic.usd)}</b>
              <small>{pct(report.byType.organic.share)} of revenue · {plural(report.byType.organic.orders, 'order')}</small>
            </div>
            <div className="rbc-card kpi">
              <span>Orders · Avg order</span>
              <b>{t.orders} · {money(t.avgUsd)}</b>
              <small>{t.newCustomers} new customers · {t.returning} returning</small>
            </div>
            <div className={`rbc-card kpi${unknownShare > 0.05 ? ' alert' : ''}`}>
              <span><i className="dot u" />Unknown source</span>
              <b>{pct(unknownShare)}</b>
              <small>{money(report.byType.unknown.usd)} · {plural(report.byType.unknown.orders, 'order')}{unknownShare > 0.05 ? ' · keep under 5%' : ''}</small>
            </div>
          </div>

          <section className="rbc-card">
            <div className="rbc-row">
              <h2>Paid vs organic, by {report.days[0]?.week ? 'week' : 'day'}</h2>
              <div className="rbc-legend"><span><i className="dot p" />Paid</span><span><i className="dot o" />Organic</span>{showUnknown ? <span><i className="dot u" />Unknown</span> : null}</div>
            </div>
            <StackedBars days={chartDays} money={money} />
            {!showUnknown && knownOrders === 0 ? <p className="rbc-sub">No orders with a known source in this period yet.</p> : null}
            {hiddenNote ? <p className="rbc-sub">{hiddenNote}</p> : null}
            {report.tracking?.goLive ? <p className="rbc-sub">Channel tracking started {report.tracking.goLive.slice(0, 10)}. Orders before that are mostly Unknown.</p> : null}
          </section>

          <section className="rbc-card">
            <h2>By channel</h2>
            <p className="rbc-sub">Click a channel to see its orders.</p>
            <div className="rbc-scroll">
              <table className="rbc-table">
                <thead>
                  <tr>
                    <th>Channel</th><th>Type</th><th className="r">Orders</th><th className="r">Revenue</th><th>Share</th>
                    <th className="r">Avg order</th><th className="r">New cust.</th><th className="r">Assisted</th><th className="r">Ad spend</th><th className="r">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.key} className={`click${drill === row.key ? ' sel' : ''}`} onClick={() => setDrill(drill === row.key ? null : row.key)}>
                      <td><b>{row.label}</b></td>
                      <td><span className={`rbc-pill ${row.type}`}>{row.type === 'paid' ? 'Paid' : row.type === 'organic' ? 'Organic' : 'Unknown'}</span></td>
                      <td className="r">{row.orders}</td>
                      <td className="r">{money(row.usd)}</td>
                      <td><div className="rbc-share"><i className={row.type} style={{ width: pct(row.share) }} /><span>{pct(row.share)}</span></div></td>
                      <td className="r">{row.orders ? money(row.avgUsd) : '–'}</td>
                      <td className="r">{row.newCustomers}</td>
                      <td className="r">{row.type === 'unknown' ? '–' : row.assisted}</td>
                      <td className="r">{row.spendUsd ? money(row.spendUsd) : '–'}</td>
                      <td className="r">{row.roas ?? '–'}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td><b>{totalRow.label}</b></td><td /><td className="r">{totalRow.orders}</td><td className="r">{money(totalRow.usd)}</td><td>100%</td>
                    <td className="r">{money(totalRow.avgUsd)}</td><td className="r">{totalRow.newCustomers}</td><td />
                    <td className="r">{t.spendUsd ? money(t.spendUsd) : '–'}</td><td className="r">{t.roas ?? '–'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {hiddenNote ? <p className="rbc-sub">{hiddenNote}</p> : null}
            <p className="rbc-sub">Assisted = orders where this channel was the first touch but another channel got the credit. ROAS = paid revenue ÷ ad spend.</p>
          </section>

          {drill ? (
            <section className="rbc-card">
              <div className="rbc-row">
                <h2>Orders · {channelInfo(drill).label}</h2>
                <button type="button" className="rbc-btn" onClick={() => setDrill(null)}>Close</button>
              </div>
              <p className="rbc-sub">{drillRows.length} orders</p>
              <div className="rbc-scroll">
                <table className="rbc-table">
                  <thead><tr><th>Order</th><th>Paid (CR)</th><th className="r">Value</th><th>Payment</th><th>First touch</th><th>Last touch</th><th>Campaign</th><th>Captured by</th><th>Customer</th></tr></thead>
                  <tbody>
                    {drillRows.slice(0, 300).map((row) => (
                      <tr key={row.id}>
                        <td><button type="button" className="rbc-link" onClick={() => onOpenOrder?.(row.id)}>{row.orderNumber}</button></td>
                        <td>{fmtPaid(row.paidAt)}</td>
                        <td className="r">{money(row.usd)}</td>
                        <td>{row.paymentMethod}</td>
                        <td>{channelInfo(row.first).label}</td>
                        <td>{channelInfo(row.last).label}</td>
                        <td>{row.campaign || '–'}</td>
                        <td>{CAPTURE_LABELS[row.capturedBy] ? CAPTURE_LABELS[row.capturedBy].split(' (')[0] : row.capturedBy}</td>
                        <td>{row.customerType === 'new' ? 'New' : 'Returning'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <div className="rbc-two">
            <section className="rbc-card">
              <h2>Tracking coverage</h2>
              <p className="rbc-sub">How each order got its source. Keep Unknown under 5%.</p>
              {report.coverage.map((row) => (
                <div className="rbc-cov" key={row.key}>
                  <span>{CAPTURE_LABELS[row.key] || row.key}</span>
                  <div className="rbc-share"><i className={row.key === 'unknown' ? 'unknown' : 'organic'} style={{ width: pct(row.share) }} /><span>{pct(row.share)}</span></div>
                </div>
              ))}
              <p className="rbc-sub">
                Google Ads orders with a click ID: {report.clickIds.googleWith} of {report.clickIds.google}
                {' · '}Meta orders with fbclid: {report.clickIds.metaWith} of {report.clickIds.meta}
              </p>
            </section>

            <section className="rbc-card">
              <h2>First touch vs last touch</h2>
              <p className="rbc-sub">Same orders, credited two ways. Big gaps show which channels start sales and which close them.</p>
              <table className="rbc-table compact">
                <thead><tr><th>Channel</th><th className="r">First touch</th><th className="r">Last touch</th><th className="r">Gap</th></tr></thead>
                <tbody>
                  {report.channels.filter((row) => row.key !== 'unknown' && (row.firstUsd || row.lastUsd)).map((row) => {
                    const gap = row.firstUsd - row.lastUsd;
                    return (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        <td className="r">{money(row.firstUsd)}</td>
                        <td className="r">{money(row.lastUsd)}</td>
                        <td className={`r ${gap > 0 ? 'up' : gap < 0 ? 'down' : ''}`}>{gap > 0 ? '+' : gap < 0 ? '−' : ''}{money(Math.abs(gap))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </div>

          <AdSpendBox report={report} onSaved={load} fetcher={fetcher} />
        </div>
      ) : null}
    </div>
  );
}
