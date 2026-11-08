'use client';

import { useEffect } from 'react';
import { listViewData, pushEvent } from '@/lib/site/analytics.mjs';

/**
 * Fires GA4 `view_item_list` once for the list on screen, and again whenever
 * the list changes (a different shelf or category), as the catalog does.
 */
export default function ListViewEvent({ listName, compounds }) {
  const key = `${listName}|${(compounds || []).map((compound) => compound.slug).join(',')}`;
  useEffect(() => {
    if (!compounds?.length) return;
    pushEvent({ event: 'view_item_list', ecommerce: listViewData(compounds, listName) });
    // `key` stands for the list's contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
