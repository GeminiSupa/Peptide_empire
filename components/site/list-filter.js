'use client';

import Ms from '@/components/storefront/icon';

/**
 * A search box that hides the elements matching `target` whose text does not
 * contain what is typed. The list itself is server-rendered and complete.
 */
export default function ListFilter({ target, placeholder }) {
  const onInput = (event) => {
    const q = event.target.value.trim().toLowerCase();
    document.querySelectorAll(target).forEach((el) => {
      el.hidden = Boolean(q) && !el.textContent.toLowerCase().includes(q);
    });
  };
  return (
    <label className="search">
      <Ms name="search" />
      <input type="search" placeholder={placeholder} aria-label={placeholder} onInput={onInput} />
    </label>
  );
}
