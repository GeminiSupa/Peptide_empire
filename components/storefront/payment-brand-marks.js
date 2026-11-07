/** The same payment marks shown by the catalog's card option. */
export default function CardBrandMarks() {
  return (
    <span className="payment-brand-row" aria-hidden="true">
      <svg viewBox="0 0 48 24" focusable="false">
        <rect width="48" height="24" rx="4" fill="#1434CB" />
        <text x="24" y="16.4" textAnchor="middle" fill="#fff" fontFamily="Arial, Helvetica, sans-serif" fontSize="11" fontWeight="800" fontStyle="italic" letterSpacing="0.6">VISA</text>
      </svg>
      <svg viewBox="0 0 38 24" focusable="false">
        <rect width="38" height="24" rx="4" fill="#fff" stroke="#D0D5DD" />
        <circle cx="15" cy="12" r="6.5" fill="#EB001B" />
        <circle cx="23" cy="12" r="6.5" fill="#F79E1B" />
        <clipPath id="website-card-brand-mc-clip"><circle cx="15" cy="12" r="6.5" /></clipPath>
        <circle cx="23" cy="12" r="6.5" fill="#FF5F00" clipPath="url(#website-card-brand-mc-clip)" />
      </svg>
      <svg viewBox="0 0 58 24" focusable="false">
        <rect width="58" height="24" rx="4" fill="#000" />
        <g transform="translate(6, 4.2) scale(0.9)">
          <path fill="#fff" d="M13.3 5.7c-.1.1-1.6.9-1.6 2.8 0 2.2 1.9 3 2 3-.1.1-.3 1.1-1.1 2.1-.7.9-1.4 1.8-2.5 1.8-1.1 0-1.4-.6-2.6-.6s-1.6.6-2.6.6c-1 0-1.9-.9-2.6-1.9C1.1 12 0 9.3 0 6.8 0 4.4 1.5 3.1 3 3.1c1.1 0 2 .7 2.6.7.6 0 1.7-.8 2.9-.7.5 0 1.9.2 2.8 1.5zM9.6 2.1c.5-.6.9-1.5.8-2.3-.8 0-1.7.5-2.2 1.2-.5.6-.9 1.5-.8 2.3.9.1 1.7-.4 2.2-1.2z" />
        </g>
        <text x="52" y="16" textAnchor="end" fill="#fff" fontFamily="Segoe UI, Arial, sans-serif" fontSize="11" fontWeight="600">Pay</text>
      </svg>
      <svg viewBox="0 0 58 24" focusable="false">
        <rect x="0.5" y="0.5" width="57" height="23" rx="4" fill="#fff" stroke="#D0D5DD" />
        <g transform="translate(5, 4) scale(0.66)">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </g>
        <text x="53" y="16" textAnchor="end" fill="#3C4043" fontFamily="Arial, Helvetica, sans-serif" fontSize="11" fontWeight="600">Pay</text>
      </svg>
    </span>
  );
}
