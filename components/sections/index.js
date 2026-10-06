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
import { imageUrl } from '@/lib/images';

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

function PressShowcase({ content, lang }) {
  const items = content.items || [];

  return (
    <section className="bg-white py-14 sm:py-16 lg:py-20">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-5">
        <div className="flex items-center gap-5 sm:gap-8">
          <span aria-hidden="true" className="h-px flex-1 bg-primary/25" />
          <p className="shrink-0 text-sm font-extrabold tracking-[0.18em] text-primary uppercase sm:text-base">
            {t(content, 'eyebrow', lang)}
          </p>
          <span aria-hidden="true" className="h-px flex-1 bg-primary/25" />
        </div>

        <div className="mx-auto mt-5 max-w-2xl text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
            {t(content, 'title', lang)}
          </h2>
          <p className="mt-3 text-base leading-7 text-text-muted">
            {t(content, 'intro', lang)}
          </p>
        </div>

        <div className="mt-9 grid gap-5 md:grid-cols-2 lg:gap-7">
          {items.map((item, index) => (
            <article
              className="group relative flex min-h-[285px] flex-col overflow-hidden rounded-2xl border border-primary/15 bg-[linear-gradient(145deg,#ffffff_0%,#f5f7fc_100%)] p-6 shadow-[0_14px_40px_rgba(9,39,113,0.09)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(9,39,113,0.14)] sm:p-8"
              key={`${item.outlet_en}-${index}`}
            >
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-accent" />
              <div className="flex min-h-24 items-center justify-center rounded-xl border border-slate-200/80 bg-white px-6 py-4 shadow-sm">
                <img
                  alt={t(item, 'logoAlt', lang)}
                  className="h-auto max-h-16 w-auto max-w-full object-contain sm:max-h-20"
                  loading="lazy"
                  src={imageUrl(item.logo)}
                  style={{ maxWidth: item.logoWidth || '260px' }}
                />
              </div>

              <div className="mt-6 flex flex-1 flex-col items-center text-center">
                <p className="text-sm font-semibold tracking-wide text-text-muted uppercase">
                  {t(item, 'kicker', lang)}
                </p>
                <h3 className="mt-1 text-xl font-extrabold text-primary sm:text-2xl">
                  {t(item, 'outlet', lang)}
                </h3>
                <a
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  href={item.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {t(content, 'cta', lang)}
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
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
      {/* NOT complete. The live site renders six Google reviews here through the
          Trustindex plugin, which injects them client-side — so they are absent
          from both the REST content and the server HTML the harvester reads,
          which is why this looked like a bare heading block.
          Mirroring them is a live-data decision, not a harvesting one: the
          plugin refreshes from Google, so a static snapshot would keep showing
          reviews after they are edited or removed at the source. Left out
          pending that call. */}
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

/**
 * A harvested Elementor container — the block type that carries the site's
 * actual layout.
 *
 * Everything it renders comes from the live page's own stylesheet: whether the
 * children sit in a row or a column, how wide each column is, what the section
 * is painted, which boxes are cards. See scripts/lib/elementor-css.mjs.
 *
 * Two responsibilities, because one Elementor container has both: the element
 * is a flex ITEM in its parent row (its `width` share) and a flex CONTAINER for
 * its own children.
 *
 * Rows collapse to a stack below `lg`, which is what the live site's own
 * `--flex-wrap-mobile:wrap` does. The harvest deliberately keeps only the
 * desktop arrangement, so this is where responsiveness is reintroduced.
 */
const JUSTIFY = {
  center: 'justify-center',
  'flex-start': 'justify-start',
  'flex-end': 'justify-end',
  'space-between': 'justify-between',
  'space-around': 'justify-around',
};
const ITEMS = {
  center: 'items-center',
  'flex-start': 'items-start',
  'flex-end': 'items-end',
  stretch: 'items-stretch',
};

/** Elementor's own default container gap, applied when the page declares none. */
const DEFAULT_GAP = 20;

function Group({ content, lang, demote, depth = 0, inRow = false }) {
  const {
    dir = 'column',
    width,
    bg,
    bgImage,
    bgOverlay,
    color,
    radius,
    border,
    gap,
    justify,
    items,
    pad,
    contentWidth,
    minHeight,
    marginTop,
    order,
    hide,
    cols,
    copyWidth,
    children = [],
  } = content;

  const kids = children.map((child, i) => {
    const Component = SECTION_COMPONENTS[child.type];
    if (!Component) return null;
    const el = (
      <Component
        content={child.content}
        demote={demote}
        depth={depth + 1}
        inGroup
        inRow={dir === 'row'}
        lang={lang}
      />
    );
    // A group paints its own box, so order and visibility belong on that box.
    // A widget has no layout box of its own — wrapping it is what makes
    // `order: -99999` pull the Tico Times logo above the caption beside it.
    const childOrder = child.content?.order;
    const childHide = child.content?.hide;
    if (child.type !== 'group' && (childOrder != null || childHide)) {
      return (
        <div
          className={childHide || undefined}
          key={`${child.type}-${i}`}
          style={childOrder != null ? { order: childOrder } : undefined}
        >
          {el}
        </div>
      );
    }
    return (
      <Component
        content={child.content}
        demote={demote}
        depth={depth + 1}
        inGroup
        inRow={dir === 'row'}
        key={`${child.type}-${i}`}
        lang={lang}
      />
    );
  });

  const layout = [
    'flex',
    dir === 'row' ? 'flex-col lg:flex-row' : 'flex-col',
    JUSTIFY[justify] ?? '',
    ITEMS[items] ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const flexStyle = { gap: `${gap ?? DEFAULT_GAP}px` };
  const paint = {
    backgroundColor: bg || undefined,
    backgroundImage: bgImage
      ? `${bgOverlay ? `${bgOverlay}, ` : ''}url(${imageUrl(bgImage)})`
      : undefined,
    backgroundSize: bgImage ? 'cover' : undefined,
    backgroundPosition: bgImage ? 'center' : undefined,
    borderRadius: radius ? `${radius}px` : undefined,
    border: border ? `1px solid ${border}` : undefined,
    minHeight: minHeight ? `${minHeight}px` : undefined,
    marginTop: marginTop ? `${marginTop}px` : undefined,
    padding: pad ? pad.map((n) => `${n}px`).join(' ') : undefined,
    order: order != null ? order : undefined,
    color: color || undefined,
  };

  const body = copyWidth ? (
    <div
      className="flex w-full flex-col"
      data-copy-width=""
      style={{ '--copy-width': `${copyWidth}%`, gap: `${gap ?? DEFAULT_GAP}px` }}
    >
      {kids}
    </div>
  ) : (
    kids
  );

  // A top-level container is a BAND: it paints edge to edge while its children
  // stay in the middle column. That split — outer paints, inner measures — is
  // what `e-con-boxed` means, and it is why the navy sections on the live site
  // run the full width of the window with centred content inside them.
  if (depth === 0) {
    return (
      <section className={hide || undefined} style={paint}>
        <div
          className={`mx-auto w-full px-4 sm:px-5 ${layout}`}
          // The cap applies whether or not the container is "boxed". On the live
          // site even a full-width container is bounded by the theme's own
          // ~1249px content wrapper, so letting one span a 2560px monitor would
          // be wider than the original ever gets. The paint is on the <section>
          // above, which is what lets a navy band still reach both edges.
          style={{
            ...flexStyle,
            maxWidth: `${contentWidth ?? 1280}px`,
            ...(cols ? { '--cols': cols } : null),
          }}
          {...(cols ? { 'data-grid': '' } : null)}
        >
          {body}
        </div>
      </section>
    );
  }

  return (
    <div
      className={`${layout} min-w-0 ${hide ?? ''} ${width ? 'w-full lg:w-auto' : ''} ${
        // Elementor lets a column omit its width and take an equal share of the
        // row. Without this the two halves of "Who This Is For" sized themselves
        // to their content and came out 322px against 893px instead of level.
        inRow && !width ? 'lg:flex-1 lg:basis-0' : ''
      }`}
      style={{
        ...paint,
        ...flexStyle,
        // The width is a share of the parent ROW, so it must not apply once the
        // row has stacked. `flexBasis` is read only while `lg:flex-row` is on.
        ...(width ? { '--gw': `${width}%` } : null),
        ...(cols ? { '--cols': cols } : null),
      }}
      {...(width ? { 'data-col': '' } : null)}
      {...(cols ? { 'data-grid': '' } : null)}
    >
      {body}
    </div>
  );
}

/** Hand-built types: the full-bleed home page sections. */
const HOME_COMPONENTS = {
  hero: Hero,
  press_band: PressBand,
  press_showcase: PressShowcase,
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
  group: Group,
  ...BLOCK_COMPONENTS,
  article: GuideArticle,
  link_list: LinkList,
};

/** Home sections lay out their own full-bleed backgrounds; the rest are prose. */
// `group` carries its own width, padding and background straight from the live
// page's stylesheet, so wrapping it in this file's prose measure would override
// the very thing it exists to reproduce.
const SELF_LAYOUT = new Set([...Object.keys(HOME_COMPONENTS), 'article', 'group']);
// press_band draws its own full-width rules.
const WIDE = new Set([...WIDE_TYPES, 'link_list', 'hero_split', 'press_band']);

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

    if (section.type === 'card') {
      if (last?.kind === 'cards') last.items.push(section.content);
      else out.push({ kind: 'cards', items: [section.content] });
      continue;
    }

    // Consecutive product grids merge into ONE grid, so a run of small grids
    // reads as a continuous wall of cards rather than a series of orphan rows.
    //
    // This applies only to grids that are genuinely adjacent in the page. The
    // eight "Shop By Category" grids LOOKED adjacent but are the panels of a tab
    // widget, and merging them produced one 27-product block where the live site
    // shows four at a time — they are now folded into a `category_tabs` section
    // by the harvester before they ever reach this function.
    if (section.type === 'product_grid') {
      if (last?.kind === 'products') last.products.push(...section.content.products);
      else out.push({ kind: 'products', products: [...section.content.products] });
      continue;
    }

    out.push({ kind: 'one', section });
  }
  return out;
}

/**
 * Render an ordered section array. Unknown types are skipped, not fatal.
 *
 * `demoteH1` is set by product pages, where the <h1> is already emitted by
 * ProductSummary and a level-1 heading in the data would be a second one.
 */
/**
 * @param {string} [pageTitle] The page's own title. Passed to renderers that
 *   need it because WordPress stores a title outside the body and lets the
 *   theme print it — see GuideArticle, where 24 guides had no <h1> without it.
 */
export default function Sections({ sections = [], lang, demoteH1 = false, pageTitle }) {
  if (!sections.length) return null;

  return group(sections).map((entry, index) => {
    if (entry.kind === 'cards') {
      return (
        <Container className="py-2" key={`cards-${index}`}>
          <div className="mx-auto max-w-5xl">
            <CardGrid items={entry.items} lang={lang} />
          </div>
        </Container>
      );
    }

    if (entry.kind === 'products') {
      const merged = { type: 'product_grid', content: { products: entry.products } };
      const Grid = SECTION_COMPONENTS.product_grid;
      return (
        <Container className="py-2" key={`products-${index}`}>
          <div className="mx-auto max-w-5xl">
            <Grid content={merged.content} lang={lang} />
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
          demote={demoteH1}
          index={index}
          key={`${section.type}-${index}`}
          lang={lang}
          title={pageTitle}
        />
      );
    }

    // Prose stays at a readable measure; grids and tables get more room.
    const width = WIDE.has(section.type) ? 'max-w-5xl' : 'max-w-3xl';
    return (
      <Container className="py-2" key={`${section.type}-${index}`}>
        <div className={`mx-auto ${width}`}>
          <Component content={section.content} demote={demoteH1} lang={lang} />
        </div>
      </Container>
    );
  });
}
