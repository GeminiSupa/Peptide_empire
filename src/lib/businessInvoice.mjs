import {paymentLabel} from './customerOrderView.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
export function businessInvoiceHtml(order) {
  const company=order.business_snapshot || {};
  const currency=order.currency==='USD'?'USD':'CRC';
  const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency}).format(Number(value || 0));
  const total=currency==='USD'?order.total_usd:order.total_crc;
  const shipping=currency==='USD'?order.shipping_cost_usd:order.shipping_cost_crc;
  const items=Array.isArray(order.items)?order.items:[];
  const subtotal=items.reduce((sum,item)=>sum+Number(item.qty || 0)*Number(item.price || 0),0);
  const discount=Math.max(0,subtotal+Number(shipping || 0)-Number(total || 0));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Order statement ${escape(order.order_number)}</title><style>body{font:15px system-ui,sans-serif;color:#142b24;max-width:840px;padding:36px;margin:auto}header{border-bottom:3px solid #126958;padding-bottom:20px}h1{font-size:27px}table{border-collapse:collapse;width:100%;margin:28px 0}th,td{padding:12px;text-align:left;border-bottom:1px solid #ddd}th:last-child,td:last-child{text-align:right}address{font-style:normal;white-space:pre-line}footer{font-size:12px;color:#52625b;margin-top:36px}.totals{margin-left:auto;width:300px}@media print{body{padding:0}}</style></head><body>
  <header><strong>PEPTIDES COSTA RICA</strong><h1>Estado de pedido / Commercial order statement</h1><p>${escape(order.order_number)} · ${escape(order.created_at)} · ${escape(paymentLabel(order,'es'))} / ${escape(paymentLabel(order,'en'))}</p></header>
  <h2>${escape(company.legal_name || order.customer_name)}</h2><p>${escape(company.trading_name)}<br>Cédula jurídica: ${escape(company.corporation_number)}<br>${escape(company.email)}</p><address>${escape(company.billing_address)}</address>
  <table><thead><tr><th>Producto / Product</th><th>Cantidad / Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${items.map(item=>`<tr><td>${escape(item.product)}</td><td>${escape(item.qty)}</td><td>${money(item.price)}</td><td>${money(Number(item.price || 0)*Number(item.qty || 0))}</td></tr>`).join('')}</tbody></table>
  <table class="totals"><tr><td>Subtotal</td><td>${money(subtotal)}</td></tr><tr><td>Discount / Descuento</td><td>−${money(discount)}</td></tr><tr><td>Shipping / Envío</td><td>${money(shipping)}</td></tr><tr><th>Total (${currency})</th><th>${money(total)}</th></tr></table>
  <footer>Documento comercial de su pedido. No sustituye una factura electrónica autorizada. / This commercial order record is not an electronic tax invoice. Payment status is shown above; this document does not by itself confirm payment.</footer></body></html>`;
}
