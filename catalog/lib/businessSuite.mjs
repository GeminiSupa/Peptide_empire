// Copied from the catalog (src/lib/businessSuite.mjs) by scripts/sync-catalog-checkout.mjs. Do not edit.
import { isBacWater, isGiftLine } from './bacWater.mjs';
import { orderNetRevenueUsd, orderCountsAsSale } from './orderRevenue.mjs';
import { computeOrderCommissionAmounts } from './orderCommission.mjs';
import { getOrderSalesAmounts } from './commissionSalesAmounts.mjs';

export function normalizeBusinessItems(items, { prices = false } = {}) {
  if (!Array.isArray(items) || !items.length || items.length > 50) throw new Error('Choose between 1 and 50 product lines.');
  const seen = new Set();
  return items.map(item => {
    const product = String(item.product || '').trim();
    const qty = Number(item.qty);
    if (!product || product.length > 200 || seen.has(product.toLowerCase()) || isGiftLine(item) || !Number.isInteger(qty) || qty < 1 || qty > 100) throw new Error('Use unique products and quantities between 1 and 100.');
    seen.add(product.toLowerCase());
    const row = { product, qty };
    if (prices) {
      const value = Number(item.unit_price_usd);
      if (item.unit_price_usd === '' || item.unit_price_usd == null || !Number.isFinite(value) || value < 0 || value > 1000000 || isBacWater(product)) throw new Error('Quote prices must be valid USD amounts for merchandise.');
      row.unit_price_usd = Math.round(value * 100) / 100;
    }
    return row;
  });
}

export function canManageBusiness(business, email) {
  return business?.email === email || business?.member_role === 'manager';
}
export function mergeBusinessProductPrices(...sources){
  const prices=new Map();
  for(const row of sources.flat()){
    const key=String(row?.product || '').trim().toLowerCase();const value=Number(row?.unit_price_usd);
    if(!key||row.unit_price_usd==null||row.unit_price_usd===''||!Number.isFinite(value)||value<0)continue;
    if(!prices.has(key)||value<prices.get(key).unit_price_usd)prices.set(key,{product:row.product,unit_price_usd:value});
  }
  return [...prices.values()];
}

export function validateBusinessTerms(body) {
  const minimum_units = Number(body.minimum_units ?? 0);
  const minimum_order_usd = Number(body.minimum_order_usd ?? 0);
  const rep_commission_pct = Number(body.rep_commission_pct ?? 0);
  if (!Number.isInteger(minimum_units) || minimum_units < 0 || minimum_units > 5000) throw new Error('Minimum units must be between 0 and 5,000.');
  if (!Number.isFinite(minimum_order_usd) || minimum_order_usd < 0 || minimum_order_usd > 1000000) throw new Error('Enter a valid minimum order in USD.');
  if (!Number.isFinite(rep_commission_pct) || rep_commission_pct < 0 || rep_commission_pct > 100) throw new Error('Commission must be between 0 and 100 percent.');
  if(rep_commission_pct>0&&!body.rep_user_id)throw new Error('Assign a sales rep before setting a commission.');
  return { minimum_units, minimum_order_usd, rep_commission_pct, rep_user_id: body.rep_user_id || null };
}

export function businessMinimumError(business, pricing, items, rate) {
  if (business?.status !== 'approved') return null;
  const units = (items || []).filter(item => !isBacWater(item.product) && !isGiftLine(item)).reduce((sum,item) => sum + Number(item.qty || 0),0);
  const spend = (pricing.total - pricing.shipping) / (pricing.currency === 'CRC' ? rate : 1);
  if (units < Number(business.minimum_units || 0)) return `Business orders require at least ${business.minimum_units} merchandise units.`;
  if (spend + 0.005 < Number(business.minimum_order_usd || 0)) return `Business orders require at least US$${Number(business.minimum_order_usd).toFixed(2)} in products after discounts.`;
  return null;
}

export function validatedQuotePrices(quote, businessId, items, now = Date.now()) {
  if (!quote || quote.business_id !== businessId || quote.status !== 'approved' || !quote.expires_at || Date.parse(quote.expires_at) <= now || !Number.isFinite(Date.parse(quote.expires_at))) throw new Error('This quote is unavailable or expired.');
  const expected = normalizeBusinessItems(quote.items, { prices: true });
  const actual = normalizeBusinessItems((items || []).filter(item => !isGiftLine(item)));
  if (actual.length !== expected.length || expected.some(line => !actual.some(item => item.product.toLowerCase() === line.product.toLowerCase() && item.qty === line.qty))) throw new Error('The cart must match the approved quote exactly.');
  return expected;
}

export function businessSalesReport(businesses, orders, now = Date.now()) {
  const report = businesses.map(business => {
    const purchases = orders.filter(order => order.business_account_id === business.id && orderCountsAsSale(order));
    const latest = purchases.map(order => order.created_at).sort().at(-1) || null;
    const revenue_usd = Math.round(purchases.reduce((sum,order) => sum + orderNetRevenueUsd(order),0)*100)/100;
    return { id: business.id, legal_name: business.legal_name, status: business.status, rep_user_id: business.rep_user_id, orders: purchases.length, revenue_usd, last_order_at: latest, repeat_buyer: purchases.length > 1, needs_follow_up: business.status === 'approved' && (!latest || now-Date.parse(latest) >= 30*86400000) };
  });
  const repRows=new Map();
  for(const order of orders){
    const id=order.business_snapshot?.rep_user_id;
    if(!id||!orderCountsAsSale(order))continue;
    const row=repRows.get(id)||{rep_user_id:id,orders:0,revenue_usd:0,commission_usd:0};
    row.orders+=1;row.revenue_usd+=orderNetRevenueUsd(order);
    if(order.agent_commission_source==='business_account')row.commission_usd+=computeOrderCommissionAmounts(order,0,getOrderSalesAmounts).usdCommission;
    repRows.set(id,row);
  }
  const reps=[...repRows.values()].map(row=>({...row,revenue_usd:Math.round(row.revenue_usd*100)/100,commission_usd:Math.round(row.commission_usd*100)/100}));
  return { businesses: report, reps, totals: { accounts: report.length, active: report.filter(row => row.status==='approved').length, repeat_buyers: report.filter(row => row.repeat_buyer).length, revenue_usd: Math.round(report.reduce((sum,row)=>sum+row.revenue_usd,0)*100)/100 } };
}
