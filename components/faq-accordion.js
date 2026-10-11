import { ChevronDown } from 'lucide-react';

/**
 * FAQ accordion — native <details>/<summary>, deliberately.
 *
 * Every answer is in the served HTML whether or not it is open. The previous
 * version was a client component that rendered ONLY the open panel, so a page
 * with five questions shipped one answer and hid four from crawlers. The live
 * site keeps them all in the DOM and collapses with CSS, so that was a real
 * regression against the page being cloned, not a styling difference.
 *
 * Also drops a client component and its hydration cost.
 *
 * The first item is open by default, matching the live site.
 */
export default function FaqAccordion({ items }) {
  if (!items?.length) return null;

  return (
    <div className="mx-auto mt-10 max-w-3xl divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-bg-card shadow-[0_10px_30px_rgba(9,39,113,0.05)]">
      {items.map((item, i) => (
        <details className="group" key={`${item.q}-${i}`} open={i === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-left transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
            <span className="text-base font-bold text-primary">{item.q}</span>
            <ChevronDown
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-accent transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="px-5 pb-5">
            <p className="text-sm leading-relaxed text-text-muted">{item.a}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
