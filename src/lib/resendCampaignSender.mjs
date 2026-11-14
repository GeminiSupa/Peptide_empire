/**
 * Send one campaign email through Resend's HTTP API.
 *
 * Resend is only an OVERFLOW provider (see campaignProviders.mjs). The caller
 * has already built the per-recipient HTML, click tracking, open pixel and
 * one-click unsubscribe headers, so this just hands that same message to
 * Resend's /emails endpoint. A non-2xx response is thrown with the status on
 * `statusCode` and the raw body on `body`, so isQuotaExhausted() can tell a
 * "you're out of quota" (429/402) rollover from an ordinary failure.
 *
 * Inert until a Resend API key is set AND the sending domain is verified on
 * Resend (its SPF include + DKIM records added to DNS); without that, Resend
 * will refuse or the mail will fail authentication.
 */

export async function sendCampaignEmailViaResend(config, mail, fetchImpl = fetch) {
  const payload = {
    from: config.from || mail.from,
    to: Array.isArray(mail.to) ? mail.to : [mail.to],
    subject: mail.subject,
    html: mail.html,
    reply_to: mail.replyTo,
    headers: mail.headers,
  };
  if (mail.bcc) payload.bcc = mail.bcc;

  const response = await fetchImpl(`${config.baseUrl}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    // A non-JSON body (e.g. an HTML error page) still leaves us the status.
  }

  if (!response.ok) {
    const error = new Error(body?.message || body?.error?.message || `Resend HTTP ${response.status}`);
    error.statusCode = response.status;
    error.body = body ? JSON.stringify(body) : '';
    throw error;
  }

  return { id: body?.id || null };
}
