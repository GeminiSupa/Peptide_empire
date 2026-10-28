export function conversionEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  return email;
}
export function conversionPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 8) digits = '506' + digits;
  if (!/^[1-9]\d{7,14}$/.test(digits)) return '';
  return '+' + digits;
}
export function hashableEmail(value) {
  const email = conversionEmail(value);
  const [local, domain] = email.split('@');
  return domain === 'gmail.com' || domain === 'googlemail.com' ? local.replace(/\./g, '') + '@' + domain : email;
}
