import Link from 'next/link';
import { Check, ExternalLink, Phone } from 'lucide-react';
import Section, { SectionHeading } from '@/components/ui/section';
import Container from '@/components/ui/container';
import Button from '@/components/ui/button';
import FaqAccordion from '@/components/faq-accordion';
import GuideArticle from '@/components/guide-article';
import LinkList from '@/components/link-list';
import { BLOCK_COMPONENTS, CardGrid, WIDE_TYPES } from '@/components/blocks';
import { nav, catalogUrl, ui } from '@/content/global';
import { t, label } from '@/lib/i18n';
import { localePath } from '@/lib/routes';

/**
 * One section type = one component. This registry is the single place where
 * content and code meet: a `type` string in the data picks a component here.
 *
 * An unknown type renders nothing rather than crashing the page, so a section
 * type can exist in the data (or, later, the database) before its component
 * ships.
 */

const list = (content, key, lang) => content[`${key}_${lang}`] || content[`${key}_en`] || [];

function Hero({ content, lang }) {
  const chips = list(content, 'chips', lang);
  return (
    <section className="bg-gradient-to-b from-primary/5 to-transparent py-16 sm:py-24">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {t(content, 'eyebrow', lang) && (
            <p className="text-xs font-bold tracking-[0.2em] text-accent uppercase">
              {t(content, 'eyebrow', lang)}
            </p>
          )}
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl lg:text-5xl">
            {t(content, 'title', lang)}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-text-main sm:text-lg">
            {t(content, 'intro', lang)}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-text-muted sm:text-base">
            {t(content, 'body', lang)}
          </p>

          {chips.length > 0 && (
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {chips.map((chip) => (
                <li
                  key={chip}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm"
                >
                  <Check className="h-4 w-4 text-accent" aria-hidden="true" />
                  {chip}
                </li>
              ))}
            </ul>
          )}

          {content.cta_href && (
            <div className="mt-9">
              <Button href={localePath(content.cta_href, lang)} variant="accent" size="lg">
                {t(content, 'cta', lang)}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PressBand({ content, lang }) {
  return (
    <div className="border-y border-slate-200 bg-white py-6">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center justify-center gap-2 px-4 text-center sm:flex-row sm:gap-6 sm:px-6 lg:px-8">
        <p className="text-xs font-bold tracking-[0.2em] text-text-muted uppercase">
          {t(content, 'eyebrow', lang)}
        </p>
        <p className="text-sm text-text-muted">{t(content, 'text', lang)}</p>
        <p className="text-sm font-semibold text-primary">{t(content, 'outlet', lang)}</p>
        {content.cta_href && (
          <a
            href={content.cta_href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
          >
            {t(content, 'cta', lang)}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}

function FeatureCards({ content, lang, index }) {
  const cols = content.columns === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4';
  return (
    <Section className={index % 2 === 0 ? 'bg-white' : 'bg-bg-main'}>
      <SectionHeading
        eyebrow={t(content, 'eyebrow', lang)}
        title={t(content, 'title', lang)}
        intro={t(content, 'intro', lang) || t(content, 'body', lang)}
      />
      <div className={`mt-12 grid gap-6 sm:grid-cols-2 ${cols}`}>
        {(content.cards || []).map((card, i) => (
          <div
            key={`${i}-${card.title_en}`}
            className="rounded-xl border border-slate-100 bg-bg-card p-6 shadow-sm"
          >
            <h3 className="text-base font-bold">{t(card, 'title', lang)}</h3>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              {t(card, 'body', lang)}
            </p>
          </div>
        ))}
      </div>
      {content.cta_href && (
        <div className="mt-10 text-center">
          <Button href={localePath(content.cta_href, lang)} variant="accent">
            {t(content, 'cta', lang)}
          </Button>
        </div>
      )}
    </Section>
  );
}

/** Category pills. Sourced from the harvested nav so there is one list, not two. */
function CategoryChips({ content, lang, index }) {
  const categories = nav.find((n) => n.children.length > 5 && !n.href)?.children || [];
  return (
    <Section id="categories" className={index % 2 === 0 ? 'bg-white' : 'bg-bg-main'}>
      <SectionHeading title={t(content, 'title', lang)} />
      <ul className="mt-10 flex flex-wrap items-center justify-center gap-3">
        {categories.map((cat) => (
          <li key={cat.href}>
            <Link
              href={localePath(cat.href, lang)}
              className="inline-flex rounded-full border border-primary/15 bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm transition-colors hover:border-accent hover:text-accent"
            >
              {label(cat, lang)}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Transformation({ content, lang, index }) {
  const disclaimers = list(content, 'disclaimers', lang);
  return (
    <Section className={index % 2 === 0 ? 'bg-white' : 'bg-bg-main'}>
      <SectionHeading
        eyebrow={t(content, 'eyebrow', lang)}
        title={t(content, 'title', lang)}
        intro={t(content, 'body', lang)}
      />
      <div className="mx-auto mt-10 max-w-2xl">
        {/* PLACEHOLDER: the before/after photo is a customer image we do not
            have rights-cleared source for yet. */}
        <div className="flex aspect-[16/10] items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white text-sm text-text-muted">
          {t(ui, 'pendingImage', lang)}
        </div>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {disclaimers.map((d) => (
            <li key={d} className="text-xs text-text-muted">
              • {d}
            </li>
          ))}
        </ul>
        {content.cta_href && (
          <div className="mt-8 text-center">
            <Button href={localePath(content.cta_href, lang)} variant="primary">
              {t(content, 'cta', lang)}
            </Button>
          </div>
        )}
      </div>
    </Section>
  );
}

function PromoBanner({ content, lang }) {
  return (
    <Section className="bg-primary">
      <div className="text-center">
        <p className="text-xs font-bold tracking-[0.2em] text-accent uppercase">
          {t(content, 'eyebrow', lang)}
        </p>
        <h2 className="mt-3 text-3xl font-bold !text-white sm:text-4xl">
          {t(content, 'title', lang)}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/80">
          {t(content, 'body', lang)}
        </p>
      </div>
    </Section>
  );
}

function InfoDuo({ content, lang, index }) {
  return (
    <Section className={index % 2 === 0 ? 'bg-white' : 'bg-bg-main'}>
      <div className="grid gap-8 lg:grid-cols-2">
        {(content.panels || []).map((panel, i) => (
          <div
            key={`${i}-${panel.title_en}`}
            className="flex flex-col rounded-xl border border-slate-100 bg-bg-main p-8"
          >
            <h2 className="text-2xl font-bold sm:text-3xl">{t(panel, 'title', lang)}</h2>
            <p className="mt-4 flex-1 text-sm leading-relaxed text-text-muted">
              {t(panel, 'body', lang)}
            </p>
            {panel.cta_href && (
              <div className="mt-6">
                <Button href={localePath(panel.cta_href, lang)} variant="outline" size="sm">
                  {t(panel, 'cta', lang)}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function TextCta({ content, lang, index }) {
  const href = content.cta_href || '';
  return (
    <Section className={index % 2 === 0 ? 'bg-white' : 'bg-bg-main'}>
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">{t(content, 'title', lang)}</h2>
        <p className="mt-4 text-base leading-relaxed text-text-muted">
          {t(content, 'body', lang)}
        </p>
        {href && (
          <div className="mt-8">
            <Button href={/^(https?:|tel:|mailto:)/.test(href) ? href : localePath(href, lang)} variant="accent" size="lg">
              <Phone className="h-4 w-4" aria-hidden="true" />
              {t(content, 'cta', lang)}
            </Button>
          </div>
        )}
      </div>
    </Section>
  );
}

function CallToOrderCards({ content, lang, index }) {
  return (
    <Section className={index % 2 === 0 ? 'bg-white' : 'bg-bg-main'}>
      <div className="grid gap-6 md:grid-cols-2">
        {(content.cards || []).map((card, i) => {
          const benefits = list(card, 'benefits', lang);
          const href = card.cta_href || '';
          return (
            <div
              key={`${i}-${card.name_en}`}
              className="flex flex-col rounded-xl border border-slate-200 bg-bg-card p-7 shadow-sm"
            >
              <span className="inline-flex w-fit rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
                {t(card, 'badge', lang)}
              </span>
              <h3 className="mt-4 text-xl font-bold">{t(card, 'name', lang)}</h3>
              <p className="mt-2 text-3xl font-extrabold text-primary">
                {t(card, 'price', lang)}
              </p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-text-muted">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap gap-3">
                {href && (
                  <Button href={href} variant="accent">
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    {t(card, 'cta', lang)}
                  </Button>
                )}
                <Button href={catalogUrl(lang)} variant="outline">
                  {t(ui, 'viewInCatalog', lang)}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function Testimonials({ content, lang, index }) {
  return (
    <Section className={index % 2 === 0 ? 'bg-white' : 'bg-bg-main'}>
      <SectionHeading
        eyebrow={t(content, 'eyebrow', lang)}
        title={t(content, 'title', lang)}
        intro={t(content, 'body', lang)}
      />
      {/* The live site shows no individual quotes here either — only this
          heading block. Nothing is missing. */}
    </Section>
  );
}

function Faq({ content, lang, index }) {
  const items = (content.items || []).map((item) => ({
    q: t(item, 'question', lang),
    a: t(item, 'answer', lang),
  }));
  return (
    <Section className={index % 2 === 0 ? 'bg-white' : 'bg-bg-main'}>
      <SectionHeading
        eyebrow={t(content, 'eyebrow', lang)}
        title={t(content, 'title', lang)}
        intro={t(content, 'intro', lang)}
      />
      <FaqAccordion items={items} />
    </Section>
  );
}

/** Hand-built types: the full-bleed home page sections. */
const HOME_COMPONENTS = {
  hero: Hero,
  press_band: PressBand,
  feature_cards: FeatureCards,
  category_chips: CategoryChips,
  transformation: Transformation,
  promo_banner: PromoBanner,
  info_duo: InfoDuo,
  text_cta: TextCta,
  call_to_order_cards: CallToOrderCards,
  testimonials: Testimonials,
  faq_accordion: Faq,
};

/**
 * THE registry — one type vocabulary for the whole site.
 *
 * The hand-built home sections and the harvested types live in the same map, so
 * a `type` string in the data picks a component here regardless of which page
 * it came from. There is one renderer below and one future admin screen.
 *
 * An unknown type renders nothing rather than crashing, so a type can exist in
 * the data — or later in the database — before its component ships.
 */
export const SECTION_COMPONENTS = {
  ...HOME_COMPONENTS,
  ...BLOCK_COMPONENTS,
  article: GuideArticle,
  link_list: LinkList,
};

/** Home sections lay out their own full-bleed backgrounds; the rest are prose. */
const SELF_LAYOUT = new Set([...Object.keys(HOME_COMPONENTS), 'article']);
const WIDE = new Set([...WIDE_TYPES, 'link_list', 'hero_split']);

/**
 * Collapse runs of `card` sections into one grid.
 *
 * The harvester emits one `card` per Elementor icon-box, which is the honest
 * representation — but a column of single cards is not what the page looks
 * like. Grouping is a RENDER concern, so it happens here rather than being
 * baked into the data, where it would stop each card being an editable row.
 */
function group(sections) {
  const out = [];
  for (const section of sections) {
    const last = out[out.length - 1];
    if (section.type === 'card' && last?.kind === 'cards') {
      last.items.push(section.content);
      continue;
    }
    if (section.type === 'card') out.push({ kind: 'cards', items: [section.content] });
    else out.push({ kind: 'one', section });
  }
  return out;
}

/**
 * Render an ordered section array. Unknown types are skipped, not fatal.
 *
 * `demoteH1` is set by product pages, where the <h1> is already emitted by
 * ProductSummary and a level-1 heading in the data would be a second one.
 */
export default function Sections({ sections = [], lang, demoteH1 = false }) {
  if (!sections.length) return null;

  return group(sections).map((entry, index) => {
    if (entry.kind === 'cards') {
      return (
        <Container className="py-4" key={`cards-${index}`}>
          <div className="mx-auto max-w-5xl">
            <CardGrid items={entry.items} lang={lang} />
          </div>
        </Container>
      );
    }

    const { section } = entry;
    const Component = SECTION_COMPONENTS[section.type];
    if (!Component) return null;

    // Home sections and guide articles own their own width and background.
    if (SELF_LAYOUT.has(section.type)) {
      return (
        <Component
          content={section.content}
          index={index}
          key={`${section.type}-${index}`}
          lang={lang}
        />
      );
    }

    // Prose stays at a readable measure; grids and tables get more room.
    const width = WIDE.has(section.type) ? 'max-w-5xl' : 'max-w-3xl';
    return (
      <Container className="py-4" key={`${section.type}-${index}`}>
        <div className={`mx-auto ${width}`}>
          <Component content={section.content} demote={demoteH1} lang={lang} />
        </div>
      </Container>
    );
  });
}
