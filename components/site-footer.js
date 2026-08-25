import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';
import Container from '@/components/ui/container';
import ContactBar from '@/components/contact-bar';
import { footer } from '@/content/global';
import { imageSource } from '@/lib/images';
import { label, t } from '@/lib/i18n';
import { localePath, DEFAULT_LANG } from '@/lib/routes';

// Column headings are the live site's own words, harvested in both languages.
const HEADINGS = {
  es: { quick: 'Enlaces rápidos', categories: 'Comprar por categorías', contact: 'Contáctenos', legal: 'Aviso legal:' },
  en: { quick: 'Quick Links', categories: 'Shop By Categories', contact: 'Contact Us', legal: 'Legal Notice:' },
};

/**
 * The bulk-savings promo above the footer columns.
 *
 * The heading levels are the live site's, not the ones an outline would suggest:
 * an <h4> label over two <h2> sentences. Reproducing the original's outline is
 * the point of the clone — the same reasoning as the level-0 headings in
 * components/blocks.js.
 */
function BulkOffer({ lang }) {
  const bulk = footer.bulk;
  if (!bulk?.lines_en?.length) return null;

  const lines = (lang === 'es' ? bulk.lines_es : bulk.lines_en) ?? bulk.lines_en;
  const cta = t(bulk, 'cta', lang);

  return (
    <div className="border-b border-white/15 pb-12 text-center">
      {/* The colours carry `!` because a global rule paints every heading the
          primary navy — which on this navy footer rendered the whole block
          invisible. Same reason PromoBanner uses !text-white. */}
      <h4 className="text-xs font-bold tracking-[0.2em] !text-accent uppercase">
        {t(bulk, 'title', lang)}
      </h4>
      {lines.map((line, i) => (
        <h2
          className={
            i === 0
              ? 'mx-auto mt-4 max-w-3xl text-2xl font-bold !text-white sm:text-3xl'
              : 'mx-auto mt-3 max-w-2xl text-sm leading-relaxed font-normal !text-white/70'
          }
          key={i}
        >
          {line}
        </h2>
      ))}
      {cta && bulk.cta_href && (
        <a
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 text-sm font-bold text-white transition hover:brightness-110"
          href={bulk.cta_href}
        >
          <Phone aria-hidden="true" className="h-4 w-4" />
          {cta}
        </a>
      )}
    </div>
  );
}

/**
 * The Trustpilot / Google / Facebook band that sits below the footer columns.
 *
 * Site chrome, not page content, so it belongs here rather than in any page's
 * section list — it renders on all 322 pages exactly as it does on the live
 * site. The scores are a harvest snapshot; each card links to the profile that
 * is the actual authority for its rating.
 */
function ReviewBand({ lang }) {
  const reviews = footer.reviews ?? [];
  if (!reviews.length) return null;

  return (
    <ul className="mt-12 grid gap-4 border-t border-white/15 pt-10 sm:grid-cols-3">
      {reviews.map((r) => {
        // r.score is the display copy ("5.0"); r.value is the precise number the
        // stars fill to. See reviewBand() in scripts/harvest-global.mjs.
        const score = Number(r.value ?? r.score);
        const best = Number(r.best) || 5;
        return (
          <li key={r.name}>
            <a
              className="flex h-full items-center justify-center gap-4 rounded-xl bg-white/5 px-5 py-4 transition hover:bg-white/10"
              href={(lang === 'es' ? r.href_es : r.href) || r.href}
              rel="noopener noreferrer"
              target="_blank"
            >
              {imageSource(r.logo).src && (
                // eslint-disable-next-line @next/next/no-img-element -- harvested
                <img
                  alt={r.logoAlt || r.name}
                  className="h-10 w-10 shrink-0 object-contain"
                  loading="lazy"
                  sizes="2.5rem"
                  {...imageSource(r.logo)}
                />
              )}
              {/* <h2> for the name and the score, as on the live site. */}
              <span>
                <h2 className="block text-sm font-bold !text-white">{r.name}</h2>
                <span className="mt-0.5 flex items-center gap-1.5">
                  <h2 className="text-lg font-extrabold !text-white">{r.score}</h2>
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

/**
 * Five stars with the score's fraction filled, mirroring Elementor's rating
 * widget. Rendered as one accessible label rather than five icons, so a screen
 * reader announces "Rated 4.2 out of 5" instead of counting stars.
 */
function Stars({ score, best }) {
  const filled = Math.max(0, Math.min(1, (score || 0) / best)) * 100;
  return (
    <span aria-label={`Rated ${score} out of ${best}`} className="relative inline-block" role="img">
      <span className="text-sm text-white/25">{'★'.repeat(5)}</span>
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

export default function SiteFooter({ lang = DEFAULT_LANG }) {
  const h = HEADINGS[lang] || HEADINGS[DEFAULT_LANG];
  const lp = (href) => localePath(href, lang);

  return (
    <footer className="mt-auto bg-primary text-white/85">
      <Container className="py-14">
        <BulkOffer lang={lang} />

        <div className="mt-12 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand + legal */}
          <div>
            <p className="text-lg font-extrabold text-white">Peptides Costa Rica</p>
            <p className="mt-4 text-sm leading-relaxed">{t(footer, 'blurb', lang)}</p>
            <div className="mt-6">
              <h5 className="text-xs font-bold tracking-wider text-white uppercase">{h.legal}</h5>
              {/* Required on every page. */}
              <p className="mt-2 text-xs leading-relaxed text-white/70">
                {t(footer, 'disclaimer', lang)}
              </p>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h5 className="text-sm font-bold tracking-wider text-white uppercase">{h.quick}</h5>
            <ul className="mt-4 space-y-2.5 text-sm">
              {footer.quickLinks.map((item) => (
                <li key={`${item.href}-${item.label_en}`}>
                  <Link href={lp(item.href)} className="hover:text-white hover:underline">
                    {label(item, lang)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h5 className="text-sm font-bold tracking-wider text-white uppercase">{h.categories}</h5>
            <ul className="mt-4 space-y-2.5 text-sm">
              {footer.categories.map((c) => (
                <li key={`${c.href}-${c.label_en}`}>
                  <Link href={lp(c.href)} className="hover:text-white hover:underline">
                    {label(c, lang)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact + social */}
          <div>
            <h5 className="text-sm font-bold tracking-wider text-white uppercase">{h.contact}</h5>
            <ul className="mt-4 space-y-3 text-sm">
              {footer.contactLinks.map((c) => (
                <li key={c.href}>
                  <a
                    href={c.href}
                    className="inline-flex items-center gap-2 break-all hover:text-white hover:underline"
                  >
                    {c.href.startsWith('mailto:') && (
                      <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    {label(c, lang)}
                  </a>
                </li>
              ))}
            </ul>

            {/* Eight real profiles, harvested from the live footer. */}
            <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs">
              {footer.social.map((s) => (
                <li key={s.href}>
                  <a
                    href={s.href}
                    className="hover:text-white hover:underline"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ReviewBand lang={lang} />

        <div className="mt-12 border-t border-white/15 pt-6 text-center text-xs text-white/60">
          {t(footer, 'copyright', lang)}
        </div>
      </Container>

      {/* Rendered here because the footer is the one component on every page
          that already knows the language. The bar itself is fixed to the
          viewport, so where it sits in the markup does not affect where it
          appears. */}
      <ContactBar lang={lang} />
    </footer>
  );
}
