import { emailShell } from './accountSignInCode.mjs';
import { formatCrInstant } from './crTime.mjs';
import { businessFacingName } from './catalogCategories.mjs';
import { getOrderEmailLogoAttachment } from './orderEmailBranding.mjs';

// Every email a business receives from us, in the one language the business
// chose (business_accounts.preferred_language, Spanish until someone picks).
// They used to print Spanish and English side by side.

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const SITE = 'https://catalog.peptidescostarica.net';

// The person introduced in the welcome email. With name and photoUrl blank
// the email introduces "your business support team" instead.
export const BUSINESS_ACCOUNT_AGENT = {
  name: 'Korinne Dankers',
  photoUrl: `${SITE}/team/korinne-dankers.jpg`,
  whatsapp: '50672004080',
  phone: '+506 7200 4080',
};

// The photo travels inside the email, like the logo, so Outlook shows it
// without the reader having to allow downloaded pictures.
export const BUSINESS_AGENT_PHOTO_CID = 'business-agent@peptidescostarica';

/** Logo always; the agent photo only when the email actually shows it. */
export function businessEmailAttachments(html, agent = BUSINESS_ACCOUNT_AGENT) {
  const files = [getOrderEmailLogoAttachment()];
  const marker = String(html || '').match(/data-business-agent-photo="([^"]+)"/);
  let photoUrl = agent.photoUrl;
  if (marker) { try { photoUrl = decodeURIComponent(marker[1]); } catch { photoUrl = ''; } }
  if (photoUrl && String(html || '').includes(`cid:${BUSINESS_AGENT_PHOTO_CID}`)) {
    files.push({ filename: 'business-agent.jpg', path: photoUrl, cid: BUSINESS_AGENT_PHOTO_CID, contentDisposition: 'inline' });
  }
  return files;
}

export function businessEmailLang(business) {
  return business?.preferred_language === 'en' ? 'en' : 'es';
}

function siteOrigin(siteUrl) {
  try { return new URL(siteUrl).origin; } catch { return SITE; }
}

// Sign in first, then land on `path` in the business's language.
function signInLink(site, lang, path) {
  const target = `${path}${path.includes('?') ? '&' : '?'}lang=${lang}`;
  return `${site}/account/login?lang=${lang}&next=${encodeURIComponent(target)}`;
}

function pctLabel(value) {
  const pct = Number(value);
  if (!Number.isFinite(pct) || pct <= 0) return '';
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`;
}

const usd = value => `US$${Number(value || 0).toFixed(2)}`;
// "Lab S.A." already ends the sentence; do not print "S.A.."
const sentence = value => (/\.$/.test(String(value ?? '').trim()) ? String(value).trim() : `${String(value ?? '').trim()}.`);

function button(href, label, color) {
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
  <tr><td align="center" bgcolor="${color}" style="background:${color};border-radius:12px;">
    <a href="${escape(href)}" style="display:inline-block;padding:15px 28px;font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:12px;">${escape(label)}</a>
  </td></tr>
</table>`;
}

const heading = text => `<h2 style="margin:30px 0 12px;font-size:17px;font-weight:800;color:#0f172a;">${escape(text)}</h2>`;
const paragraph = (text, style = '') => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;${style}">${escape(text)}</p>`;

function detailTable(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:12px;">
  ${rows.map(([label, value], index) => {
    const line = index ? 'border-top:1px solid #e2e8f0;' : '';
    return `<tr><td width="38%" style="${line}padding:10px 14px;font-size:13px;color:#64748b;vertical-align:top;">${escape(label)}</td><td style="${line}padding:10px 14px;font-size:14px;font-weight:600;color:#0f172a;vertical-align:top;">${escape(value).replace(/\r?\n/g, '<br>')}</td></tr>`;
  }).join('')}
</table>`;
}

function companyRows(business, t) {
  return [
    [t('Business name', 'Razón social'), business.legal_name],
    [t('Cédula jurídica', 'Cédula jurídica'), business.corporation_number],
    [t('Contact person', 'Persona de contacto'), business.contact_name],
    [t('Phone', 'Teléfono'), business.phone],
    [t('Login email', 'Correo de acceso'), business.email],
    [t('Billing address', 'Dirección de facturación'), business.billing_address],
    [t('Shipping address', 'Dirección de envío'), business.delivery_address || t('Same as billing address', 'Igual a la dirección de facturación')],
  ].map(([label, value]) => [label, String(value ?? '').trim() || '—']);
}

function companyText(rows) {
  return rows.map(([label, value]) => `${label}: ${value}`).join('\n');
}

function whatsappLink(agent, text) {
  return `https://api.whatsapp.com/send?phone=${agent.whatsapp}&text=${encodeURIComponent(text)}`;
}

/** Sent when an application arrives, and as the welcome once it is approved. */
export function buildBusinessAccountEmail(business, siteUrl = SITE, { application = false, agent = BUSINESS_ACCOUNT_AGENT } = {}) {
  return application
    ? buildApplicationEmail(business, siteOrigin(siteUrl))
    : buildWelcomeEmail(business, siteOrigin(siteUrl), agent);
}

function buildApplicationEmail(business, site) {
  const lang = businessEmailLang(business);
  const en = lang === 'en';
  const t = (english, spanish) => (en ? english : spanish);
  const rows = companyRows(business, t);
  const accountUrl = signInLink(site, lang, '/account/business');
  const hello = t(`Hello ${business.contact_name},`, `Hola ${business.contact_name},`);
  const intro = t(
    'Thank you for applying for a Peptidos Colombia business account. Our team will review your company details and email you as soon as your account is approved. Business pricing becomes available after approval.',
    'Gracias por solicitar una cuenta empresarial de Peptidos Colombia. Nuestro equipo revisará los datos de su empresa y le escribirá en cuanto su cuenta esté aprobada. Los precios empresariales se activan después de la aprobación.',
  );
  const subject = t('We received your business application', 'Recibimos su solicitud empresarial');
  const text = [hello, '', intro, '', t('What you sent us', 'Los datos que nos envió'), companyText(rows), '', accountUrl, '', 'Peptidos Colombia'].join('\n');
  const html = emailShell({
    lang, width: 600,
    title: subject,
    subtitle: t('Our team is reviewing your business details.', 'Nuestro equipo está revisando los datos de su empresa.'),
    body: `
      ${paragraph(hello, 'font-weight:700;color:#0f172a;')}
      ${paragraph(intro)}
      ${heading(t('What you sent us', 'Los datos que nos envió'))}
      ${detailTable(rows)}
      ${paragraph(t('Something wrong? Reply to this email and we will correct it.', '¿Algo no está bien? Responda este correo y lo corregimos.'), 'margin-top:12px;font-size:13px;color:#64748b;')}
      <div style="height:12px;line-height:12px;">&nbsp;</div>
      ${button(accountUrl, t('Check my application', 'Ver mi solicitud'), '#0f172a')}`,
  });
  return { subject, text, html };
}

function buildWelcomeEmail(business, site, agent) {
  const lang = businessEmailLang(business);
  const en = lang === 'en';
  const t = (english, spanish) => (en ? english : spanish);
  const name = business.legal_name;
  const pct = pctLabel(business.discount_pct);
  const units = Math.max(0, Math.trunc(Number(business.minimum_units) || 0));
  const minimumUsd = Math.max(0, Number(business.minimum_order_usd) || 0);
  const shopUrl = signInLink(site, lang, '/catalog');
  const accountUrl = signInLink(site, lang, '/account/business');
  const rows = companyRows(business, t);

  // "No minimum" is only said when it is true. Staff can set minimums per
  // business, and the email must not promise what checkout then refuses.
  const minimumHeadline = !units && !minimumUsd
    ? t('No Minimum Order Quantity or Purchase Amount Required', 'Sin cantidad mínima ni monto mínimo de compra')
    : [
      units ? t(`Minimum order: ${units} units`, `Pedido mínimo: ${units} unidades`) : t('No minimum quantity', 'Sin cantidad mínima'),
      minimumUsd ? t(`Minimum purchase: ${usd(minimumUsd)}`, `Compra mínima: ${usd(minimumUsd)}`) : t('No minimum amount', 'Sin monto mínimo'),
    ].join(' · ');

  const benefits = [
    [t('Exclusive pricing', 'Precios exclusivos'), pct
      ? t(`${pct} discount on eligible products`, `${pct} de descuento en productos elegibles`)
      : t('Business prices agreed with our team', 'Precios empresariales acordados con nuestro equipo')],
    units
      ? [t('Order quantity', 'Cantidad por pedido'), t(`Orders start at ${units} units`, `Los pedidos inician desde ${units} unidades`)]
      : [t('No minimum order quantity', 'Sin cantidad mínima'), t('Start with just one product', 'Empiece con un solo producto')],
    minimumUsd
      ? [t('Purchase amount', 'Monto de compra'), t(`Orders start at ${usd(minimumUsd)} in products`, `Los pedidos inician desde ${usd(minimumUsd)} en productos`)]
      : [t('No minimum purchase amount', 'Sin monto mínimo de compra'), t('Buy what you need, when you need it', 'Compre lo que necesite, cuando lo necesite')],
    [t('Growth opportunities', 'Oportunidades de crecimiento'), t('Additional discounts as your purchasing volume grows', 'Descuentos adicionales a medida que crece su volumen de compra')],
    [t('Executive customer support', 'Soporte ejecutivo'), t('Dedicated assistance with your business orders', 'Atención dedicada para los pedidos de su empresa')],
  ];

  const steps = [
    t('Tap “Access Your Business Account” below.', 'Toque “Acceder a su cuenta empresarial” abajo.'),
    t(`Enter ${business.email} and type the code we email you.`, `Escriba ${business.email} y el código que le enviamos por correo.`),
    t('Open the catalog and add products to your cart. Your business price is applied automatically at checkout while you are signed in.', 'Abra el catálogo y agregue productos al carrito. Su precio empresarial se aplica automáticamente al pagar con su sesión iniciada.'),
  ];

  const agentHeading = agent.name
    ? t(`Meet ${agent.name}, your account manager`, `Conozca a ${agent.name}, su ejecutivo de cuenta`)
    : t('Meet your business support team', 'Conozca a su equipo de soporte empresarial');
  const agentFirst = String(agent.name || '').split(/\s+/)[0];
  const agentText = !agent.whatsapp
    ? t('Reply to this email for help with orders, pricing and your business account.', 'Responda este correo para recibir ayuda con pedidos, precios y su cuenta empresarial.')
    : agent.name
    ? t(`${agentFirst} is your direct contact for orders, pricing and anything your business needs. Message ${agentFirst} any time on WhatsApp.`, `${agentFirst} es su contacto directo para pedidos, precios y todo lo que su empresa necesite. Escríbale a ${agentFirst} por WhatsApp cuando guste.`)
    : t('Your direct contact for orders, pricing and anything your business needs. Message us any time on WhatsApp.', 'Su contacto directo para pedidos, precios y todo lo que su empresa necesite. Escríbanos cuando quiera por WhatsApp.');
  const chatUrl = agent.whatsapp ? whatsappLink(agent, t(`Hi, I'm with ${sentence(name)} Our business account was just approved.`, `Hola, le escribo de ${sentence(name)} Nuestra cuenta empresarial acaba de ser aprobada.`)) : '';

  const subject = t('Your Business Account Is Approved!', '¡Su cuenta empresarial está aprobada!');
  const hello = t(`Hello ${name},`, `Hola ${name},`);
  const congrats = t('Congratulations! Your Peptidos Colombia business account has been approved.', '¡Felicidades! Su cuenta empresarial de Peptidos Colombia ha sido aprobada.');
  const access = t('You now have access to exclusive business pricing and special purchasing benefits.', 'Ahora tiene acceso a precios empresariales exclusivos y beneficios especiales de compra.');
  const terms = t('Offers do not stack; the best available price applies. Excludes BAC water and shipping.', 'Las ofertas no se acumulan; aplicamos el mejor precio disponible. Excluye agua BAC y envío.');
  const closing = t("We're excited to support your business and look forward to building a long-term partnership.", 'Nos alegra apoyar a su empresa y esperamos construir una relación a largo plazo.');
  const signature = t('Business Accounts Team', 'Equipo de Cuentas Empresariales');

  const text = [
    hello, '', congrats, access, '',
    pct ? t(`${pct} OFF eligible products`, `${pct} de descuento en productos elegibles`) : '',
    minimumHeadline, '',
    t('Your Business Account Benefits', 'Beneficios de su cuenta empresarial'),
    ...benefits.map(([title, detail]) => `- ${title}: ${detail}`), '',
    terms, '',
    t('Ready to place your first order?', '¿Listo para su primer pedido?'),
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    accountUrl, '',
    t('Your account details', 'Datos de su cuenta'),
    companyText(rows), '',
    agentHeading, agentText, ...(agent.phone ? [`WhatsApp: ${agent.phone}`] : []), chatUrl, '',
    closing, '', t('Best regards,', 'Saludos cordiales,'), 'Peptidos Colombia', signature,
  ].filter(line => line !== null).join('\n');

  const benefitRows = benefits.map(([title, detail]) => `<tr>
    <td width="34" style="padding:8px 0;vertical-align:top;"><div style="width:24px;height:24px;line-height:24px;border-radius:12px;background:#dcfce7;color:#15803d;font-size:14px;font-weight:800;text-align:center;">&#10003;</div></td>
    <td style="padding:8px 0;vertical-align:top;font-size:15px;line-height:1.5;color:#334155;"><strong style="color:#0f172a;">${escape(title)}</strong><br>${escape(detail)}</td>
  </tr>`).join('');

  const stepRows = steps.map((step, index) => `<tr>
    <td width="34" style="padding:7px 0;vertical-align:top;"><div style="width:24px;height:24px;line-height:24px;border-radius:12px;background:#0f172a;color:#ffffff;font-size:13px;font-weight:800;text-align:center;">${index + 1}</div></td>
    <td style="padding:7px 0;vertical-align:top;font-size:15px;line-height:1.5;color:#334155;">${escape(step)}</td>
  </tr>`).join('');

  const photo = agent.photoUrl
    ? `<img src="cid:${BUSINESS_AGENT_PHOTO_CID}" data-business-agent-photo="${encodeURIComponent(agent.photoUrl)}" alt="${escape(agent.name)}" width="104" height="104" style="display:block;width:104px;height:104px;margin:0 auto 12px;border-radius:52px;border:3px solid #ffffff;">`
    : '';

  const html = emailShell({
    lang, width: 600,
    title: subject,
    subtitle: t('Welcome to business pricing at Peptidos Colombia.', 'Bienvenido a los precios empresariales de Peptidos Colombia.'),
    body: `
      ${paragraph(hello, 'font-weight:700;color:#0f172a;')}
      ${paragraph(congrats)}
      ${paragraph(access)}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 6px;">
        <tr><td align="center" bgcolor="#FFF7ED" style="background:#FFF7ED;border:2px solid #FDBA74;border-radius:16px;padding:26px 18px;text-align:center;">
          <div style="font-size:${pct ? 58 : 34}px;line-height:1;font-weight:900;color:#BF4F0B;letter-spacing:-1px;">${escape(pct ? `${pct}${t(' OFF', '')}` : t('Business pricing', 'Precio empresarial'))}</div>
          <div style="margin-top:8px;font-size:${pct ? 17 : 15}px;font-weight:800;color:#9A3412;">${escape(pct ? t('on eligible products', 'de descuento en productos elegibles') : t('on the products agreed with our team', 'en los productos acordados con nuestro equipo'))}</div>
          <div style="margin:18px auto 0;padding-top:16px;border-top:1px solid #FED7AA;font-size:18px;line-height:1.4;font-weight:800;color:#0f172a;">${escape(minimumHeadline)}</div>
        </td></tr>
      </table>
      <div style="height:18px;line-height:18px;">&nbsp;</div>
      ${button(shopUrl, t('Shop with Business Pricing', 'Comprar con precio empresarial'), '#BF4F0B')}

      ${heading(t('Your Business Account Benefits', 'Beneficios de su cuenta empresarial'))}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${benefitRows}</table>
      ${paragraph(terms, 'margin-top:8px;font-size:12px;color:#64748b;')}

      ${heading(t('Ready to place your first order?', '¿Listo para su primer pedido?'))}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${stepRows}</table>
      <div style="height:14px;line-height:14px;">&nbsp;</div>
      ${button(accountUrl, t('Access Your Business Account', 'Acceder a su cuenta empresarial'), '#0f172a')}

      ${heading(t('Your account details', 'Datos de su cuenta'))}
      ${detailTable(rows)}
      ${paragraph(t('Something wrong? Reply to this email or message us on WhatsApp and we will correct it.', '¿Algo no está bien? Responda este correo o escríbanos por WhatsApp y lo corregimos.'), 'margin-top:12px;font-size:13px;color:#64748b;')}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;">
        <tr><td align="center" bgcolor="#F0FDF4" style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:16px;padding:24px 18px;text-align:center;">
          ${photo}
          <div style="font-size:17px;font-weight:800;color:#0f172a;margin-bottom:8px;">${escape(agentHeading)}</div>
          <div style="font-size:14px;line-height:1.6;color:#334155;margin-bottom:${agent.phone ? 8 : 16}px;">${escape(agentText)}</div>
          ${agent.phone ? `<div style="font-size:15px;font-weight:800;color:#15803d;margin-bottom:16px;">WhatsApp: ${escape(agent.phone)}</div>` : ''}
          ${chatUrl ? button(chatUrl, t('Chat with us on WhatsApp', 'Escríbanos por WhatsApp'), '#16A34A') : ''}
        </td></tr>
      </table>

      <div style="height:22px;line-height:22px;">&nbsp;</div>
      ${paragraph(closing)}
      <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${escape(t('Best regards,', 'Saludos cordiales,'))}<br><strong style="color:#0f172a;">Peptidos Colombia</strong><br>${escape(signature)}</p>`,
  });
  return { subject, text, html };
}

function itemLines(items, t, { prices = false } = {}) {
  return (Array.isArray(items) ? items : []).map(item => {
    const line = `${item.qty} × ${businessFacingName(item.product)}`;
    return prices && item.unit_price_usd != null ? `${line} · ${usd(item.unit_price_usd)} ${t('per unit', 'por unidad')}` : line;
  });
}

function noticeEmail({ lang, subject, title, subtitle, intro, rows = [], lines = [], linesTitle = '', note = '', noteTitle = '', buttonLabel, buttonUrl }) {
  const text = [intro, '', ...rows.map(([label, value]) => `${label}: ${value}`), ...(lines.length ? ['', linesTitle, ...lines] : []), ...(note ? ['', `${noteTitle}: ${note}`] : [])].join('\n');
  const html = emailShell({
    lang, width: 600, title, subtitle,
    body: `
      ${paragraph(intro)}
      ${rows.length ? detailTable(rows) : ''}
      ${lines.length ? `${heading(linesTitle)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:12px;">${lines.map((line, index) => `<tr><td style="${index ? 'border-top:1px solid #e2e8f0;' : ''}padding:10px 14px;font-size:14px;color:#0f172a;">${escape(line)}</td></tr>`).join('')}</table>` : ''}
      ${note ? `${heading(noteTitle)}<div style="padding:14px 16px;background:#F8FAFC;border:1px solid #e2e8f0;border-radius:12px;font-size:14px;line-height:1.6;color:#334155;">${escape(note).replace(/\r?\n/g, '<br>')}</div>` : ''}
      <div style="height:24px;line-height:24px;">&nbsp;</div>
      ${button(buttonUrl, buttonLabel, '#BF4F0B')}
      <div style="height:18px;line-height:18px;">&nbsp;</div>
      <p align="center" style="margin:0;font-size:13px;line-height:1.5;color:#64748b;text-align:center;">Peptidos Colombia · ${escape(lang === 'en' ? 'Business Accounts Team' : 'Equipo de Cuentas Empresariales')}</p>`,
  });
  return { subject, text, html };
}

const quoteRef = quote => String(quote?.id || '').slice(0, 8).toUpperCase();

/** The confirmation a buyer gets the moment a quote request is saved. */
export function buildBusinessQuoteRequestEmail(business, quote, siteUrl = SITE) {
  const lang = businessEmailLang(business);
  const t = (english, spanish) => (lang === 'en' ? english : spanish);
  return noticeEmail({
    lang,
    subject: t('Quote request received', 'Solicitud de cotización recibida'),
    title: t('Quote request received', 'Recibimos su solicitud de cotización'),
    subtitle: t('Thank you. We will get back to you soon.', 'Gracias. Le responderemos pronto.'),
    intro: t(
      `We received the quote request for ${sentence(business.legal_name)} Our team is reviewing it and will email you as soon as your pricing is ready. You can follow it under Quotes in your business account.`,
      `Recibimos la solicitud de cotización de ${sentence(business.legal_name)} Nuestro equipo la está revisando y le escribirá en cuanto sus precios estén listos. Puede seguirla en Cotizaciones dentro de su cuenta empresarial.`,
    ),
    rows: [[t('Quote reference', 'Referencia'), quoteRef(quote)], [t('Requested by', 'Solicitada por'), quote.requested_by_email || '—']],
    linesTitle: t('Products requested', 'Productos solicitados'),
    lines: itemLines(quote.items, t),
    noteTitle: t('Your notes', 'Sus notas'),
    note: String(quote.customer_note || '').trim(),
    buttonLabel: t('View my quotes', 'Ver mis cotizaciones'),
    buttonUrl: signInLink(siteOrigin(siteUrl), lang, '/account/business/tools?tab=quotes'),
  });
}

/** Sent when staff approve (price) or decline a quote. */
export function buildBusinessQuoteReviewEmail(business, quote, siteUrl = SITE) {
  const lang = businessEmailLang(business);
  const t = (english, spanish) => (lang === 'en' ? english : spanish);
  const approved = quote.status === 'approved';
  const rows = [[t('Quote reference', 'Referencia'), quoteRef(quote)], [t('Status', 'Estado'), approved ? t('Approved', 'Aprobada') : t('Declined', 'Rechazada')]];
  if (approved && quote.expires_at) rows.push([t('Valid until', 'Válida hasta'), formatCrInstant(quote.expires_at)]);
  return noticeEmail({
    lang,
    subject: approved ? t('Your quote is ready', 'Su cotización está lista') : t('Update on your quote', 'Actualización de su cotización'),
    title: approved ? t('Your quote is ready', 'Su cotización está lista') : t('Update on your quote', 'Actualización de su cotización'),
    subtitle: approved ? t('Review the prices and order when you are ready.', 'Revise los precios y haga su pedido cuando guste.') : t('We could not approve this quote.', 'No pudimos aprobar esta cotización.'),
    intro: approved
      ? t(`Your quote for ${business.legal_name} has been priced. Open it in your business account to order at these prices before it expires.`, `La cotización de ${business.legal_name} ya tiene precios. Ábrala en su cuenta empresarial para comprar a estos precios antes de que venza.`)
      : t(`We could not approve the quote for ${sentence(business.legal_name)} Message us on WhatsApp or reply to this email and we will help you find the best option.`, `No pudimos aprobar la cotización de ${sentence(business.legal_name)} Escríbanos por WhatsApp o responda este correo y le ayudamos a encontrar la mejor opción.`),
    rows,
    linesTitle: t('Products', 'Productos'),
    lines: itemLines(quote.items, t, { prices: approved }),
    noteTitle: t('Note from our team', 'Nota de nuestro equipo'),
    note: String(quote.staff_note || '').trim(),
    buttonLabel: approved ? t('Open my quote', 'Abrir mi cotización') : t('View my quotes', 'Ver mis cotizaciones'),
    buttonUrl: signInLink(siteOrigin(siteUrl), lang, '/account/business/tools?tab=quotes'),
  });
}

/** Sent when staff change a business's status, discount or minimums. */
export function buildBusinessTermsEmail(business, siteUrl = SITE) {
  const lang = businessEmailLang(business);
  const t = (english, spanish) => (lang === 'en' ? english : spanish);
  const status = { approved: t('Active', 'Activa'), pending: t('Under review', 'En revisión'), suspended: t('On hold', 'En pausa') }[business.status] || business.status;
  return noticeEmail({
    lang,
    subject: t('Your business account was updated', 'Su cuenta empresarial fue actualizada'),
    title: t('Your business account was updated', 'Su cuenta empresarial fue actualizada'),
    subtitle: t('Here are your current terms.', 'Estas son sus condiciones actuales.'),
    intro: t(`We updated the business account for ${sentence(business.legal_name)} These are the terms that apply from now on.`, `Actualizamos la cuenta empresarial de ${sentence(business.legal_name)} Estas son las condiciones que aplican desde ahora.`),
    rows: [
      [t('Status', 'Estado'), status],
      [t('Discount', 'Descuento'), pctLabel(business.discount_pct) || '0%'],
      [t('Minimum units per order', 'Unidades mínimas por pedido'), String(Math.trunc(Number(business.minimum_units) || 0))],
      [t('Minimum products total after discounts', 'Compra mínima en productos después de descuentos'), usd(business.minimum_order_usd)],
    ],
    buttonLabel: t('Open my account', 'Abrir mi cuenta'),
    buttonUrl: signInLink(siteOrigin(siteUrl), lang, '/account/business'),
  });
}
