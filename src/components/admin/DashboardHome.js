'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardList, ShoppingCart, Target, DollarSign, Package,
  AlertTriangle, Inbox, MessageSquare, ChevronRight, Star, CheckCircle,
} from 'lucide-react';
import { orderCountsAsSale, orderGrossUsd, orderNetRevenueUsd, orderRevenueBasis } from '@/lib/orderRevenue.mjs';
import { orderReportableAtMs } from '@/lib/agentDashboard.mjs';
import KpiBreakdownModal from './KpiBreakdownModal';
import { formatCrDate, formatCrInstant } from '@/lib/crTime.mjs';
import { isAwaitingPayment } from '@/lib/orderAwaitingPayment.mjs';
import { FALLBACK_EXCHANGE_RATE } from '@/lib/pricing';
import ExchangeRateSettings from './ExchangeRateSettings';
import { calculateExpandedSalesMetrics } from '@/lib/salesAnalytics.mjs';
import { adminFetch } from '@/lib/adminApi';

function isOutOfStock(status) {
  const s = (status || '').toLowerCase();
  return s.includes('out of stock') || s.includes('agotado');
}

function isComingSoon(status) {
  const s = (status || '').toLowerCase();
  return s.includes('coming soon') || s.includes('próximamente');
}

// Costa Rica is UTC−6 year-round (no daylight saving), so we anchor "today" and
// "this week" to Costa Rica time — every admin sees the same day regardless of
// their own machine's timezone.
const CR_OFFSET_MS = 6 * 60 * 60 * 1000;

// Start of "today" in Costa Rica, returned as an absolute instant (real Date).
function startOfDay(d = new Date()) {
  const cr = new Date(d.getTime() - CR_OFFSET_MS); // shift into CR wall-clock frame
  cr.setUTCHours(0, 0, 0, 0);                       // midnight, CR time
  return new Date(cr.getTime() + CR_OFFSET_MS);     // back to the real UTC instant
}

// Start of the week (Monday) in Costa Rica, as an absolute instant.
function startOfWeek(d = new Date()) {
  const cr = new Date(d.getTime() - CR_OFFSET_MS);
  cr.setUTCHours(0, 0, 0, 0);
  const day = cr.getUTCDay();                        // 0 = Sunday, in CR time
  const diff = day === 0 ? 6 : day - 1;
  cr.setUTCDate(cr.getUTCDate() - diff);
  return new Date(cr.getTime() + CR_OFFSET_MS);
}

/** YYYY-MM-DD for a Date in Costa Rica wall-clock (for <input type="date">). */
function toCrYmd(d = new Date()) {
  const cr = new Date(d.getTime() - CR_OFFSET_MS);
  return cr.toISOString().slice(0, 10);
}

/**
 * Midnight Costa Rica for a YYYY-MM-DD the admin typed. The date field has no
 * timezone, so we treat the day as a business day in CR — same as the presets.
 */
function startOfCrYmd(ymd) {
  const text = String(ymd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const utcMidnight = new Date(`${text}T00:00:00Z`);
  if (!Number.isFinite(utcMidnight.getTime())) return null;
  return new Date(utcMidnight.getTime() + CR_OFFSET_MS);
}

/**
 * Custom From/To window. End day is inclusive (through CR midnight of the next
 * day). Reversed picks are swapped so choosing the end first still works.
 */
function customKpiWindow(startYmd, endYmd) {
  let from = startOfCrYmd(startYmd);
  let toDay = startOfCrYmd(endYmd);
  if (!from || !toDay) return null;
  if (from > toDay) [from, toDay] = [toDay, from];
  return { start: from, end: new Date(toDay.getTime() + 86400000) };
}

// The date revenue should be recognized on: the first moment the order was
// marked Paid or complete. The shared helper falls back to created_at for
// legacy reportable orders with no status event logged.
function getRevenueDate(order) {
  return new Date(orderReportableAtMs(order));
}

function cartValue(cart) {
  if (!Array.isArray(cart.cart_data)) return 0;
  return cart.cart_data.reduce((sum, item) => {
    const p = parseFloat(String(item.price_usd || item.priceUsd || item.price || '0').replace(/[^0-9.]/g, '')) || 0;
    return sum + p * (item.qty || 1);
  }, 0);
}

// One window for the whole KPI row. Every start is a Costa Rica instant,
// because the business day belongs to Costa Rica and not to whoever is reading,
// and the week runs Monday to Sunday. "Custom" has no fixed start — the From/To
// fields below the dropdown set the bounds.
const KPI_RANGES = [
  { id: 'week', label: 'This week', start: (now) => startOfWeek(now) },
  { id: 'today', label: 'Today', start: (now) => startOfDay(now) },
  { id: '30d', label: 'Last 30 days', start: (now) => new Date(startOfDay(now).getTime() - 29 * 86400000) },
  { id: 'all', label: 'All time', start: () => null },
  { id: 'custom', label: 'Custom range', start: () => null },
];

const KPI_RANGE_BY_ID = new Map(KPI_RANGES.map((range) => [range.id, range]));

/** Spelled out on hover, because "this week" alone does not say whose week. */
function kpiRangeTooltip(range, start, end, now) {
  if (range.id === 'custom') {
    if (!start || !end) return 'Pick a From and To date (Costa Rica days).';
    const day = { weekday: 'short', day: 'numeric', month: 'short' };
    // end is exclusive (start of the day after To), so show the last included day.
    const lastDay = new Date(end.getTime() - 1);
    return `Custom: ${formatCrDate(start, day)} to ${formatCrDate(lastDay, day)}, Costa Rica time.`;
  }
  if (!start) return 'Everything on record, with no date limit.';
  const day = { weekday: 'short', day: 'numeric', month: 'short' };
  return `${range.label}: ${formatCrDate(start, day)} to ${formatCrDate(now, day)}, Costa Rica time.`;
}

export default function DashboardHome({
  orders = [],
  abandonedCarts = [],
  leads = [],
  products = [],
  inquiryCount = 0,
  onNavigate,
  onOpenOrder,
  onCreateOrder,
  isSuperadmin = false,
  onOverrideStats,
  exchangeRate = FALLBACK_EXCHANGE_RATE,
  manualExchangeRate = null,
  onExchangeRateChanged,
}) {
  // Which tile's breakdown is open: 'revenue' | 'pendingOrders'.
  const [openTile, setOpenTile] = useState(null);
  // One window over the whole row, opening on today because this screen is the
  // day's work. Early in the Costa Rica morning that is legitimately zero, and
  // the row says so on hover rather than looking broken; the week is one click
  // away in the dropdown. Custom uses the two date fields, not a fixed start.
  const [kpiRange, setKpiRange] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [trustpilotStatus, setTrustpilotStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    adminFetch('/api/admin/reviews/stats')
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error || 'Could not load Trustpilot status');
        if (!cancelled) setTrustpilotStatus(body?.available ? body : { unavailable: true });
      })
      .catch(() => {
        if (!cancelled) setTrustpilotStatus({ unavailable: true });
      });
    return () => { cancelled = true; };
  }, []);

  const activeKpiRange = KPI_RANGE_BY_ID.get(kpiRange) || KPI_RANGES[0];
  const customWindow = useMemo(
    () => (kpiRange === 'custom' ? customKpiWindow(customStart, customEnd) : null),
    [kpiRange, customStart, customEnd]
  );
  const customIncomplete = kpiRange === 'custom' && !customWindow;
  const kpiRangeStart = useMemo(() => {
    if (kpiRange === 'custom') return customWindow?.start ?? null;
    return activeKpiRange.start(new Date());
  }, [kpiRange, activeKpiRange, customWindow]);
  // Presets run through "now" (no end). Custom closes at the end of the To day.
  const kpiRangeEnd = kpiRange === 'custom' ? (customWindow?.end ?? null) : null;
  const kpiRangeLabel = useMemo(() => {
    if (kpiRange !== 'custom') return activeKpiRange.label;
    if (!customWindow) return 'Custom range';
    const day = { day: 'numeric', month: 'short' };
    const lastDay = new Date(customWindow.end.getTime() - 1);
    return `${formatCrDate(customWindow.start, day)} – ${formatCrDate(lastDay, day)}`;
  }, [kpiRange, activeKpiRange, customWindow]);
  const kpiRangeHint = kpiRangeTooltip(activeKpiRange, kpiRangeStart, kpiRangeEnd, new Date());

  const selectKpiRange = (nextId) => {
    setKpiRange(nextId);
    // Opening Custom with empty fields would blank the tiles; seed this CR week.
    if (nextId === 'custom' && (!customStart || !customEnd)) {
      const now = new Date();
      setCustomStart(toCrYmd(startOfWeek(now)));
      setCustomEnd(toCrYmd(now));
    }
  };

  const expandedMetrics = useMemo(
    () => calculateExpandedSalesMetrics(orders, products, exchangeRate),
    [orders, products, exchangeRate]
  );

  const stats = useMemo(() => {
    const now = new Date();
    // Custom incomplete: neither bound yet, so nothing qualifies until both
    // dates are set. Presets with no start ('all') mean everything qualifies.
    const inRange = (date) => {
      if (customIncomplete) return false;
      if (kpiRangeStart && date < kpiRangeStart) return false;
      if (kpiRangeEnd && date >= kpiRangeEnd) return false;
      return true;
    };

    // Every state that is waiting on money, not just the literal 'Pending'.
    const pendingOrders = orders.filter(
      (o) => isAwaitingPayment(o.status) && inRange(new Date(o.created_at))
    );

    // Net of refunds: a $100 order with $30 given back is $70 of revenue, not
    // $100. The same sum backs the commission report and the analytics chart, so
    // the three screens cannot disagree about what one order was worth.
    // The rate is passed because a WooCommerce order off the main site arrives
    // with its colón total only, and is converted here rather than counting $0.
    const revenue = orders
      .filter((o) => orderCountsAsSale(o) && inRange(getRevenueDate(o)))
      .reduce((sum, o) => sum + orderNetRevenueUsd(o, exchangeRate), 0);

    const recoverableCarts = abandonedCarts.filter(
      (c) => (c.status === 'active' || !c.status) && inRange(new Date(c.created_at))
    );
    const recoverableValue = recoverableCarts.reduce((s, c) => s + cartValue(c), 0);

    // The lists below are not KPI tiles and keep their own windows on purpose.
    const hotLeads = leads
      .filter((l) => (l.status || 'New') === 'New' || !l.contacted)
      .slice(0, 5);

    const stockAlerts = products.filter((p) => isOutOfStock(p.status) || isComingSoon(p.status));

    const recentOrders = [...orders]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 6);

    return {
      pendingOrders,
      revenue,
      recoverableCarts,
      recoverableValue,
      hotLeads,
      stockAlerts,
      recentOrders,
    };
  }, [orders, abandonedCarts, leads, products, exchangeRate, kpiRangeStart, kpiRangeEnd, customIncomplete]);

  // What actually made each tile. Deliberately wider than the tile itself: it
  // carries the orders inside the window that are NOT counting too, since the
  // point is to be able to force one in as well as hold one out.
  const breakdowns = useMemo(() => {
    const inRange = (date) => {
      if (customIncomplete) return false;
      if (kpiRangeStart && date < kpiRangeStart) return false;
      if (kpiRangeEnd && date >= kpiRangeEnd) return false;
      return true;
    };

    return {
      revenue: orders
        .filter((order) => inRange(getRevenueDate(order)))
        .map((order) => ({
          id: order.id,
          orderNumber: order.order_number,
          customer: order.customer_name,
          // Two different dates, so each is labelled: revenue lands on the day the
          // order first became Paid/complete, while the Orders list shows when it
          // came in. An order placed on the 22nd and paid today belongs in today.
          date: getRevenueDate(order),
          countedLabel: orderCountsAsSale(order) ? 'Counted' : 'Would count',
          placedAt: new Date(order.created_at),
          amountUsd: orderNetRevenueUsd(order, exchangeRate) || orderGrossUsd(order, exchangeRate),
          basis: orderRevenueBasis(order),
        }))
        // Counting orders first, then newest, so the money is at the top.
        .sort((a, b) => Number(b.basis.counts) - Number(a.basis.counts) || b.date - a.date),
      pendingOrders: orders
        .filter((order) => isAwaitingPayment(order.status) && inRange(new Date(order.created_at)))
        .map((order) => ({
          id: order.id,
          orderNumber: order.order_number,
          customer: order.customer_name,
          // This tile is about orders waiting, so its date is when they came in,
          // the same date the Orders list shows, and there is no second one.
          date: new Date(order.created_at),
          countedLabel: 'Placed',
          placedAt: null,
          amountUsd: orderGrossUsd(order, exchangeRate),
          basis: orderRevenueBasis(order),
        }))
        .sort((a, b) => b.date - a.date),
    };
  }, [orders, exchangeRate, kpiRangeStart, kpiRangeEnd, customIncomplete]);

  // The window is named in the heading so a breakdown opened from a tile cannot
  // be read as the whole picture.
  const TILE_TITLES = {
    revenue: `Revenue, ${kpiRangeLabel.toLowerCase()}`,
    pendingOrders: `Pending Orders, ${kpiRangeLabel.toLowerCase()}`,
  };
  const TILE_SUBTITLES = {
    revenue: 'Orders dated by when they were first marked paid or complete, not when they were created.',
    pendingOrders: 'Orders still waiting to be paid, newest first, dated by when they came in. None of these count as revenue.',
  };

  const applyOverrides = async (changes, reason) => {
    if (!onOverrideStats) throw new Error('Changing the figures is not available here.');
    await onOverrideStats(changes, reason);
  };

  // Read from the same saved setting and accepted-invitation history that the
  // Social Reviews screen uses. Completed-order counts were only a guess and
  // the old hardcoded 50 stayed wrong after a plan change.
  const trustpilotCap = Number(trustpilotStatus?.trustpilotCap);
  const trustpilotUsed = Number(trustpilotStatus?.trustpilotThisMonth);
  const trustpilotReady = Number.isFinite(trustpilotCap) && Number.isFinite(trustpilotUsed);
  const trustpilotRemaining = trustpilotReady ? Math.max(0, trustpilotCap - trustpilotUsed) : null;
  const trustpilotPaused = trustpilotReady && trustpilotCap === 0;
  const trustpilotColor = !trustpilotReady || trustpilotPaused
    ? '#94a3b8'
    : trustpilotRemaining === 0 ? '#f87171' : trustpilotRemaining <= 10 ? '#fbbf24' : '#34d399';

  const attention = [
    stats.pendingOrders.length > 0 && {
      key: 'pending',
      icon: ClipboardList,
      color: '#f59e0b',
      title: `${stats.pendingOrders.length} pending order${stats.pendingOrders.length > 1 ? 's' : ''}`,
      sub: 'Need confirmation or payment',
      action: 'Open orders',
      // The card counts strictly Pending, so the queue it opens is filtered to
      // match. Landing on the unfiltered list made the number look wrong.
      navOptions: { orderStatus: 'group:needs_payment' },
      tab: 'orders',
    },
    stats.recoverableCarts.length > 0 && {
      key: 'carts',
      icon: ShoppingCart,
      color: '#34d399',
      title: `${stats.recoverableCarts.length} abandoned cart${stats.recoverableCarts.length > 1 ? 's' : ''}`,
      sub: `~$${Math.round(stats.recoverableValue)} recoverable`,
      action: 'Recover carts',
      tab: 'carts',
    },
    inquiryCount > 0 && {
      key: 'inquiries',
      icon: Inbox,
      color: '#c084fc',
      title: `${inquiryCount} new inquir${inquiryCount > 1 ? 'ies' : 'y'}`,
      sub: 'Contact form messages',
      action: 'Reply now',
      tab: 'inquiries',
    },
    stats.hotLeads.length > 0 && {
      key: 'leads',
      icon: Target,
      color: '#4ade80',
      title: `${stats.hotLeads.length} hot lead${stats.hotLeads.length > 1 ? 's' : ''}`,
      sub: 'Not yet contacted',
      action: 'Follow up',
      tab: 'leads',
    },
    stats.stockAlerts.length > 0 && {
      key: 'stock',
      icon: AlertTriangle,
      color: '#f87171',
      title: `${stats.stockAlerts.length} stock alert${stats.stockAlerts.length > 1 ? 's' : ''}`,
      sub: 'Out of stock or coming soon',
      action: 'Fix stock',
      tab: 'spreadsheet',
    },
  ].filter(Boolean);

  return (
    <div className="dashboard-home">
      <div className="dashboard-home-header">
        <div>
          <h2 className="dashboard-home-title">Today</h2>
          <p className="dashboard-home-subtitle">
            {/* The day the tiles below are counting, which is Costa Rica's — an
                admin 11 hours ahead would otherwise be shown tomorrow's date
                over today's figures. */}
            {formatCrDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' })} (Costa Rica)
          </p>
        </div>
        <button type="button" className="admin-btn admin-btn-primary dashboard-manual-order-btn" onClick={onCreateOrder}>
          + Manual Order
        </button>
      </div>

      {/* A hand-set rate never updates itself, so it is named here every day
          it stays on rather than being forgotten. */}
      {manualExchangeRate && (
        <div
          role="status"
          style={{
            margin: '0 0 16px', padding: '10px 14px', borderRadius: '10px',
            border: '1px solid rgba(251, 191, 36, 0.4)', background: 'rgba(251, 191, 36, 0.08)',
            color: '#fde68a', fontSize: '0.85rem', display: 'flex', flexWrap: 'wrap',
            gap: '8px', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <span>
            <strong>Manual exchange rate in use:</strong> $1 = ${Number(manualExchangeRate.rate).toLocaleString('en-US', { maximumFractionDigits: 2 })}
            {manualExchangeRate.setBy ? `, set by ${manualExchangeRate.setBy}` : ''}
            {manualExchangeRate.setAt ? ` on ${formatCrInstant(manualExchangeRate.setAt)}` : ''}.
            {' '}The automatic market rate is being ignored.
          </span>
          {isSuperadmin && (
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => document.getElementById('exchange-rate-settings')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            >
              Change
            </button>
          )}
        </div>
      )}

      <section className="dashboard-section dashboard-next-actions">
        <div className="dashboard-section-heading-row">
          <h3 className="dashboard-section-title">Next Actions</h3>
          <span className="dashboard-section-count">{attention.length || 'Clear'}</span>
        </div>
        {attention.length > 0 ? (
          <div className="dashboard-attention-list">
            {attention.map((item) => (
              <button
                key={item.key}
                type="button"
                className="dashboard-attention-item"
                onClick={() => onNavigate(item.tab, null, item.navOptions)}
              >
                <span className="dashboard-attention-icon" style={{ background: `${item.color}1f`, color: item.color }}>
                  <item.icon size={20} />
                </span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div className="dashboard-attention-title">{item.title}</div>
                  <div className="dashboard-attention-sub">{item.sub}</div>
                </div>
                <span className="dashboard-attention-action">
                  {item.action}
                  <ChevronRight size={15} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="dashboard-empty-card">
            <CheckCircleFallback />
            <div>
              <div className="dashboard-empty-title">No urgent work waiting</div>
              <div className="dashboard-empty-copy">Orders, carts, inquiries, leads, and stock alerts are clear.</div>
            </div>
          </div>
        )}
      </section>

      {/* One window over every tile below it. Hovering the dropdown spells the
          dates out, because "this week" alone does not say whose week. Custom
          adds From/To so any Costa Rica day span can drive the same row. */}
      <div className="dashboard-kpi-rangebar">
        <span className="dashboard-kpi-rangebar-label">Showing</span>
        <select
          className="dashboard-kpi-range"
          aria-label="Date range for the figures below"
          title={kpiRangeHint}
          value={kpiRange}
          onChange={(event) => selectKpiRange(event.target.value)}
        >
          {KPI_RANGES.map((range) => (
            <option key={range.id} value={range.id}>{range.label}</option>
          ))}
        </select>
      </div>
      {kpiRange === 'custom' && (
        <div className="dashboard-kpi-custom-range">
          <label>
            <span>From</span>
            <input
              type="date"
              value={customStart}
              max={customEnd || undefined}
              onChange={(e) => setCustomStart(e.target.value)}
            />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              value={customEnd}
              min={customStart || undefined}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </label>
          {customIncomplete && (
            <span className="dashboard-kpi-custom-hint">Pick both dates to load this range.</span>
          )}
        </div>
      )}

      <div className="dashboard-kpi-grid">
        <button
          type="button"
          className="dashboard-kpi-card is-clickable"
          onClick={() => setOpenTile('pendingOrders')}
          title={kpiRangeHint}
        >
          <div className="dashboard-kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <ClipboardList size={20} />
          </div>
          <div>
            <div className="dashboard-kpi-value">{stats.pendingOrders.length}</div>
            <div className="dashboard-kpi-label">Pending Orders</div>
          </div>
        </button>
        <button
          type="button"
          className="dashboard-kpi-card is-clickable"
          onClick={() => setOpenTile('revenue')}
          title={kpiRangeHint}
        >
          <div className="dashboard-kpi-icon" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }}>
            <DollarSign size={20} />
          </div>
          <div>
            <div className="dashboard-kpi-value">${stats.revenue.toLocaleString()}</div>
            <div className="dashboard-kpi-label">Revenue</div>
          </div>
        </button>
        <div className="dashboard-kpi-card" title={kpiRangeHint}>
          <div className="dashboard-kpi-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
            <ShoppingCart size={20} />
          </div>
          <div>
            <div className="dashboard-kpi-value">${Math.round(stats.recoverableValue).toLocaleString()}</div>
            <div className="dashboard-kpi-label">Recoverable Carts</div>
          </div>
        </div>
      </div>

      {/* Expanded Sales & Inventory Analytics Grid */}
      <section className="dashboard-section" style={{ marginTop: '24px' }}>
        <div className="dashboard-section-heading-row">
          <h3 className="dashboard-section-title">Sales &amp; Inventory Overview</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div className="dashboard-kpi-card">
            <div className="dashboard-kpi-icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#34d399' }}>
              <DollarSign size={20} />
            </div>
            <div>
              <div className="dashboard-kpi-value">${expandedMetrics.revenueTodayUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
              <div className="dashboard-kpi-label">Revenue Today (${expandedMetrics.revenueTodayCrc.toLocaleString()})</div>
            </div>
          </div>

          <div className="dashboard-kpi-card">
            <div className="dashboard-kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
              <DollarSign size={20} />
            </div>
            <div>
              <div className="dashboard-kpi-value">${expandedMetrics.revenueMonthUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
              <div className="dashboard-kpi-label">Revenue This Month ({expandedMetrics.ordersMonthCount} orders)</div>
            </div>
          </div>

          <div className="dashboard-kpi-card">
            <div className="dashboard-kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
              <Target size={20} />
            </div>
            <div>
              <div className="dashboard-kpi-value">{expandedMetrics.repeatCustomerPct}%</div>
              <div className="dashboard-kpi-label">Repeat Customer Rate ({expandedMetrics.repeatCustomers}/{expandedMetrics.totalCustomers})</div>
            </div>
          </div>

          <div className="dashboard-kpi-card">
            <div className="dashboard-kpi-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
              <Package size={20} />
            </div>
            <div>
              <div className="dashboard-kpi-value">${expandedMetrics.aovUsd.toFixed(2)}</div>
              <div className="dashboard-kpi-label">Avg Order Value (AOV)</div>
            </div>
          </div>

          <div className="dashboard-kpi-card">
            <div className="dashboard-kpi-icon" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6' }}>
              <Star size={20} />
            </div>
            <div>
              <div className="dashboard-kpi-value">${expandedMetrics.ltvUsd.toFixed(2)}</div>
              <div className="dashboard-kpi-label">Customer Lifetime Value (LTV)</div>
            </div>
          </div>

          <div className="dashboard-kpi-card">
            <div className="dashboard-kpi-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
              <Package size={20} />
            </div>
            <div>
              <div className="dashboard-kpi-value">${expandedMetrics.inventoryCostValueUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
              <div className="dashboard-kpi-label">Inventory Cost (Retail: ${expandedMetrics.inventoryRetailValueUsd.toLocaleString()})</div>
            </div>
          </div>
        </div>

        {expandedMetrics.bestSellers.length > 0 && (
          <div style={{ background: 'rgba(15, 23, 42, 0.5)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#cbd5e1', fontWeight: 700 }}>🏆 Top Selling Products</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              {expandedMetrics.bestSellers.slice(0, 4).map((item, idx) => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: idx === 0 ? '#fbbf24' : idx === 1 ? '#cbd5e1' : '#cd7f32' }}>#{idx + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.unitsSold.toLocaleString()} paid units · ${item.revenueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="dashboard-section dashboard-health-section">
        <div className="dashboard-section-heading-row">
          <h3 className="dashboard-section-title">Health</h3>
        </div>
        <div className="dashboard-health-card" title={trustpilotReady ? `${trustpilotUsed} of ${trustpilotCap} recorded Trustpilot invitations used this month.` : 'Trustpilot invitation history is unavailable.'}>
          <div className="dashboard-kpi-icon" style={{ background: 'rgba(52, 211, 153, 0.15)', color: trustpilotColor }}>
            <Star size={20} />
          </div>
          <div>
            <div className="dashboard-health-title" style={{ color: trustpilotColor }}>
              {!trustpilotReady
                ? 'Trustpilot status unavailable'
                : trustpilotPaused
                  ? 'Trustpilot invitations paused'
                  : `${trustpilotRemaining} Trustpilot invites left`}
            </div>
            <div className="dashboard-health-copy">
              {trustpilotReady
                ? `Recorded ${trustpilotUsed}/${trustpilotCap} this month. Limit comes from Social Reviews settings.`
                : 'Open Reviews → Social Reviews to check the history and settings.'}
            </div>
          </div>
        </div>
      </section>

      {/* One authority for every USD -> CRC conversion. The editor belongs on
          Home where the owner sees shop health, not inside product editing.
          It is mounted only for superadmins; the route repeats that check. */}
      {isSuperadmin && (
        <ExchangeRateSettings onChanged={onExchangeRateChanged} />
      )}

      <div className="dashboard-two-col">
        <section className="dashboard-section">
          <h3 className="dashboard-section-title">Recent Orders</h3>
          {stats.recentOrders.length === 0 ? (
            <p className="dashboard-empty">No orders yet.</p>
          ) : (
            <div className="dashboard-mini-list">
              {stats.recentOrders.map((o) => {
                const _oItems = Array.isArray(o.items) ? o.items : [];
                const _oStored = o.currency === 'USD' ? Number(o.total_usd || 0) : Number(o.total_crc || 0);
                const _oDisplay = _oStored;
                return (
                <button
                  key={o.id}
                  type="button"
                  className="dashboard-mini-row"
                  onClick={() => onOpenOrder(o)}
                >
                  <div>
                    <div className="dashboard-mini-title">#{o.order_number || o.id.slice(0, 8)}</div>
                    <div className="dashboard-mini-sub">{o.customer_name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="dashboard-mini-val">
                      {o.currency === 'CRC' ? `$${Math.round(_oDisplay).toLocaleString()}` : `$${_oDisplay.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
                    </div>
                    <div className="dashboard-mini-sub">{o.status || 'Pending'}</div>
                  </div>
                </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="dashboard-section">
          <h3 className="dashboard-section-title">Stock Alerts</h3>
          {stats.stockAlerts.length === 0 ? (
            <p className="dashboard-empty">All products in stock.</p>
          ) : (
            <div className="dashboard-mini-list">
              {stats.stockAlerts.slice(0, 8).map((p) => (
                <button
                  key={p.id || p.product}
                  type="button"
                  className="dashboard-mini-row"
                  onClick={() => onNavigate('spreadsheet')}
                >
                  <Package size={16} style={{ color: isOutOfStock(p.status) ? '#f87171' : '#fbbf24' }} />
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div className="dashboard-mini-title">{p.product}</div>
                    <div className="dashboard-mini-sub">{p.status}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {stats.hotLeads.length > 0 && (
        <section className="dashboard-section">
          <h3 className="dashboard-section-title">Hot Leads</h3>
          <div className="dashboard-mini-list">
            {stats.hotLeads.map((l) => (
              <button
                key={l.id}
                type="button"
                className="dashboard-mini-row"
                onClick={() => onNavigate('leads')}
              >
                <Target size={16} style={{ color: '#4ade80' }} />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div className="dashboard-mini-title">{l.name || l.email || l.phone || 'Lead'}</div>
                  <div className="dashboard-mini-sub">{l.phone || l.email || 'No contact'}</div>
                </div>
                <MessageSquare size={14} style={{ color: '#64748b' }} />
              </button>
            ))}
          </div>
        </section>
      )}

      <KpiBreakdownModal
        open={Boolean(openTile)}
        title={TILE_TITLES[openTile] || ''}
        subtitle={TILE_SUBTITLES[openTile] || ''}
        rows={openTile ? (breakdowns[openTile] || []) : []}
        canEdit={isSuperadmin && Boolean(onOverrideStats)}
        onClose={() => setOpenTile(null)}
        onApply={applyOverrides}
      />
    </div>
  );
}

function CheckCircleFallback() {
  return (
    <span className="dashboard-empty-icon" aria-hidden="true">
      <CheckCircle size={18} />
    </span>
  );
}
