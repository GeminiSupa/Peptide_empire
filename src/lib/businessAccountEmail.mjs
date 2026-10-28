import { emailShell } from './accountSignInCode.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function buildBusinessAccountEmail(business, loginUrl, { application = false } = {}) {
  const title = application ? 'Recibimos su solicitud empresarial' : 'Su cuenta empresarial está lista';
  const message = application
    ? 'Nuestro equipo revisará los datos de su empresa y confirmará sus precios por correo. Su solicitud aún no activa descuentos.'
    : `Su descuento acordado es ${business.discount_pct}% en productos elegibles. Las ofertas no se acumulan; aplicamos el mejor precio disponible. Excluye agua BAC y envío.`;
  const english = application
    ? 'We received your business application. Our team will review your company details and email you to confirm your pricing. Discounts become available after approval.'
    : `Your business account is approved with a ${business.discount_pct}% discount on eligible products. Offers do not stack; the best available price applies. Excludes BAC water and shipping.`;
  const text = `Hola ${business.contact_name},\n\n${business.legal_name}\n${message}\n\n${english}\n\nIngrese con ${business.email} y confirme el código que recibirá por correo. / Sign in with this email and verify the code sent to your inbox.\n${loginUrl}\n\nPeptides Costa Rica`;
  const html = emailShell({ lang: 'es', title, subtitle: 'Su empresa. Sus pedidos. Sus beneficios.', body: `
    <p>Hola ${escape(business.contact_name)},</p>
    <h2 style="font-size:18px;">${escape(business.legal_name)}</h2>
    <p style="line-height:1.6;">${escape(message)}</p>
    <p style="line-height:1.6;" lang="en">${escape(english)}</p>
    <p style="padding:16px;background:#f1f5f9;border-radius:8px;line-height:1.6;">${escape(business.email)}<br>Ingrese con este correo y confirme el código enviado a su bandeja. / Sign in with this email and verify your email code.</p>
    <p style="text-align:center;margin:24px 0;"><a href="${escape(loginUrl)}" style="display:inline-block;background:#BF4F0B;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px;">Abrir mi cuenta / Open my account</a></p>` });
  return { subject: `${title} / ${application ? 'Business application received' : 'Your business account is ready'}`, text, html };
}
