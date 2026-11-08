'use client';

import { useState } from 'react';
import { pushEvent } from '@/lib/site/analytics.mjs';
import { subscribeNewsletter } from '@/lib/site/crm.mjs';

/**
 * The footer's newsletter signup. The address goes to the catalog's
 * `/api/newsletter` (its `email_subscribers` list, which the email campaigns
 * send to), through this site's relay. Fires GA4 `newsletter_signup`.
 * `labels` arrive translated from the server footer.
 */
export default function NewsletterForm({ labels }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | busy | done | error

  async function submit(event) {
    event.preventDefault();
    if (state === 'busy' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setState('error');
      return;
    }
    setState('busy');
    const result = await subscribeNewsletter(email.trim());
    if (result.ok) {
      setState('done');
      if (!result.already) pushEvent({ event: 'newsletter_signup', form_name: 'footer_newsletter' });
    } else {
      setState('error');
    }
  }

  if (state === 'done') return <p className="fnews-ok">{labels.done}</p>;

  return (
    <form className="fnews" onSubmit={submit} noValidate>
      <b>{labels.title}</b>
      <div>
        <input
          type="email"
          autoComplete="email"
          aria-label={labels.placeholder}
          placeholder={labels.placeholder}
          value={email}
          onChange={(event) => { setEmail(event.target.value); if (state === 'error') setState('idle'); }}
        />
        <button type="submit" disabled={state === 'busy'}>{labels.button}</button>
      </div>
      {state === 'error' ? <small>{labels.error}</small> : null}
    </form>
  );
}
