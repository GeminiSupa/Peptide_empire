import Link from 'next/link';
import { Check } from 'lucide-react';
import Container from '@/components/ui/container';
import FaqAccordion from '@/components/faq-accordion';
import { t } from '@/lib/i18n';
import { imageUrl } from '@/lib/images';
import { localePath } from '@/lib/routes';

/**
 * Renderer for the generic block vocabulary produced by the page harvesters:
 * heading · paragraph · list · button · image · card · faq.
 *
 * Deliberately generic. The 93 city pages come in three structural variants and
 * the guides and product landers are built from the same Elementor widgets, so
 * one block list renders all of them — rather than a component per template.
 *
 * As in components/sections, an unknown block type renders nothing instead of
 * crashing, so harvested data can lead the code.
 */

const listItems = (block, key, lang) => block[`${key}_${lang}`] || block[`${key}_en`] || [];

function Heading({ block, lang }) {
  const text = t(block, 'text', lang);
  if (!text) return null;

  // h1 opens the page; the rest are section headings within it.
  if (block.level === 1) {
    return (
      <h1 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl lg:text-[2.75rem]">
        {text}
      </h1>
    );
  }
  const Tag = `h${Math.min(Math.max(block.level || 2, 2), 6)}`;
  const size =
    block.level === 2
      ? 'mt-12 text-2xl font-bold sm:text-[1.75rem]'
      : 'mt-8 text-lg font-semibold sm:text-xl';
  return <Tag className={`${size} text-primary`}>{text}</Tag>;
}

function Paragraph({ block, lang }) {
  const text = t(block, 'text', lang);
  if (!text) return null;
  return <p className="mt-4 text-base leading-relaxed text-text-main">{text}</p>;
}

function BlockList({ block, lang }) {
  const items = listItems(block, 'items', lang);
  if (!items.length) return null;

  if (block.icon) {
    return (
      <ul className="mt-6 flex flex-wrap gap-3">
        {items.map((item) => (
          <li
            key={item}
            className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm"
          >
            <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    );
  }

  const Tag = block.ordered ? 'ol' : 'ul';
  return (
    <Tag
      className={`mt-4 space-y-2 pl-5 text-base leading-relaxed text-text-main ${
        block.ordered ? 'list-decimal' : 'list-disc'
      }`}
    >
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </Tag>
  );
}

function BlockButton({ block, lang }) {
  const text = t(block, 'text', lang);
  if (!text || !block.href) return null;
  const external = /^https?:\/\//i.test(block.href);
  const href = external ? block.href : localePath(block.href, lang);
  const className =
    'mt-8 inline-flex items-center justify-center rounded-full bg-accent px-7 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-110';

  if (external) {
    return (
      <a className={className} href={href} rel="noopener noreferrer" target="_blank">
        {text}
      </a>
    );
  }
  return (
    <Link className={className} href={href}>
      {text}
    </Link>
  );
}

function BlockImage({ block, lang }) {
  const src = imageUrl(block.src);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- harvested content
    // images have no known intrinsic size; next/image would need one per file.
    <img
      alt={t(block, 'alt', lang)}
      className="mt-8 h-auto w-full max-w-2xl rounded-xl"
      loading="lazy"
      src={src}
    />
  );
}

/** Consecutive `card` blocks render as one grid rather than a stack. */
function CardGrid({ blocks, lang }) {
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {blocks.map((block, i) => {
        const title = t(block, 'title', lang);
        const body = (
          <>
            <h3 className="text-base font-bold text-primary">{title}</h3>
            {t(block, 'text', lang) && (
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{t(block, 'text', lang)}</p>
            )}
          </>
        );
        const shell =
          'flex h-full flex-col rounded-xl border border-primary/10 bg-white p-5 shadow-sm';
        return block.href ? (
          <Link
            className={`${shell} transition hover:border-primary/30 hover:shadow-md`}
            href={localePath(block.href, lang)}
            key={`${title}-${i}`}
          >
            {body}
          </Link>
        ) : (
          <div className={shell} key={`${title}-${i}`}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

function Faq({ block, lang }) {
  if (!block.items?.length) return null;
  // FaqAccordion is a client component and takes resolved strings, so the
  // language is applied here rather than passed down.
  const items = block.items.map((item) => ({
    q: t(item, 'q', lang),
    a: t(item, 'a', lang),
  }));
  return <FaqAccordion items={items} />;
}

const RENDERERS = {
  heading: Heading,
  paragraph: Paragraph,
  list: BlockList,
  button: BlockButton,
  image: BlockImage,
  faq: Faq,
};

/** Collapse runs of `card` blocks into a single grid entry. */
function group(blocks) {
  const out = [];
  for (const block of blocks) {
    const last = out[out.length - 1];
    if (block.type === 'card' && last?.kind === 'cards') {
      last.blocks.push(block);
      continue;
    }
    if (block.type === 'card') out.push({ kind: 'cards', blocks: [block] });
    else out.push({ kind: 'block', block });
  }
  return out;
}

export default function Blocks({ blocks = [], lang }) {
  if (!blocks.length) return null;
  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        {group(blocks).map((entry, i) => {
          if (entry.kind === 'cards') {
            return <CardGrid blocks={entry.blocks} key={`cards-${i}`} lang={lang} />;
          }
          const Renderer = RENDERERS[entry.block.type];
          if (!Renderer) return null;
          return <Renderer block={entry.block} key={`${entry.block.type}-${i}`} lang={lang} />;
        })}
      </div>
    </Container>
  );
}
