export const BANK_SETTINGS_ID = 'bac_payment_settings';
export const isBankMethod = method => ['sinpe', 'bank_transfer'].includes(method);

export function normalizeBankSettings(input = {}) {
  const text = key => String(input?.[key] || '').trim().slice(0, 160);
  return {
    recipient: text('recipient'), legalId: text('legalId'),
    sinpePhone: text('sinpePhone').replace(/\D/g, '').replace(/^506(?=\d{8}$)/, ''),
    ibanCrc: text('ibanCrc').replace(/\s/g, '').toUpperCase(),
    sinpeEnabled: input?.sinpeEnabled === true,
    transferEnabled: input?.transferEnabled === true,
  };
}

export function bankAvailability(input) {
  const s = normalizeBankSettings(input);
  const recipientReady = Boolean(s.recipient && s.legalId);
  return {
    sinpe: recipientReady && /^[6-8]\d{7}$/.test(s.sinpePhone) && s.sinpeEnabled,
    bank_transfer: recipientReady && validCostaRicaIban(s.ibanCrc) && s.transferEnabled,
  };
}

export function validCostaRicaIban(value) {
  if (!/^CR\d{20}$/.test(value)) return false;
  const digits = (value.slice(4) + value.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

export async function readBankSettings(db) {
  const { data, error } = await db.from('site_settings').select('value').eq('id', BANK_SETTINGS_ID).maybeSingle();
  if (error) throw new Error('Could not load bank payment settings');
  return normalizeBankSettings(data?.value);
}

export function bankPaymentSnapshot(settings, order) {
  const s = normalizeBankSettings(settings);
  const amount = Number(order.total_crc);
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Invalid bank payment amount');
  return {
    bank: 'BAC', recipient: s.recipient, legalId: s.legalId,
    destination: order.payment_method === 'sinpe' ? s.sinpePhone : s.ibanCrc,
    method: order.payment_method, currency: 'CRC', amount,
    reference: order.order_number,
  };
}
