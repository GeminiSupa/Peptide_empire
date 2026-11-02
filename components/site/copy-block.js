import Link from 'next/link';
import Faq from '@/components/site/faq';
import { pathHref } from '@/lib/site/links.mjs';

/** Icons for the live copy's item lists, in the prototype's order. */
const ITEM_ICONS = ['science', 'history', 'lab_profile', 'inventory', 'verified', 'local_shipping', 'payments', 'support_agent'];

/**
 * One block of a live page's copy (lib/site/live-copy.mjs), laid out as a
 * prototype section: its heading, its paragraphs as prose, its items as
 * feature tiles, its FAQ as the accordion, and its links as buttons. `heading` replaces the block's
 * own title when a template names the section itself.
 */
export default function CopyBlock({ block, heading, t, lang = 'en' }) {
  // Harvested links are English paths; a Spanish page links the Spanish twin.
  const href = (path) => (lang === 'es' && path.startsWith('/') && !path.startsWith('/es/') ? pathHref(path, 'es') : path);
  return (
    <section className="psec">
      {heading ?? (block.title ? <h2>{block.title}</h2> : null)}
      {block.paras.length ? (
        <div className="prose">{block.paras.map((para) => <p key={para}>{para}</p>)}</div>
      ) : null}
      {block.items.length ? (
        <div className="feat">
          {block.items.map((item, index) => (
            <div key={`${item.title}${item.text}`}>
              <span className="ms">{ITEM_ICONS[index % ITEM_ICONS.length]}</span>
              {item.title ? <b>{item.title}</b> : null}
              <small>{item.text}</small>
            </div>
          ))}
        </div>
      ) : null}
      {block.faq?.length ? <Faq items={block.faq} /> : null}
      {block.links.length ? (
        <p className="hctas">
          {block.links.map((link) => (
            <Link className="btn ghost" href={href(link.href)} key={link.href}>{t(link.text)}</Link>
          ))}
        </p>
      ) : null}
    </section>
  );
}

