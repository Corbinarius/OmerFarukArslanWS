import { env } from 'node:process';
import { getUser, login, logout, acceptInvite, recoverPassword, requestPasswordRecovery, refreshSession, verifyRequestOrigin } from '@netlify/identity';

type Phase = 'session' | 'origin' | 'logout' | 'send-recovery' | 'invite' | 'reset' | 'login';

const reply = (data: unknown, status = 200) => Response.json(data, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});

const errorDetails = (error: unknown) => {
  if (!error || typeof error !== 'object') return { status: 0, code: '', name: 'UnknownError', message: '' };
  const item = error as { status?: unknown; code?: unknown; name?: unknown; message?: unknown };
  const status = typeof item.status === 'number' ? item.status : 0;
  const code = typeof item.code === 'string' ? item.code.slice(0, 64) : '';
  const name = typeof item.name === 'string' ? item.name.slice(0, 64) : 'Error';
  // Mask opaque tokens from diagnostic logs, without recording credentials or request bodies.
  const message = typeof item.message === 'string'
    ? item.message.replace(/https?:\/\/\S+/g, '[REDACTED_URL]').replace(/[^\s@]+@[^\s@]+/g, '[REDACTED_EMAIL]').replace(/[A-Za-z0-9_\-]{32,}/g, '[REDACTED]').slice(0, 200)
    : '';
  return { status, code, name, message };
};

export default async (request: Request) => {
  let phase: Phase = 'session';
  try {
    if (request.method === 'GET') {
      await refreshSession();
      const user = await getUser();
      return reply({ admin: Boolean(user?.roles?.includes('admin')), authenticated: Boolean(user) });
    }
    if (request.method !== 'POST') return reply({ error: 'Yöntem desteklenmiyor.' }, 405);

    phase = 'origin';
    verifyRequestOrigin(request);
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') return reply({ error: 'Geçersiz istek.' }, 400);
    const input = body as Record<string, unknown>;

    if (input.action === 'logout') {
      phase = 'logout';
      await logout();
      return reply({ ok: true });
    }
    if (input.action === 'recover') {
      if (typeof input.email !== 'string' || !input.email || input.email.length > 254)
        return reply({ error: 'Geçerli bir e-posta girin.' }, 400);
      phase = 'send-recovery';
      await requestPasswordRecovery(input.email);
      return reply({ ok: true });
    }

    if (typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 200)
      return reply({ error: 'Şifre 8–200 karakter olmalı.' }, 400);

    if (input.action === 'invite' || input.action === 'reset') {
      if (typeof input.token !== 'string' || !input.token || input.token.length > 4096)
        return reply({ error: 'Davet veya şifre sıfırlama bağlantısı eksik.' }, 400);
      phase = input.action;
      // Return the authenticated user from the completed operation directly.
      // This avoids mixing a successful token exchange with a second session query.
      const user = phase === 'invite'
        ? await acceptInvite(input.token, input.password)
        : await recoverPassword(input.token, input.password);
      return reply({ admin: Boolean(user?.roles?.includes('admin')), authenticated: true });
    }
    if (input.action === 'login' && typeof input.email === 'string' && input.email.length <= 254) {
      phase = 'login';
      let email=input.email.trim();
      if(!email.includes('@')){
        const alias=env.ADMIN_USERNAME, account=env.ADMIN_EMAIL;
        if(!alias||!account||email.toLowerCase()!==alias.toLowerCase())return reply({error:'Kullanıcı adı veya şifre doğrulanamadı.'},401);
        email=account;
      }
      const user = await login(email, input.password);
      return reply({ admin: Boolean(user?.roles?.includes('admin')), authenticated: true });
    }
    return reply({ error: 'Geçersiz işlem.' }, 400);
  } catch (error) {
    const detail = errorDetails(error);
    // Netlify > Logs > Functions > document-auth. No passwords, links, or tokens logged.
    console.error('[document-auth] identity failure', { phase, ...detail });
    if (detail.status === 403) {
      return reply({ error: 'İsteğin kaynağına izin verilmedi. Siteyi doğrudan HTTPS adresinden açın.', diagnostic: 'ORIGIN_REJECTED' }, 403);
    }
    if (phase === 'invite' || phase === 'reset') {
      if (detail.status >= 400 && detail.status < 500) {
        return reply({
          error: phase === 'invite'
            ? 'Davet bağlantısı kimlik servisi tarafından reddedildi. Eski veya kullanılmış olabilir. Yeni davet bağlantısını deneyin.'
            : 'Şifre sıfırlama bağlantısı kimlik servisi tarafından reddedildi. Eski veya kullanılmış olabilir. Yeni sıfırlama e-postası isteyin.',
          diagnostic: phase === 'invite' ? 'INVITE_REJECTED' : 'RECOVERY_REJECTED'
        }, 400);
      }
      return reply({
        error: 'Kimlik servisindeki teknik hata nedeniyle işlem tamamlanamadı. Netlify Functions loglarını kontrol edin.',
        diagnostic: 'IDENTITY_SERVICE_ERROR'
      }, 503);
    }
    if (phase === 'login' && detail.status >= 400 && detail.status < 500) {
      return reply({ error: 'E-posta veya şifre doğrulanamadı.', diagnostic: 'LOGIN_REJECTED' }, 401);
    }
    return reply({ error: 'Kimlik işlemi tamamlanamadı. Netlify Functions loglarını kontrol edin.', diagnostic: 'IDENTITY_SERVICE_ERROR' }, 503);
  }
};
