import Link from 'next/link';
import { Cloud, Mail, Music2, Phone } from 'lucide-react';
import Container from '@/components/ui/container';
import Logo from '@/components/logo';
import WhatsAppIcon from '@/components/whatsapp-icon';
import { getPublishedGlobal } from '@/lib/site-cms';
import { imageSource } from '@/lib/images';
import { label, t } from '@/lib/i18n';
import { localePath, DEFAULT_LANG } from '@/lib/routes';

const HEADINGS = {
  es: { quick: 'Enlaces rápidos', categories: 'Comprar por categorías', contact: 'Contáctenos', legal: 'Aviso legal:' },
  en: { quick: 'Quick Links', categories: 'Shop By Categories', contact: 'Contact Us', legal: 'Legal Notice:' },
};

function BulkOffer({ lang, footer }) {
  const bulk = footer.bulk;
  if (!bulk?.lines_en?.length) return null;
  const lines = (lang === 'es' ? bulk.lines_es : bulk.lines_en) ?? bulk.lines_en;

  return (
    <section className="bg-primary text-white">
      <Container className="grid gap-5 py-8 sm:gap-8 sm:py-12 lg:grid-cols-[1.25fr_1fr] lg:items-center lg:gap-24">
        <div>
          <h2 className="text-2xl font-bold !text-white sm:text-4xl">{t(bulk, 'title', lang)}</h2>
          <p className="mt-3 max-w-xl text-lg leading-6 font-semibold text-white sm:mt-5 sm:text-xl sm:leading-7">{lines[0]}</p>
        </div>
        <div>
          <p className="max-w-lg text-sm leading-6 text-white">{String(lines[1] || '').replace(/^\*\s*/, '')}</p>
          {bulk.cta_href && (
            <a
              className="contact-cta mt-5 inline-flex min-h-12 min-w-[190px] items-center justify-center gap-2 rounded-lg px-7 py-3 text-base font-semibold"
              href={bulk.cta_href}
              rel="noopener noreferrer"
              target="_blank"
            >
              <WhatsAppIcon className="h-5 w-5 shrink-0" />
              {t(bulk, 'cta', lang)}
            </a>
          )}
        </div>
      </Container>
    </section>
  );
}

function Stars({ score, best, lang }) {
  const filled = Math.max(0, Math.min(1, (score || 0) / best)) * 100;
  return (
    <span aria-label={lang === 'es' ? `Calificación: ${score} de ${best}` : `Rated ${score} out of ${best}`} className="relative inline-block" role="img">
      <span className="text-sm text-slate-300">{'★'.repeat(5)}</span>
      <span
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden text-sm text-amber-400"
        style={{ width: `${filled}%` }}
      >
        {'★'.repeat(5)}
      </span>
    </span>
  );
}

function ReviewBand({ lang, footer }) {
  const reviews = footer.reviews ?? [];
  if (!reviews.length) return null;

  const border = ['border-slate-200', 'border-slate-200', 'border-slate-200'];
  return (
    <ul className="footer-review-rail mt-8 grid gap-3 sm:mt-10 sm:grid-cols-3">
      {reviews.map((review, index) => {
        const score = Number(review.value ?? review.score);
        const best = Number(review.best) || 5;
        const logo = imageSource(review.logo);
        return (
          <li key={review.name}>
            <a
              className={`flex min-h-[78px] items-center justify-center gap-4 rounded-2xl border bg-white px-5 py-3 shadow-[0_8px_24px_rgba(9,39,113,0.05)] transition hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md ${border[index] || 'border-slate-200'}`}
              href={(lang === 'es' ? review.href_es : review.href) || review.href}
              rel="noopener noreferrer"
              target="_blank"
            >
              {logo.src && (
                // eslint-disable-next-line @next/next/no-img-element -- harvested asset
                <img alt={review.logoAlt || review.name} className="h-9 w-9 object-contain" {...logo} />
              )}
              <span>
                <span className="block text-sm font-bold text-primary">{review.name}</span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  <span className="text-lg font-extrabold text-primary">{review.score}</span>
                  <Stars best={best} lang={lang} score={score} />
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function FooterLink({ href, children, lang }) {
  if (/^https?:/i.test(href)) {
    return (
      <a className="hover:text-accent" href={href} rel="noopener noreferrer" target="_blank">
        {children}
      </a>
    );
  }
  return (
    <Link className="hover:text-accent" href={localePath(href, lang)}>
      {children}
    </Link>
  );
}

function SocialIcon({ name }) {
  const iconClass = 'h-4 w-4';
  const brandClass = 'h-4 w-4 fill-current';
  switch (name.toLowerCase()) {
    case 'facebook':
      return <svg aria-hidden="true" className={brandClass} viewBox="0 0 24 24"><path d="M13.5 21v-7h2.5l.5-3h-3V9.5c0-.87.29-1.5 1.58-1.5H16V5.31c-.27-.04-1.2-.12-2.27-.12-2.25 0-3.79 1.37-3.79 3.9V11H7.5v3h2.44v7h3.56Z" /></svg>;
    case 'youtube':
      return <svg aria-hidden="true" className={brandClass} viewBox="0 0 24 24"><path d="M21.58 7.19a3 3 0 0 0-2.11-2.12C17.61 4.57 12 4.57 12 4.57s-5.61 0-7.47.5A3 3 0 0 0 2.42 7.2C1.92 9.06 1.92 12 1.92 12s0 2.94.5 4.81a3 3 0 0 0 2.11 2.12c1.86.5 7.47.5 7.47.5s5.61 0 7.47-.5a3 3 0 0 0 2.11-2.12c.5-1.86.5-4.81.5-4.81s0-2.94-.5-4.81ZM10.2 15.03V8.97L15.45 12l-5.25 3.03Z" /></svg>;
    case 'linkedin':
      return <svg aria-hidden="true" className={brandClass} viewBox="0 0 24 24"><path d="M5.34 7.43A2.06 2.06 0 1 1 5.34 3.3a2.06 2.06 0 0 1 0 4.13ZM3.56 20.45h3.56V9H3.56v11.45ZM9.35 9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.61 0 4.27 2.37 4.27 5.46v6.28H16.9v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9Z" /></svg>;
    case 'instagram':
      return <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect height="16" rx="4" width="16" x="4" y="4" /><circle cx="12" cy="12" r="3.5" /><circle cx="17" cy="7" fill="currentColor" r="1" stroke="none" /></svg>;
    case 'tiktok':
      return <Music2 aria-hidden="true" className={iconClass} />;
    case 'bluesky':
      return <Cloud aria-hidden="true" className={iconClass} />;
    default:
      return <span aria-hidden="true" className="text-xs font-bold">{name.slice(0, 1)}</span>;
  }
}

export default async function SiteFooter({ lang = DEFAULT_LANG }) {
  const { footer } = await getPublishedGlobal();
  const headings = HEADINGS[lang] || HEADINGS[DEFAULT_LANG];

  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-50 text-primary">
      <BulkOffer lang={lang} footer={footer} />

      <Container className="py-10 sm:py-16">
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-2 md:gap-10 lg:grid-cols-[1.15fr_0.9fr_0.95fr_1fr]">
          <div className="col-span-2 lg:col-span-1">
            <Logo className="mb-4" imageClassName="h-auto w-[210px] max-w-full" lang={lang} loading="lazy" />
            <p className="text-sm leading-6 text-primary sm:text-base">{t(footer, 'blurb', lang)}</p>
            <h5 className="mt-5 text-lg font-bold text-primary">{headings.legal}</h5>
            <p className="mt-2 text-xs leading-5 text-primary sm:text-sm sm:leading-6">{t(footer, 'disclaimer', lang)}</p>
          </div>

          <div>
            <h5 className="text-base font-bold text-primary sm:text-xl">{headings.quick}</h5>
            <ul className="mt-3 space-y-2 text-sm sm:mt-4 sm:text-base">
              {footer.quickLinks.map((item) => (
                <li key={`${item.href}-${item.label_en}`}>
                  <FooterLink href={item.href} lang={lang}>{label(item, lang)}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="text-base font-bold text-primary sm:text-xl">{headings.categories}</h5>
            <ul className="mt-3 space-y-2 text-sm sm:mt-4 sm:text-base">
              {footer.categories.map((category) => (
                <li key={`${category.href}-${category.label_en}`}>
                  <FooterLink href={category.href} lang={lang}>{label(category, lang)}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 lg:col-span-1">
            <h5 className="text-xl font-bold text-primary">{headings.contact}</h5>
            <ul className="mt-4 space-y-3 text-base">
              {footer.contactLinks.map((contact) => {
                const whatsapp = contact.href.startsWith('https://wa.me/');
                const Icon = contact.href.startsWith('mailto:') ? Mail : Phone;
                return (
                  <li key={contact.href}>
                    <a className="inline-flex items-start gap-2 hover:text-accent" href={contact.href} rel={whatsapp ? 'noopener noreferrer' : undefined} target={whatsapp ? '_blank' : undefined}>
                      {whatsapp
                        ? <WhatsAppIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#25D366]" />
                        : <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand-red" />}
                      {label(contact, lang)}
                    </a>
                  </li>
                );
              })}
            </ul>
            <ul className="mt-5 flex flex-wrap gap-2">
              {footer.social.map((social) => (
                <li key={social.href}>
                  <a
                    aria-label={social.name}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c90008] text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c90008]"
                    href={social.href}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <SocialIcon name={social.name} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ReviewBand lang={lang} footer={footer} />
      </Container>

      <Container className="pb-6">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(9,39,113,0.06)]">
          <iframe
            className="h-[220px] w-full border-0 sm:h-[340px]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src="https://www.google.com/maps?q=9.6209312,-84.6046761&output=embed&z=15"
            title={lang === 'es' ? 'Ubicación de Peptides Costa Rica en Google Maps' : 'Google Maps location of Peptides Costa Rica'}
          />
          <a className="block px-4 py-3 text-sm font-semibold text-primary hover:text-accent" href="https://maps.app.goo.gl/Fm2teY3ab8aPDxjr5" rel="noopener noreferrer" target="_blank">
            {lang === 'es' ? 'Abrir en Google Maps' : 'Open in Google Maps'}
          </a>
        </div>
      </Container>

      <div className="mt-8 bg-primary py-4 text-center text-xs text-white">
        {t(footer, 'copyright', lang)}
      </div>
    </footer>
  );
}
