/**
 * Whether search engines may index this deployment.
 *
 * This is a replica of a site that is currently live. While both exist, an
 * indexed replica competes with the real site for its own keywords, so the
 * default is BLOCKED and staying blocked is the safe failure mode — a missing
 * or misspelled env var keeps the replica invisible rather than exposing it.
 *
 * Flipping it is a deployment setting, not a code change: set
 * NEXT_PUBLIC_ALLOW_INDEXING=true in the Vercel project at the moment the real
 * domain cuts over to this build. app/robots.js and the metadata in
 * app/layout.js both read this, so the two can no longer disagree — previously
 * they were a static file and a hardcoded object that had to be edited in
 * lockstep by hand.
 */
export const ALLOW_INDEXING = process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://peptidescostarica.net';
