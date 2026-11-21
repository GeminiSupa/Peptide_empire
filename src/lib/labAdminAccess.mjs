/**
 * What a lab's login actually is, for the owner's Lab partners panel.
 *
 * Reports only what can be verified from the rows: whether the lab is linked to
 * a login, and whether that login is a real lab-tier account. It never infers
 * anything and never changes anything — the route decides what to do with it.
 *
 * Relative imports only, so `node --test` can load it.
 */

import { isActiveProfile, isLabTier } from './subUserTier.mjs';

/**
 * loginState:
 *   'no_login'        nobody signs in as this lab
 *   'lab_login'       a lab-tier login, the only kind /lab accepts
 *   'not_lab_login'   linked to an account that is NOT tier lab (refused by /lab)
 *   'missing_profile' linked to a user with no admin_profiles row (refused too)
 */
export function describeLabLogin(lab, profiles = []) {
  const userId = lab?.admin_profile_user_id || null;
  if (!userId) {
    return { loginState: 'no_login', userId: null, loginEmail: null, loginActive: false };
  }
  const profile = (profiles || []).find((row) => row?.user_id === userId) || null;
  if (!profile) {
    return { loginState: 'missing_profile', userId, loginEmail: null, loginActive: false };
  }
  return {
    loginState: isLabTier(profile) ? 'lab_login' : 'not_lab_login',
    userId,
    loginEmail: profile.email || null,
    loginActive: isLabTier(profile) && isActiveProfile(profile),
  };
}
