import { catalogUrl } from '@/lib/storefront/catalog-origin.mjs';
import { relayFor } from '@/lib/site/catalog-relay.mjs';

/**
 * Server-to-server relay to the catalog's public endpoints (see
 * lib/site/catalog-relay.mjs for which, and why).
 */
export const dynamic = 'force-dynamic';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request, { params }) {
  const { endpoint } = await params;
  const relay = relayFor(endpoint);
  if (!relay) return json({ error: 'Not found' }, 404);

  const raw = await request.text().catch(() => '');
  if (!raw || raw.length > relay.maxBytes) return json({ error: 'Bad request' }, 400);

  let body;
  try {
    body = relay.body(JSON.parse(raw));
  } catch {
    body = null;
  }
  if (!body) return json({ error: 'Bad request' }, 400);

  const forwarded = request.headers.get('x-forwarded-for');
  try {
    const response = await fetch(catalogUrl(relay.path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': request.headers.get('user-agent') || 'peptidescostarica-website',
        ...(forwarded ? { 'X-Forwarded-For': forwarded } : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json().catch(() => ({}));
    return json(relay.reply(data), response.status);
  } catch (error) {
    console.warn(`[catalog relay] ${endpoint} failed:`, error?.message || error);
    return json({ error: 'Catalog unavailable' }, 502);
  }
}
