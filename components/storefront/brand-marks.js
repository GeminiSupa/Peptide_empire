/**
 * Review-platform marks drawn inline.
 *
 * Google and Trustpilot have real logo files mirrored into `public/`, so they
 * are rendered as images. Facebook has none, and a rating badge showing two
 * logos and one bare word reads as broken rather than as a choice — so its
 * mark is drawn here instead of leaving a gap.
 */
export function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        fill="#fff"
        d="M15.3 12.5h-2v6.4h-2.7v-6.4H9.1v-2.3h1.5V8.9c0-1.9 1.1-3 2.9-3 .8 0 1.6.1 1.6.1v1.8h-.9c-.9 0-1.2.6-1.2 1.2v1.2h2l-.3 2.3z"
      />
    </svg>
  );
}

/** A publication's name set as a wordmark, for press with no logo file. */
export function PressWordmark({ name }) {
  return <span className="press-name">{name}</span>;
}
