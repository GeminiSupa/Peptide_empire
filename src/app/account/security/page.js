'use client';

import { useState } from 'react';
import Link from 'next/link';
import AccountShell from '../AccountShell';
import { useCustomerSession, useStorefrontLang } from '@/hooks/useCustomerSession';
import { getCustomerSupabase } from '@/lib/customerSupabase';
import { isRecentCustomerSignIn, passwordValidation } from '@/lib/customerPassword.mjs';

export default function AccountSecurityPage() {
  const { user } = useCustomerSession();
  const [lang] = useStorefrontLang();
  const en = lang === 'en';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reauth, setReauth] = useState(false);
  async function save(event) {
    event.preventDefault(); setError(''); setSuccess('');
    const invalid = passwordValidation(password, confirmation, lang);
    if (invalid) { setError(invalid); return; }
    setBusy(true);
    try {
      const client = getCustomerSupabase();
      if (!client) throw new Error();
      const verified = await client.auth.getUser();
      if (verified.error || !verified.data?.user?.email_confirmed_at) throw new Error();
      if (!isRecentCustomerSignIn(verified.data.user)) {
        setReauth(true);
        setError(en ? 'Verify your email again before changing your password.' : 'Verifique su correo de nuevo antes de cambiar la contraseña.');
        return;
      }
      const updated = await client.auth.updateUser({ password });
      if (updated.error) {
        setError(en ? 'Unable to update the password. Use a different password or verify your email again.' : 'No se pudo actualizar la contraseña. Use otra contraseña o verifique su correo de nuevo.');
        setReauth(true);
        return;
      }
      setPassword(''); setConfirmation('');
      const signedOut = await client.auth.signOut({ scope: 'others' });
      setSuccess(signedOut.error
        ? (en ? 'Password updated. We could not sign out other devices; please retry below.' : 'Contraseña actualizada. No pudimos cerrar las otras sesiones; reintente abajo.')
        : (en ? 'Password updated. Other device sessions have been signed out.' : 'Contraseña actualizada. Se cerraron las sesiones de otros dispositivos.'));
    } catch { setError(en ? 'Unable to update your password. Please sign in again and retry.' : 'No se pudo actualizar la contraseña. Inicie sesión de nuevo y reintente.'); }
    finally { setBusy(false); }
  }
  return <AccountShell title={{ en: 'Login & security', es: 'Acceso y seguridad' }}>
    <section className="account-card"><h2>{en ? 'Your sign-in email' : 'Su correo de acceso'}</h2><p>{user?.email}</p><p className="account-muted">{en ? 'You can sign in using a password or an email code. Contact support to change your login email.' : 'Puede iniciar sesión con contraseña o código de correo. Contacte a soporte para cambiar su correo de acceso.'}</p></section>
    <section className="account-card"><h2>{en ? 'Set or change your password' : 'Crear o cambiar contraseña'}</h2><p>{en ? 'Use 12–128 characters. A long, unique password works best.' : 'Use entre 12 y 128 caracteres. Elija una contraseña larga y única.'}</p>
      <form onSubmit={save}>
        <input type="email" autoComplete="username" value={user?.email || ''} readOnly hidden aria-hidden="true" />
        <div className="account-field"><label htmlFor="new-password">{en ? 'New password' : 'Nueva contraseña'}</label><input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /></div>
        <div className="account-field"><label htmlFor="confirm-password">{en ? 'Confirm new password' : 'Confirmar nueva contraseña'}</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></div>
        {error && <p className="account-notice is-error" role="alert">{error}</p>}
        {success && <p className="account-notice" role="status">{success}</p>}
        {reauth && <p><Link href="/account/login?mode=code&reauth=1&next=%2Faccount%2Fsecurity">{en ? 'Verify with an email code' : 'Verificar con código de correo'}</Link></p>}
        <button className="account-btn-primary" disabled={busy}>{busy ? (en ? 'Saving…' : 'Guardando…') : (en ? 'Save password' : 'Guardar contraseña')}</button>
      </form>
    </section>
  </AccountShell>;
}
