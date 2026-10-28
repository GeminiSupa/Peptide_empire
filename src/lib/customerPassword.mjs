export function passwordValidation(password, confirmation, lang = 'es') {
  const en = lang === 'en';
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) return en ? 'Use a password between 12 and 128 characters.' : 'Use una contraseña de entre 12 y 128 caracteres.';
  if (password !== confirmation) return en ? 'The passwords do not match.' : 'Las contraseñas no coinciden.';
  return null;
}

export function isRecentCustomerSignIn(user, now = Date.now()) {
  const signedInAt = Date.parse(user?.last_sign_in_at || '');
  return Number.isFinite(signedInAt) && signedInAt <= now && now - signedInAt <= 10 * 60 * 1000;
}
