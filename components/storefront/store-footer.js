'use client';

import { CONTACT_LINE, DISCLAIMER } from '@/lib/storefront/content.mjs';

/**
 * The footer, with the research-use disclaimer first.
 *
 * The policy links point at this site's own pages, which already exist on
 * these exact paths and are indexed — they are not sent to the catalog.
 */
export default function StoreFooter({ t, lang }) {
  const prefix = lang === 'es' ? '/es' : '';
  const links = lang === 'es'
    ? [
      ['Envíos', `${prefix}/politica-de-envio/`],
      ['Devoluciones', `${prefix}/politica-de-devolucion-y-reembolso/`],
      ['Privacidad', `${prefix}/politica-de-privacidad/`],
      ['Base de datos COA', `${prefix}/resultados-de-pruebas-de-laboratorio-coa/`],
    ]
    : [
      ['Shipping', '/shipping-policy/'],
      ['Returns', '/return-refund-policy/'],
      ['Privacy', '/privacy-policy/'],
      ['COA database', '/lab-tests-coa-results/'],
    ];

  return (
    <footer>
      <div className="wrap">
        <p>
          <b>{t('Research use only.')}</b> {t(DISCLAIMER)}
        </p>
        <nav>
          {links.map(([label, href]) => (
            <a href={href} key={href}>{label}</a>
          ))}
        </nav>
        <p>{`${CONTACT_LINE} · © ${new Date().getFullYear()}`}</p>
      </div>
    </footer>
  );
}
