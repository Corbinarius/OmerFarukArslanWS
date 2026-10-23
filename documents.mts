import { getStore } from '@netlify/blobs';
import { getUser, refreshSession, verifyRequestOrigin } from '@netlify/identity';

export default async (request: Request) => {
  const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  try {
    const url = new URL(request.url);
    const store = getStore({ name: 'pdf-documents', consistency: 'strong' });
    if (request.method === 'GET') {
      const key = url.searchParams.get('file');
      if (key) {
        if (!/^pdf\/[0-9a-f-]{36}\/.+\.pdf$/i.test(key)) return reply({ error: 'Geçersiz dosya.' }, 400);
        const data = await store.get(key, { type: 'stream' });
        if (!data) return reply({ error: 'Dosya bulunamadı.' }, 404);
        const filename = key.split('/').pop()!;
        return new Response(data, { headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `${url.searchParams.has('download') ? 'attachment' : 'inline'}; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "sandbox",
          'Cache-Control': 'public, max-age=3600'
        } });
      }
      const { blobs } = await store.list({ prefix: 'pdf/' });
      return reply({ files: blobs.map(({ key }) => ({ key, name: key.split('/').pop()! })) });
    }
    if (request.method !== 'POST') return reply({ error: 'Yöntem desteklenmiyor.' }, 405);
    verifyRequestOrigin(request);
    await refreshSession();
    const user = await getUser();
    if (!user) return reply({ error: 'PDF yüklemek için giriş yapın.' }, 401);
    if (!user.roles?.includes('admin')) return reply({ error: 'Yalnızca yönetici PDF yükleyebilir.' }, 403);
    if (Number(request.headers.get('content-length')) > 3 * 1024 * 1024 + 32768) return reply({ error: 'PDF en fazla 3 MB olabilir.' }, 413);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || !/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) return reply({ error: 'Bir PDF dosyası seçin.' }, 400);
    if (!file.size || file.size > 3 * 1024 * 1024) return reply({ error: 'PDF boş olmamalı ve en fazla 3 MB olmalı.' }, 413);
    const data = await file.arrayBuffer();
    if (new TextDecoder().decode(data.slice(0, 5)) !== '%PDF-') return reply({ error: 'Geçerli bir PDF dosyası seçin.' }, 400);
    const filename = file.name.normalize('NFC').replace(/[\x00-\x1f\x7f/\\"<>]/g, '_').slice(0, 150).replace(/\.pdf$/i, '') + '.pdf';
    const key = `pdf/${crypto.randomUUID()}/${filename}`;
    await store.set(key, data);
    return reply({ file: { key, name: filename } }, 201);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 403) {
      return reply({ error: 'İstek kaynağına izin verilmedi.' }, 403);
    }
    return reply({ error: 'Doküman işlemi tamamlanamadı. Lütfen tekrar deneyin.' }, 500);
  }
};
