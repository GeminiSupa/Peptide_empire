import Container from '@/components/ui/container';

/**
 * Renders a long-form guide.
 *
 * Each guide is one self-contained HTML article — headings, tables, a table of
 * contents, inline links, and its own <style> scoped to a wrapper class. It is
 * injected as-is rather than decomposed into blocks, because decomposing it
 * would drop the inline markup and tables that make it a guide.
 *
 * The HTML is not arbitrary input: it comes from this client's own WordPress,
 * and scripts/harvest-guides.mjs strips <script>, iframes, on* handlers and
 * javascript: URLs at harvest time, then rewrites absolute URLs to local paths.
 * Sanitising there rather than here means it happens once, at build time, and
 * the shipped data is already clean.
 *
 * `.pcr-article` gives the injected markup sane defaults for anything the
 * guide's own scoped CSS does not cover — see globals.css.
 */
export default function GuideArticle({ content, lang, title }) {
  // A section in the shared vocabulary: `{ type: 'article', content: {…} }`.
  const html = content?.[`html_${lang}`] || content?.html_en;
  if (!html) return null;

  /**
   * WordPress keeps a page's title out of its body and lets the theme print it
   * as the <h1>. Most guides open with their own <h1>, but 24 of them do not,
   * and those shipped with no <h1> at all — the live pages have one.
   *
   * Checked against the injected markup rather than assumed, so a guide that
   * already opens with a heading does not get a duplicate.
   */
  const hasOwnH1 = /<h1[\s>]/i.test(html);

  return (
    <Container className="py-10 sm:py-14">
      <article className="pcr-article mx-auto max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_36px_rgba(9,39,113,0.06)] sm:p-8 lg:p-10" lang={lang}>
        {!hasOwnH1 && title && (
          <h1 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
            {title}
          </h1>
        )}
        {/* eslint-disable-next-line react/no-danger -- sanitised at harvest time */}
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </Container>
  );
}
