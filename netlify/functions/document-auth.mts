import { getUser, login, logout, acceptInvite, recoverPassword, requestPasswordRecovery, refreshSession, verifyRequestOrigin } from '@netlify/identity';

export default async (request: Request) => {
  const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  try {
    if (request.method === 'GET') {
      await refreshSession();
      const user = await getUser();
      return reply({ admin: Boolean(user?.roles?.includes('admin')), authenticated: Boolean(user) });
    }
    if (request.method !== 'POST') return reply({ error: 'Yöntem desteklenmiyor.' }, 405);
    verifyRequestOrigin(request);
    const body = await request.json();
    if (body.action === 'logout') { await logout(); return reply({ ok: true }); }
    if (body.action === 'recover') {
      if (typeof body.email !== 'string' || body.email.length > 254) return reply({ error: 'Geçerli bir e-posta girin.' }, 400);
      await requestPasswordRecovery(body.email);
      return reply({ ok: true });
    }
    if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 200) return reply({ error: 'Şifre 8–200 karakter olmalı.' }, 400);
    if (body.action === 'invite' || body.action === 'reset') {
      if (typeof body.token !== 'string' || body.token.length > 4096) return reply({ error: 'Geçersiz bağlantı.' }, 400);
      if (body.action === 'invite') await acceptInvite(body.token, body.password);
      else await recoverPassword(body.token, body.password);
    } else if (body.action === 'login' && typeof body.email === 'string') {
      await login(body.email, body.password);
    } else return reply({ error: 'Geçersiz işlem.' }, 400);
    const user = await getUser();
    return reply({ admin: Boolean(user?.roles?.includes('admin')), authenticated: Boolean(user) });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 403) {
      return reply({ error: 'İstek kaynağına izin verilmedi.' }, 403);
    }
    return reply({ error: 'İşlem tamamlanamadı. Bilgilerinizi veya davet bağlantınızı kontrol edin.' }, 400);
  }
};
