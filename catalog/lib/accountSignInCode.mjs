// Copied from the catalog (src/lib/accountSignInCode.mjs) by scripts/sync-catalog-checkout.mjs. Do not edit.
// The sign-in code and the welcome note for a customer account.
//
// Supabase's own login email is a "Sign in" link. That link opens the catalog
// and does not open the account. This shop sends the code itself. The message
// is in the language the person picked, shows the logo, and has no link.

import { ORDER_EMAIL_LOGO_SRC } from './orderEmailBranding.mjs';

export function isMissingAuthUser(error) {
  const message = `${error?.message || ''} ${error?.code || ''}`;
  return /not found|does not exist|no user|user_not_found/i.test(message);
}

export function signInCodeFromLink(link) {
  const code = String(link?.properties?.email_otp || '').trim();
  // Supabase's code length is a project setting. This shop's is 8. Accept the
  // range Supabase allows so a longer code is not thrown away as "not sent".
  return /^\d{6,10}$/.test(code) ? code : null;
}

export function verifyTypeFromLink(link) {
  const type = String(link?.properties?.verification_type || '').toLowerCase();
  if (type === 'signup' || type === 'magiclink') return type;
  return null;
}

const ACCOUNT_URL = 'https://catalog.peptidescostarica.net/account';

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Built from tables, not divs. Outlook draws mail with Word, which ignores
// padding and centring on a div: the sign-in code came out jammed against the
// left edge with no margin. Table cells keep both in every mail client.
export function emailShell({ lang, title, subtitle, body, width = 520 }) {
  const isEn = lang === 'en';
  const slogan = isEn
    ? 'High-Purity Research Peptides · Based in Costa Rica'
    : 'Péptidos de Alta Pureza para Investigación · Con base en Costa Rica';
  return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'es'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6F9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4F6F9" style="background:#F4F6F9;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="${width}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${width}px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;font-family:${FONT};color:#0F172A;">
      <tr><td align="center" bgcolor="#0f172a" style="background:#0f172a;padding:28px 24px;text-align:center;border-radius:16px 16px 0 0;">
        <img src="${ORDER_EMAIL_LOGO_SRC}" alt="Peptides Costa Rica" width="96" height="82" style="display:block;width:96px;height:82px;margin:0 auto 10px;border-radius:12px;">
        <div style="color:#ffffff;font-family:${FONT};font-size:13px;font-weight:800;letter-spacing:1.2px;">PEPTIDES COSTA RICA</div>
        <div style="color:#94a3b8;font-family:${FONT};font-size:11px;letter-spacing:0.4px;margin-top:4px;">${slogan}</div>
        <h1 style="color:#ffffff;font-family:${FONT};font-size:22px;font-weight:800;margin:14px 0 6px;">${title}</h1>
        <p style="color:#e2e8f0;font-family:${FONT};font-size:14px;margin:0;line-height:1.5;">${subtitle}</p>
      </td></tr>
      <tr><td style="padding:28px 24px;font-family:${FONT};color:#0F172A;">
        ${body}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function buildSignInCodeEmail(code, lang = 'es') {
  const safe = String(code || '').trim();
  if (!/^\d{6,10}$/.test(safe)) {
    throw new Error('Sign-in code must be 6 to 10 digits');
  }

  const isEn = lang === 'en';
  const subject = isEn
    ? 'Your Peptides Costa Rica sign-in code'
    : 'Su código para entrar a su cuenta';
  const title = isEn ? 'Your sign-in code' : 'Su código de acceso';
  const subtitle = isEn
    ? 'Type this on the account page. It expires in a few minutes.'
    : 'Escríbalo en la página de su cuenta. Vence en unos minutos.';
  const note = isEn
    ? 'There is no link to click. If you did not ask for this code, ignore this email.'
    : 'No hay ningún enlace para tocar. Si usted no lo pidió, ignore este correo.';
  const text = [title, '', safe, '', subtitle, note].join('\n');
  const html = emailShell({
    lang: isEn ? 'en' : 'es',
    title,
    subtitle,
    body: `
      <p align="center" style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748B;text-align:center;">${isEn ? 'Your code' : 'Su código'}</p>
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px;">
        <tr><td align="center" bgcolor="#F1F5F9" style="background:#F1F5F9;border:1px solid #e2e8f0;border-radius:12px;padding:14px 26px;font-size:32px;letter-spacing:6px;font-weight:800;color:#002766;text-align:center;">${safe}</td></tr>
      </table>
      <p align="center" style="margin:0;font-size:14px;line-height:1.5;color:#64748B;text-align:center;">${note}</p>
    `,
  });

  return { subject, text, html };
}

export function buildAccountWelcomeEmail({ name, lang = 'es' } = {}) {
  const isEn = lang === 'en';
  const who = String(name || '').replace(/[<>&]/g, '').trim();
  const hello = who
    ? (isEn ? `Hello ${who},` : `Hola ${who},`)
    : (isEn ? 'Hello,' : 'Hola,');
  const subject = isEn
    ? 'Your Peptides Costa Rica account is ready'
    : 'Su cuenta de Peptides Costa Rica está lista';
  const accountUrl = `${ACCOUNT_URL}?lang=${isEn ? 'en' : 'es'}`;
  const text = [
    hello,
    '',
    isEn
      ? 'Your account is ready. Any order placed with this email shows up there.'
      : 'Su cuenta está lista. Cualquier pedido hecho con este correo aparece ahí.',
    '',
    isEn
      ? 'You can buy again from your phone and see the photo of what you ordered. The address you type at checkout is saved for next time.'
      : 'Puede comprar de nuevo desde el teléfono y ver la foto de lo que pidió. La dirección que escribe en el checkout queda guardada para la próxima.',
    '',
    accountUrl,
  ].join('\n');
  const html = emailShell({
    lang: isEn ? 'en' : 'es',
    title: isEn ? 'Your account is ready' : 'Su cuenta está lista',
    subtitle: isEn
      ? 'Orders, buy again, and your shipping address, in one place.'
      : 'Pedidos, comprar de nuevo y su dirección de envío, en un solo lugar.',
    body: `
      <p style="margin:0 0 12px;font-size:16px;">${hello}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">${isEn
        ? 'Any order placed with this email shows up in your account.'
        : 'Cualquier pedido hecho con este correo aparece en su cuenta.'}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">${isEn
        ? 'You can buy again from your phone and see the product photo. The address you type at checkout is saved for the next order.'
        : 'Puede comprar de nuevo desde el teléfono y ver la foto del producto. La dirección que escribe en el checkout queda guardada para el próximo pedido.'}</p>
      <p style="margin:0;text-align:center;">
        <a href="${accountUrl}" style="display:inline-block;background:#BF4F0B;color:#ffffff;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:12px;">${isEn ? 'Open my account' : 'Abrir mi cuenta'}</a>
      </p>
    `,
  });

  return { subject, text, html };
}
