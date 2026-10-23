import { getStore } from '@netlify/blobs';
import { getUser, refreshSession, verifyRequestOrigin } from '@netlify/identity';

// Site-scope storage: projects survive redeploys. Visitors can read and download,
// but every write requires a server-verified administrator session.
const MAX_ZIP_SIZE = 3 * 1024 * 1024;
const LEVELS = ['Basit', 'Orta', 'Zor'];
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const getText = (form: FormData, name: string, max: number) => {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim().slice(0, max + 1) : '';
};
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export default async (request: Request) => {
  try {
    const url = new URL(request.url);
    const store = getStore({ name: 'portfolio-projects', consistency: 'strong' });
    const download = url.searchParams.get('download');
    if (request.method === 'GET' && download !== null) {
      if (!validId(download)) return reply({ error: 'Geçersiz proje kimliği.' }, 400);
      const raw = await store.get(`files/${download}.zip`, { type: 'stream' });
      if (!raw) return reply({ error: 'Proje paketi bulunamadı.' }, 404);
      return new Response(raw, { headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="project-${download}.zip"`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': 'sandbox',
        'Cache-Control': 'public, max-age=300'
      } });
    }
    if (request.method === 'GET') {
      const listed = await store.list({ prefix: 'records/' });
      const records = await Promise.all(listed.blobs.map(async ({ key }) => {
        try { return await store.get(key, { type: 'json' }); } catch { return null; }
      }));
      const projects = records.filter((record): record is Record<string, unknown> => Boolean(record) && typeof record === 'object')
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      return reply({ projects });
    }
    if (request.method !== 'POST' && request.method !== 'DELETE') return reply({ error: 'Yöntem desteklenmiyor.' }, 405);
    verifyRequestOrigin(request);
    await refreshSession();
    const user = await getUser();
    if (!user) return reply({ error: 'Proje yayımlamak için giriş yapın.' }, 401);
    if (!user.roles?.includes('admin')) return reply({ error: 'Proje yönetimi için yönetici yetkisi gerekiyor.' }, 403);

    if (request.method === 'DELETE') {
      const id = url.searchParams.get('id') || '';
      if (!validId(id)) return reply({ error: 'Geçersiz proje kimliği.' }, 400);
      const record = await store.get(`records/${id}.json`, { type: 'json' });
      if (!record) return reply({ error: 'Proje bulunamadı.' }, 404);
      await store.delete(`records/${id}.json`);
      await store.delete(`files/${id}.zip`);
      return reply({ ok: true });
    }

    const announcedSize = Number(request.headers.get('content-length'));
    if (announcedSize > MAX_ZIP_SIZE + 128 * 1024) return reply({ error: 'ZIP dosyası en fazla 3 MB olabilir.' }, 413);
    const form = await request.formData();
    const title = getText(form, 'title', 110);
    const platform = getText(form, 'platform', 50);
    const summary = getText(form, 'summary', 650);
    const color = getText(form, 'color', 7);
    const category = getText(form, 'category', 65) || 'Project';
    const overview = getText(form, 'overview', 4000);
    const notes = getText(form, 'notes', 4000);
    const tagText = getText(form, 'tags', 250);
    const rawLevels = getText(form, 'levels', 70);
    const repoUrl = getText(form, 'repoUrl', 250);
    if (repoUrl && !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_./%-]*)?$/i.test(repoUrl))
      return reply({ error: 'GitHub bağlantısı geçerli bir github.com proje adresi olmalı.' }, 400);
    let chosen: unknown;
    try { chosen = JSON.parse(rawLevels); } catch { chosen = null; }
    if (!title || title.length > 110 || !platform || platform.length > 50 || !summary || summary.length > 650 ||
        !/^#[0-9a-fA-F]{6}$/.test(color) || !Array.isArray(chosen) || !chosen.length ||
        !chosen.every(v => typeof v === 'string' && LEVELS.includes(v)) || new Set(chosen).size !== chosen.length ||
        overview.length > 4000 || notes.length > 4000 || category.length > 65 || tagText.length > 250)
      return reply({ error: 'Proje bilgileri eksik veya geçersiz.' }, 400);
    const zip = form.get('file');
    const hasZip = zip instanceof File && zip.size > 0;
    if (!hasZip && !repoUrl) return reply({ error: 'Kaynak ZIP veya GitHub bağlantısı ekleyin.' }, 400);
    if (hasZip && (!/\.zip$/i.test(zip.name) || zip.size > MAX_ZIP_SIZE))
      return reply({ error: 'En fazla 3 MB olan bir ZIP dosyası seçin.' }, 400);
    let buffer: ArrayBuffer | null = null;
    if (hasZip) {
      buffer = await zip.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04)
        return reply({ error: 'Geçerli bir ZIP proje paketi yükleyin.' }, 400);
    }
    const tags = [...new Set(tagText.split(',').map(v => v.trim()).filter(Boolean))].slice(0, 12);
    if (tags.some(tag => tag.length > 35)) return reply({ error: 'Etiketler 35 karakterden kısa olmalı.' }, 400);
    const id = crypto.randomUUID();
    const record = {
      id, number: 'P-' + id.slice(0, 6).toUpperCase(), title, platform,
      summary, color, category, levels: chosen as string[], tags,
      overview: overview.split(/\r?\n/).map(x => x.trim()).filter(Boolean),
      notes: notes.split(/\r?\n/).map(x => x.trim()).filter(Boolean),
      archive: hasZip, repoUrl, filename: hasZip ? zip.name.slice(0, 160) : '', size: hasZip ? zip.size : 0,
      createdAt: new Date().toISOString()
    };
    // Save archive before publishing the project record to avoid orphan card on upload failure.
    if (buffer) await store.set(`files/${id}.zip`, buffer);
    try { await store.setJSON(`records/${id}.json`, record); }
    catch (error) { if (buffer) await store.delete(`files/${id}.zip`); throw error; }
    return reply({ project: record }, 201);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 403)
      return reply({ error: 'İstek kaynağına izin verilmedi.' }, 403);
    return reply({ error: 'Proje işlemi tamamlanamadı. Lütfen tekrar deneyin.' }, 500);
  }
};
