'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Ms from '@/components/storefront/icon';
import ProductImage from '@/components/storefront/product-image';
import { useSite } from '@/components/site/site-provider';
import { TrustpilotCount } from '@/components/site/review-widgets';
import { pushEvent, whatsappOrderEvent } from '@/lib/site/analytics.mjs';

/** Where the cart leaves the order it just placed, for this page to show. */
export const LAST_ORDER_KEY = 'pcr_last_order';

function readOrder() {
  try {
    return JSON.parse(window.sessionStorage.getItem(LAST_ORDER_KEY) || 'null');
  } catch {
    return null;
  }
}

/**
 * The prototype's thank-you page, filled with the order this visitor just
 * placed (the cart stores it in sessionStorage before coming here). Opened
 * without one, it shows the next steps alone rather than a made-up order.
 */
export default function ThankYou({ upsells, appHref }) {
  const { t, lang, money, whatsapp } = useSite();
  const [order, setOrder] = useState(null);
  useEffect(() => {
    const placed = readOrder();
    setOrder(placed);
    // The catalog's conversion for a WhatsApp order, once per order even if
    // this page is reloaded.
    const event = whatsappOrderEvent(placed);
    if (!event) return;
    const key = `pcr_conversion:whatsapp_order:${placed.orderNumber}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // Without storage the event can repeat on reload; it is still sent.
    }
    pushEvent(event);
  }, []);
  const m = (amount) => money(amount, amount);
  const ref = order?.orderNumber ? ` ${order.orderNumber}` : '';

  return (
    <div className="pagev" id="page">
      <section className="typ">
        <div className="wrap">
          <div className="tyhead">
            <span className="tyok"><Ms name="check" filled /></span>
            {order?.orderNumber ? <span className="eyebrow2">{`${t('Order')} ${order.orderNumber}`}</span> : null}
            <h1>{t('Thank you! Your order is in.')}</h1>
            <p>{t('No payment needed yet. One of our agents will message you on WhatsApp shortly to confirm everything.')}</p>
          </div>
          <div className="tygrid">
            <div>
              <div className="tycard">
                <h2>{t('What happens next')}</h2>
                <ol className="tysteps">
                  <li className="done"><i><Ms name="check" /></i><div><b>{t('Order received')}</b><small>{t('Saved just now. Nothing to pay yet.')}</small></div></li>
                  <li className="now">
                    <i><Ms name="chat" /></i>
                    <div>
                      <b>{t('We message you on WhatsApp')}</b>
                      <small>{order?.phone ? t(`An agent confirms stock, sends payment details to ${order.phone}.`) : t('An agent confirms stock and sends payment details.')}</small>
                    </div>
                  </li>
                  <li><i><Ms name="payments" /></i><div><b>{t('You pay')}</b><small>{t('SINPE Móvil, bank transfer or cash on delivery.')}</small></div></li>
                  <li><i><Ms name="local_shipping" /></i><div><b>{t('Delivered in 2–4 days')}</b><small>{t('Tracked, from our cold storage to your door.')}</small></div></li>
                </ol>
                <div className="tynote">
                  <Ms name="schedule" />
                  <span>{t('Support hours: Monday to Friday, 10:00 to 17:00 (Costa Rica time). Orders placed outside these hours are confirmed the next business morning.')}</span>
                </div>
              </div>

              {order?.lines?.length ? (
                <div className="tycard">
                  <h2>{t('Your order')}</h2>
                  {order.lines.map((line) => (
                    <div className="tyline" key={`${line.name}${line.size}`}>
                      <span className="cim2"><ProductImage src={line.image} alt="" /></span>
                      <div><b>{line.name}</b><small>{`${line.size} × ${line.qty}`}</small></div>
                      <b className="num">{m(line.total)}</b>
                    </div>
                  ))}
                  <div className="tytot"><span>{t('Delivery')}</span><span>{order.shipping ? m(order.shipping) : t('Free')}</span></div>
                  <div className="tytot big"><span>{t('Total')}</span><b className="num">{m(order.total)}</b></div>
                  {order.savings > 0 ? <div className="tysave">{t(`You saved ${m(order.savings)}`)}</div> : null}
                </div>
              ) : null}
            </div>

            <aside>
              <div className="tyapp">
                <div className="tyappc">
                  <span className="eyebrow2">{t('New · free')}</span>
                  <h2>{t('Get more off your next order.')}</h2>
                  <p>{t('Install the Peptides CR app: earn points on every purchase, climb tiers for extra discounts and free delivery, get referral credit, and reorder in one tap. It installs from your browser in 10 seconds.')}</p>
                  <div className="hctas"><Link className="btn" href={appHref}>{t('Get the app')}<Ms name="download" /></Link></div>
                  <TrustpilotCount lang={lang} />
                </div>
              </div>
              {upsells.length ? (
                <div className="tycard">
                  <h2>{t('Forgot something?')}</h2>
                  <p className="muted" style={{ margin: '-4px 0 12px', fontSize: '14px' }}>{t('Tell your agent when they message you and they\'ll add it before delivery.')}</p>
                  <div className="tyups">
                    {upsells.map((item) => (
                      <div className="tyup" key={item.name}>
                        <span className="cim2"><ProductImage src={item.image} alt="" /></span>
                        <div><b>{item.name}</b><small>{`${item.size} · ${money(item.priceCrc, item.priceUsd)}`}</small></div>
                        <a className="btn ghost sm" href={whatsapp(`Hi! Please add ${item.name} ${item.size} to my order${ref}.`)} target="_blank" rel="noopener noreferrer">
                          {t('Add')}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <a className="btn ghost block" href={whatsapp(`Hi! I have a question about order${ref}.`)} target="_blank" rel="noopener noreferrer">
                {t('Question about my order')}
              </a>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
