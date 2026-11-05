import Link from 'next/link';
import Image from 'next/image';
import { AlertTriangle, Building2, CheckCircle2, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { buildPaymentRetryPath } from '@/lib/paymentRecovery.mjs';
import { getBusinessLinks } from '@/lib/settings';
import { buildWhatsAppLink } from '@/lib/whatsappLink.mjs';
import styles from './payment-help.module.css';

export const metadata = { title: 'Payment help | Peptides Costa Rica' };

export default async function PaymentHelpPage({ searchParams }) {
  const params = await searchParams;
  const order = String(params?.order || '').trim();
  const reason = params?.reason === '3ds' ? '3ds' : 'declined';
  const lang = params?.lang === 'en' ? 'en' : 'es';
  const en = lang === 'en';
  const links = await getBusinessLinks();
  const retryHref = (order && buildPaymentRetryPath(order)) || `/catalog?lang=${lang}`;
  const whatsappText = en
    ? `Hi, I need help completing card payment for order ${order || '(order number)'}. My bank declined it or the 3D Secure approval did not finish.`
    : `Hola, necesito ayuda para completar el pago con tarjeta del pedido ${order || '(número de pedido)'}. Mi banco lo rechazó o no se completó la aprobación 3D Secure.`;

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.brand}><Image src="/logo.png" alt="Peptides Costa Rica" width={48} height={48} /><span>PEPTIDES COSTA RICA</span></div>
        <div className={styles.card}>
          <div className={styles.icon}><AlertTriangle size={32} /></div>
          <p className={styles.eyebrow}>{en ? 'Your order is still saved' : 'Su pedido sigue guardado'}</p>
          <h1>{reason === '3ds'
            ? (en ? 'Your bank still needs your approval' : 'Su banco aún necesita su aprobación')
            : (en ? 'Your bank declined this card attempt' : 'Su banco rechazó este intento')}</h1>
          <p className={styles.lead}>{en
            ? 'Costa Peptides did not block your card. Card approvals and 3D Secure checks are controlled by your bank, and nothing has been charged for a declined attempt.'
            : 'Costa Peptides no bloqueó su tarjeta. Las aprobaciones y verificaciones 3D Secure las controla su banco, y no se realizó ningún cargo por un intento rechazado.'}</p>

          {order && <div className={styles.order}>{en ? 'Order' : 'Pedido'} <strong>#{order}</strong></div>}

          <div className={styles.steps}>
            <article><span>1</span><Building2 size={22} /><div><strong>{en ? 'Open your bank app' : 'Abra la app de su banco'}</strong><p>{en ? 'Look for a pending card or security approval and approve it.' : 'Busque una aprobación pendiente de tarjeta o seguridad y autorícela.'}</p></div></article>
            <article><span>2</span><ShieldCheck size={22} /><div><strong>{en ? 'Still blocked? Call the bank' : '¿Sigue bloqueada? Llame al banco'}</strong><p>{en ? 'Ask them to allow this online purchase, then return here.' : 'Pídales autorizar esta compra en línea y luego vuelva aquí.'}</p></div></article>
            <article><span>3</span><CheckCircle2 size={22} /><div><strong>{en ? 'Try the payment again' : 'Intente el pago nuevamente'}</strong><p>{en ? 'Your order is waiting; you do not need to rebuild your cart.' : 'Su pedido está guardado; no necesita volver a armar el carrito.'}</p></div></article>
          </div>

          <div className={styles.actions}>
            <Link className={styles.primary} href={retryHref}><RefreshCw size={18} />{en ? 'Try again' : 'Intentar de nuevo'}</Link>
            <a className={styles.whatsapp} href={buildWhatsAppLink(links.whatsappNumber, whatsappText)} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} />{en ? 'Continue on WhatsApp' : 'Continuar por WhatsApp'}</a>
          </div>
          <p className={styles.note}>{en ? 'Prefer another card? You can enter it after choosing Try again.' : '¿Prefiere otra tarjeta? Puede ingresarla después de elegir Intentar de nuevo.'}</p>
        </div>
      </section>
    </main>
  );
}
