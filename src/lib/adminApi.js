import { supabase } from '@/lib/supabase';

/**
 * Prefer a fresh access token. getSession() can return nothing (or a dead
 * session) after a background refresh race — common when several admin tabs
 * are open — and every adminFetch then threw "Not authenticated" before the
 * request left the browser. That showed up as "Could not reach the server"
 * on status changes, and as a logout once auth state caught up.
 */
async function resolveAccessToken({ forceRefresh = false } = {}) {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  if (!forceRefresh) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
  }

  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session?.access_token) {
    throw new Error('Your login expired. Sign in again, then retry.');
  }
  return data.session.access_token;
}

/** Attach the current Supabase session token to admin API requests. */
export async function getAdminAuthHeaders(extraHeaders = {}) {
  const token = await resolveAccessToken();

  return {
    ...extraHeaders,
    Authorization: `Bearer ${token}`,
  };
}

function withJsonContentType(headers, options) {
  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (hasBody && !isFormData && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

/** Authenticated fetch wrapper for /api/admin/* routes. */
export async function adminFetch(url, options = {}) {
  let headers = withJsonContentType(await getAdminAuthHeaders(options.headers || {}), options);
  let response = await fetch(url, { ...options, headers });

  // Expired JWT still sitting in local storage: refresh once and retry so a
  // mid-shift token expiry does not look like a network outage.
  if (response.status === 401 && supabase) {
    try {
      const token = await resolveAccessToken({ forceRefresh: true });
      headers = withJsonContentType({
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      }, options);
      response = await fetch(url, { ...options, headers });
    } catch {
      // Keep the original 401 — caller surfaces its body.
    }
  }

  return response;
}

/**
 * Delete something from the dashboard by moving it to the Bin.
 *
 * Use this instead of `supabase.from(table).delete()` in any admin screen. A
 * browser delete cannot write the Bin snapshot — `deleted_records` is
 * service-role only — so going direct is what makes a record unrecoverable.
 *
 * Throws with the server's own wording on failure, so call sites can surface
 * the reason (a foreign key still pointing at the row, usually) rather than a
 * generic "could not delete".
 */
export async function deleteToBin(table, ids, { reason = null, idColumn = 'id' } = {}) {
  const response = await adminFetch('/api/admin/recycle-bin/delete', {
    method: 'POST',
    body: JSON.stringify({ table, ids: Array.isArray(ids) ? ids : [ids], reason, idColumn }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Could not delete that.');
  }
  return data;
}
