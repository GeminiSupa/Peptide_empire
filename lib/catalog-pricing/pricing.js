// The catalog names its pricing module `pricing.js`; here it is vendored as
// `pricing.mjs` (see README). `authoritativeCheckout.mjs` is copied verbatim
// and imports './pricing.js', so this re-export is what lets it stay
// byte-identical to the catalog's copy.
export * from './pricing.mjs';
