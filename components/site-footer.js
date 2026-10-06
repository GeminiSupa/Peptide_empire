import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';
import Container from '@/components/ui/container';
import Logo from '@/components/logo';
import { footer } from '@/content/global';
import { imageSource } from '@/lib/images';
import { label, t } from '@/lib/i18n';
import { localePath, DEFAULT_LANG } from '@/lib/routes';

const HEADINGS = {
  es: { quick: 'Enlaces rápidos', categories: 'Comprar por categorías', contact: 'Contáctenos', legal: 'Aviso legal:' },
  en: { quick: 'Quick Links', categories: 'Shop By Categories', contact: 'Contact Us', legal: 'Legal Notice:' },
};

function BulkOffer({ lang }) {
  const bulk = footer.bulk;
  if (!bulk?.lines_en?.length) return null;
  const lines = (lang === 'es' ? bulk.lines_es : bulk.lines_en) ?? bulk.lines_en;

  return (
    <section className="bg-primary text-white">
      <Container className="grid gap-8 py-12 lg:grid-cols-[1.25fr_1fr] lg:items-center lg:gap-24">
        <div>
          <h2 className="text-3xl font-bold !text-white sm:text-4xl">{t(bulk, 'title', lang)}</h2>
          <p className="mt-5 max-w-xl text-xl leading-7 font-semibold text-white">{lines[0]}</p>
        </div>
        <div>
          <p className="max-w-lg text-sm leading-6 text-white">{String(lines[1] || '').replace(/^\*\s*/, '')}</p>
          {bulk.cta_href && (
            <a
              className="mt-5 inline-flex min-w-[190px] items-center justify-center rounded bg-[#c90008] px-7 py-3 text-base font-semibold text-white transition hover:brightness-110"
              href={bulk.cta_href}
            >
              {t(bulk, 'cta', lang)}
            </a>
          )}
        </div>
      </Container>
    </section>
  );
}

function Stars({ score, best }) {
  const filled = Math.max(0, Math.min(1, (score || 0) / best)) * 100;
  return (
    <span aria-label={`Rated ${score} out of ${best}`} className="relative inline-block" role="img">
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

function ReviewBand({ lang }) {
  const reviews = footer.reviews ?? [];
  if (!reviews.length) return null;

  const border = ['border-emerald-400', 'border-red-400', 'border-blue-400'];
  return (
    <ul className="mt-10 grid gap-3 sm:grid-cols-3">
      {reviews.map((review, index) => {
        const score = Number(review.value ?? review.score);
        const best = Number(review.best) || 5;
        const logo = imageSource(review.logo);
        return (
          <li key={review.name}>
            <a
              className={`flex min-h-[78px] items-center justify-center gap-4 rounded-xl border bg-white px-5 py-3 ${border[index] || 'border-slate-300'}`}
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
                  <Stars best={best} score={score} />
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

export default function SiteFooter({ lang = DEFAULT_LANG }) {
  const headings = HEADINGS[lang] || HEADINGS[DEFAULT_LANG];

  return (
    <footer className="mt-auto bg-white text-primary">
      <BulkOffer lang={lang} />

      <Container className="py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.15fr_0.9fr_0.95fr_1fr]">
          <div>
            <Logo className="mb-4" imageClassName="h-auto w-[156px]" lang={lang} />
            <p className="text-base leading-6 text-primary">{t(footer, 'blurb', lang)}</p>
            <h5 className="mt-5 text-lg font-bold text-primary">{headings.legal}</h5>
            <p className="mt-2 text-sm leading-6 text-primary">{t(footer, 'disclaimer', lang)}</p>
          </div>

          <div>
            <h5 className="text-xl font-bold text-primary">{headings.quick}</h5>
            <ul className="mt-4 space-y-2 text-base">
              {footer.quickLinks.map((item) => (
                <li key={`${item.href}-${item.label_en}`}>
                  <FooterLink href={item.href} lang={lang}>{label(item, lang)}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="text-xl font-bold text-primary">{headings.categories}</h5>
            <ul className="mt-4 space-y-2 text-base">
              {footer.categories.map((category) => (
                <li key={`${category.href}-${category.label_en}`}>
                  <FooterLink href={category.href} lang={lang}>{label(category, lang)}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="text-xl font-bold text-primary">{headings.contact}</h5>
            <ul className="mt-4 space-y-3 text-base">
              {footer.contactLinks.map((contact) => {
                const Icon = contact.href.startsWith('mailto:') ? Mail : Phone;
                return (
                  <li key={contact.href}>
                    <a className="inline-flex items-start gap-2 hover:text-accent" href={contact.href}>
                      <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand-red" />
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
                    className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#c90008] px-1 text-[9px] font-bold text-white"
                    href={social.href}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {social.name === 'Linkedin' ? 'in' : social.name.slice(0, 2)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ReviewBand lang={lang} />
      </Container>

      <Container className="pb-6">
        <div className="relative overflow-hidden">
          <iframe
            className="h-[450px] w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src="https://www.google.com/maps?q=Costa%20Rica&output=embed&t=k&z=7"
            title="Google Maps location of Peptides Costa Rica"
          />
        </div>
      </Container>

      <div className="bg-primary py-3 text-center text-xs text-white">
        {t(footer, 'copyright', lang)}
      </div>
    </footer>
  );
}
