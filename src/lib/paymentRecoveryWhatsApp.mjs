import { insertWhatsAppMessage } from './whatsappMessageLog.js';
import { toE164, isValidE164, DEFAULT_PHONE_COUNTRY } from './phoneFormat.mjs';

const TIMEOUT_MS = 6000;

export async function sendPaymentRecoveryWhatsApp(supabase, order, retryUrl, { reminder = false } = {}) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = reminder
    ? process.env.WHATSAPP_PAYMENT_RECOVERY_REMINDER_TEMPLATE
    : process.env.WHATSAPP_PAYMENT_RECOVERY_TEMPLATE;
  if (!accessToken || !phoneNumberId || !templateName) return { sent: false, skipped: 'missing_template_or_config' };

  const phone = toE164(order?.customer_phone, DEFAULT_PHONE_COUNTRY);
  if (!isValidE164(phone)) return { sent: false, skipped: 'invalid_phone' };
  const language = order?.currency === 'USD' ? 'en' : 'es';
  const response = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: order.customer_name || (language === 'en' ? 'Customer' : 'Cliente') },
            { type: 'text', text: order.order_number },
            { type: 'text', text: retryUrl },
          ],
        }],
      },
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return { sent: false, error: result?.error?.message || `Meta ${response.status}` };
  const messageId = result.messages?.[0]?.id;
  if (messageId) {
    await insertWhatsAppMessage(supabase, {
      wa_id: phone,
      display_name: order.customer_name || 'Payment recovery',
      message_text: `${reminder ? 'Payment recovery reminder' : 'Payment recovery'} ${order.order_number}`,
      message_type: 'template', direction: 'outbound', source: 'cloud_api',
      matched_order_id: order.id || null, meta_message_id: messageId,
      delivery_status: 'sent', raw_payload: result,
    });
  }
  return { sent: true, messageId };
}
