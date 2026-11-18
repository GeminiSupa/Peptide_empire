import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { SITE_SCOPED_TABLES } from '@/lib/sites.mjs';

/**
 * A Supabase admin client that keeps one country's data separate from another's.
 *
 * The admin runs every country from one database, so almost every table carries
 * a `site_id`. Rather than add `.eq('site_id', …)` to the hundreds of queries
 * spread across the admin's API routes, a route swaps its client for this one:
 *
 *     const supabase = scopedAdmin(auth.activeSite);
 *
 * and every read, update and delete it makes against a country-scoped table
 * (orders, leads, carts, customers…) is silently limited to the active country,
 * and every insert is stamped with it. Shared tables (blogs, product reviews,
 * admin profiles…) are untouched.
 *
 * `activeSite` of null is the superadmin's "All countries" view: the plain
 * client is returned and nothing is filtered. Routes therefore behave exactly
 * as before for a single-country database or the all-countries view, and gain
 * separation automatically once a country is chosen.
 */
export function scopedAdmin(activeSite) {
  const base = getSupabaseAdmin();
  if (!activeSite) return base;
  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table) => {
          const builder = target.from(table);
          return SITE_SCOPED_TABLES.has(table) ? wrapBuilder(builder, table, activeSite) : builder;
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/** Stamp `site_id` onto a row (or each row) being written, without clobbering a deliberate one. */
function stamp(rows, site) {
  if (Array.isArray(rows)) return rows.map((row) => ({ site_id: site, ...row }));
  if (rows && typeof rows === 'object') return { site_id: site, ...rows };
  return rows;
}

/**
 * Wrap one table's query builder so that:
 *  - select / update / delete are narrowed to this country (`.eq('site_id', …)`),
 *  - insert / upsert stamp the country onto the rows.
 * Everything else passes straight through.
 */
function wrapBuilder(builder, table, site) {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === 'select' || prop === 'delete') {
        return (...args) => target[prop](...args).eq('site_id', site);
      }
      if (prop === 'update') {
        return (values, options) => target.update(values, options).eq('site_id', site);
      }
      if (prop === 'insert' || prop === 'upsert') {
        return (rows, options) => target[prop](stamp(rows, site), options);
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
