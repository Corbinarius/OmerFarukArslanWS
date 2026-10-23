/* Browser-side Netlify Identity entry. Bundled as a same-origin asset at deploy time.
   Never expose invite/recovery tokens or passwords to server logs. */
import {
  handleAuthCallback,
  acceptInvite,
  updateUser,
  login,
  logout,
  requestPasswordRecovery
} from '@netlify/identity';

// Must run before another script clears URL hash; catches invite AND recovery.
const callbackPromise = handleAuthCallback();
let pendingCallback = null;

async function getCallback() {
  if (pendingCallback) return pendingCallback;
  pendingCallback = await callbackPromise;
  return pendingCallback;
}

window.portfolioIdentity = {
  callbackPromise,
  async completePassword(password) {
    const result = await getCallback();
    if (result?.type === 'invite' && result.token) {
      const user = await acceptInvite(result.token, password);
      pendingCallback = null;
      return user;
    }
    if (result?.type === 'recovery') {
      // handleAuthCallback has already authenticated recovery token; update
      // password using the active browser session, as Netlify documents.
      const user = await updateUser({ password });
      pendingCallback = null;
      return user;
    }
    throw new Error('Davet veya şifre yenileme oturumu bulunamadı. Yeni bağlantı isteyin.');
  },
  async login(email, password) {
    await callbackPromise;
    return login(email, password);
  },
  async logout() { return logout(); },
  async requestRecovery(email) { return requestPasswordRecovery(email); }
};
