import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

/**
 * `npm run lint`. Next 16 removed `next lint`; this is the ESLint CLI with
 * Next's own rules, set up as the catalog (branch catalog) sets it up.
 */
export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // Same as the catalog: the app does not run the React Compiler, so its
      // diagnostics are noise here.
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react/no-unescaped-entities': 'off',
      // Catches an undeclared name before it takes a page down.
      'no-undef': 'error',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // The designer's prototype and harvested pages: reference files, not app code.
    'docs/**',
    'public/**',
    // Verbatim copies of catalog code (scripts/sync-catalog-checkout.mjs):
    // linted in the catalog, never edited here.
    'catalog/**',
    'app/(pay)/pay-card/**',
    'app/(pay)/pay-bank/**',
    'app/(pay)/order-confirmation/**',
    'app/api/orders/**',
    'app/api/chargx/**',
    'app/api/card-payment-link/**',
    'app/api/bank-payments/**',
    'app/api/analytics/**',
    'app/api/order-notification/**',
    'app/api/whatsapp/**',
    'lib/catalog-pricing/**',
  ]),
]);
