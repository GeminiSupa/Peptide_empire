/**
 * Expanded Sales Analytics & Inventory Valuation Module
 */

import { orderCountsAsSale, orderNetRevenue } from './orderRevenue.mjs';

/**
 * Check if order is successful / paid / completed for revenue analytics
 */
export function isPaidOrder(order) {
  return orderCountsAsSale(order);
}

/**
 * Extract items from order
 */
function extractOrderItems(order) {
  if (!order || !order.items) return [];
  if (Array.isArray(order.items)) return order.items;
  if (typeof order.items === 'string') {
    try {
      const parsed = JSON.parse(order.items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function numericMoney(value) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

/**
 * Item prices written by checkout use the order currency in the generic
 * `price` field. Prefer an explicitly named USD/CRC field when one exists,
 * then interpret the generic field using the order's currency.
 */
function itemUnitPriceUsd(item, order, exchangeRate) {
  const rate = Number.isFinite(Number(exchangeRate)) && Number(exchangeRate) > 0
    ? Number(exchangeRate)
    : 454.48;
  const explicitUsd = numericMoney(item?.price_usd ?? item?.priceUsd);
  if (explicitUsd > 0) return explicitUsd;

  const explicitCrc = numericMoney(item?.price_crc ?? item?.priceCrc);
  if (explicitCrc > 0) return explicitCrc / rate;

  const price = numericMoney(item?.price);
  return String(order?.currency || 'USD').trim().toUpperCase() === 'CRC'
    ? price / rate
    : price;
}

/**
 * Compute expanded sales dashboard metrics
 */
export function calculateExpandedSalesMetrics(orders = [], products = [], exchangeRate = 454.48, referenceDate = new Date()) {
  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth();
  const nowDateStr = now.toISOString().split('T')[0];

  const paidOrders = orders.filter(isPaidOrder);

  let revenueTodayUsd = 0;
  let revenueTodayCrc = 0;
  let ordersTodayCount = 0;

  let revenueMonthUsd = 0;
  let revenueMonthCrc = 0;
  let ordersMonthCount = 0;

  let totalRevenueUsd = 0;
  let totalRevenueCrc = 0;

  const productSalesMap = {};
  const customerOrdersMap = {};

  paidOrders.forEach((o) => {
    const net = orderNetRevenue(o, exchangeRate);
    totalRevenueUsd += net.usd;
    totalRevenueCrc += net.crc;

    const ordDate = new Date(o.created_at || Date.now());
    const ordYear = ordDate.getUTCFullYear();
    const ordMonth = ordDate.getUTCMonth();
    const ordDateStr = ordDate.toISOString().split('T')[0];

    // Today
    if (ordDateStr === nowDateStr) {
      revenueTodayUsd += net.usd;
      revenueTodayCrc += net.crc;
      ordersTodayCount += 1;
    }

    // This Month
    if (ordYear === nowYear && ordMonth === nowMonth) {
      revenueMonthUsd += net.usd;
      revenueMonthCrc += net.crc;
      ordersMonthCount += 1;
    }

    // Group by customer for LTV & Repeat Customer %
    const custKey = (o.customer_email || '').toLowerCase().trim() ||
                    (o.customer_phone || '').replace(/\D/g, '') ||
                    (o.customer_name || '').toLowerCase().trim() || 'unknown';

    if (custKey !== 'unknown') {
      if (!customerOrdersMap[custKey]) {
        customerOrdersMap[custKey] = { count: 0, totalSpentUsd: 0 };
      }
      customerOrdersMap[custKey].count += 1;
      customerOrdersMap[custKey].totalSpentUsd += net.usd;
    }

    // Best Sellers Breakdown
    const items = extractOrderItems(o);
    items.forEach((item) => {
      const productName = String(item.product || item.name || 'Peptides').trim();
      const qty = Math.max(0, Number(item.quantity ?? item.qty ?? 1) || 0);
      const priceUsd = itemUnitPriceUsd(item, o, exchangeRate);

      // Giveaways are fulfilled units, not sold units. Including them made
      // complimentary BAC water the dashboard's #1 "selling" product.
      if (qty <= 0 || priceUsd <= 0) return;

      if (!productSalesMap[productName]) {
        productSalesMap[productName] = { name: productName, unitsSold: 0, revenueUsd: 0, orderCount: 0 };
      }
      productSalesMap[productName].unitsSold += qty;
      productSalesMap[productName].revenueUsd += priceUsd * qty;
      productSalesMap[productName].orderCount += 1;
    });
  });

  // Best Sellers Ranking
  const bestSellers = Object.values(productSalesMap)
    .map((item) => ({ ...item, revenueUsd: Math.round(item.revenueUsd * 100) / 100 }))
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenueUsd - a.revenueUsd);

  // Customer Metrics
  const totalCustomers = Object.keys(customerOrdersMap).length;
  const repeatCustomers = Object.values(customerOrdersMap).filter((c) => c.count >= 2).length;
  const repeatCustomerPct = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;

  // Average Order Value (AOV)
  const aovUsd = paidOrders.length > 0 ? Math.round((totalRevenueUsd / paidOrders.length) * 100) / 100 : 0;
  const aovCrc = Math.round(aovUsd * exchangeRate);

  // Customer Lifetime Value (LTV)
  const ltvUsd = totalCustomers > 0 ? Math.round((totalRevenueUsd / totalCustomers) * 100) / 100 : 0;
  const ltvCrc = Math.round(ltvUsd * exchangeRate);

  // Inventory Total Value (Cost & Retail)
  let totalTrackedVials = 0;
  let inventoryCostValueUsd = 0;
  let inventoryRetailValueUsd = 0;

  products.forEach((p) => {
    const stock = Number(p.inventoryCount || p.inventory_count);
    if (Number.isFinite(stock) && stock > 0) {
      const price = parseFloat(String(p.priceUsd || p.price_usd || '0').replace(/[^0-9.]/g, '')) || 0;
      const cost = parseFloat(String(p.costUsd || p.cost_usd || '0').replace(/[^0-9.]/g, '')) || 0;

      totalTrackedVials += stock;
      inventoryCostValueUsd += stock * cost;
      inventoryRetailValueUsd += stock * price;
    }
  });

  const inventoryCostValueCrc = Math.round(inventoryCostValueUsd * exchangeRate);
  const inventoryRetailValueCrc = Math.round(inventoryRetailValueUsd * exchangeRate);

  return {
    revenueTodayUsd,
    revenueTodayCrc,
    ordersTodayCount,

    revenueMonthUsd,
    revenueMonthCrc,
    ordersMonthCount,

    totalRevenueUsd,
    totalRevenueCrc,
    paidOrdersCount: paidOrders.length,

    bestSellers,

    totalCustomers,
    repeatCustomers,
    repeatCustomerPct,

    aovUsd,
    aovCrc,

    ltvUsd,
    ltvCrc,

    totalTrackedVials,
    inventoryCostValueUsd,
    inventoryCostValueCrc,
    inventoryRetailValueUsd,
    inventoryRetailValueCrc,
  };
}
