import { getStore } from '@netlify/blobs';
import { getUser, refreshSession, verifyRequestOrigin } from '@netlify/identity';

// Source code is public. Only authenticated Identity users with the admin role can publish/delete.
// Files are stored individually to support a browsable source tree without ZIP uploads.
// Legacy multipart clients retain their small-request limits. New uploads use PROJECT_LIMIT.
const MAX_FILE_COUNT = 50;
const MAX_SINGLE_FILE = 256 * 1024;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_REQUEST_BYTES = 3 * 1024 * 1024;
const PROJECT_LIMIT = 100 * 1024 * 1024;
const CHUNK_SIZE = 512 * 1024;
const SOURCE_COUNT = 10000;
const LEVELS = ['Basit', 'Orta', 'Zor'];
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const supportedSource = /(?:\.(?:c|h|cc|cpp|cxx|hpp|hxx|hh|v|sv|svh|vhd|vhdl|tcl|s|asm|ld|ioc|ini|txt|md|json|yaml|yml|xml|py|sh|cmake|cfg|sdc|xdc|launch|project|cproject|map|hex|csv)|(?:^|\/)(?:Makefile|CMakeLists\.txt|README|LICENSE))$/i;
const validPath = (path: string) => path.length <= 180 && !path.startsWith('/') &&
  path.split('/').every(part => !!part && part !== '.' && part !== '..' && !part.includes('\\') && !/[\u0000-\u001f]/.test(part) &&
    !['.env','.git','.ssh','node_modules','secrets'].includes(part.toLowerCase())) && supportedSource.test(path);
const getText = (form: FormData, name: string, max: number) => {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim().slice(0, max + 1) : '';
};
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'
} });

export default async (request: Request) => {
  try {
    const url = new URL(request.url);
    const store = getStore({ name: 'portfolio-projects', consistency: 'strong' });

    // Published chunks are public; drafts and partial uploads are never served.
    const manifestId = url.searchParams.get('manifest');
    const chunkId = url.searchParams.get('chunks');
    if (request.method === 'GET' && (manifestId || chunkId)) {
      const id = manifestId || chunkId || '';
      if (!validId(id)) return reply({error:'Geçersiz proje.'},400);
      const record = await store.get(`records/${id}.json`, {type:'json'}) as any;
      if (!record?.chunked) return reply({error:'Proje bulunamadı.'},404);
      if (manifestId) return reply({sourceFiles:record.sourceFiles});
      const part = url.searchParams.get('part') || '';
      if (!/^(0|[1-9][0-9]{0,2})$/.test(part) || Number(part) >= record.chunkHashes.length)
        return reply({error:'Geçersiz parça.'},400);
      const raw = await store.get(`chunks/${id}/${part}`, {type:'stream'});
      if (!raw) return reply({error:'Parça bulunamadı.'},404);
      return new Response(raw, {headers:{'Content-Type':'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=300'}});
    }

    // Compatibility: projects published before this update retain their ZIP download links.
    const download = url.searchParams.get('download');
    if (request.method === 'GET' && download !== null) {
      if (!validId(download)) return reply({ error: 'Geçersiz proje kimliği.' }, 400);
      const record = await store.get(`records/${download}.json`, { type: 'json' });
      if (!record || !(record as {archive?: boolean}).archive) return reply({ error: 'Kaynak paketi bulunamadı.' }, 404);
      const raw = await store.get(`files/${download}.zip`, { type: 'stream' });
      if (!raw) return reply({ error: 'Kaynak paketi bulunamadı.' }, 404);
      return new Response(raw, { headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="project-${download}.zip"`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': 'sandbox',
        'Cache-Control': 'public, max-age=300'
      } });
    }

    // Source file content is fetched on demand rather than included in the project catalog.
    const sourceId = url.searchParams.get('source');
    if (request.method === 'GET' && sourceId !== null) {
      if (!validId(sourceId)) return reply({ error: 'Geçersiz proje kimliği.' }, 400);
      const indexText = url.searchParams.get('index') || '';
      if (!/^(0|[1-9][0-9]{0,2})$/.test(indexText)) return reply({ error: 'Geçersiz dosya indeksi.' }, 400);
      const index = Number(indexText);
      const record = await store.get(`records/${sourceId}.json`, { type: 'json' }) as {sourceFiles?: {path:string;size:number}[]} | null;
      const file = record?.sourceFiles?.[index];
      if (!file || !validPath(file.path)) return reply({ error: 'Kaynak dosyası bulunamadı.' }, 404);
      const content = await store.get(`sources/${sourceId}/${index}`, { type: 'text' });
      if (typeof content !== 'string') return reply({ error: 'Kaynak dosyası bulunamadı.' }, 404);
      return reply({ path: file.path, content });
    }

    if (request.method === 'GET') {
      const listed = await store.list({ prefix: 'records/' });
      const records = await Promise.all(listed.blobs.map(async ({ key }) => {
        try { return await store.get(key, { type: 'json' }); } catch { return null; }
      }));
      const projects = records.filter((record): record is Record<string, unknown> => Boolean(record) && typeof record === 'object')
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      return reply({ projects: projects.map((r:any) => r.chunked ? {...r,sourceFiles:[],chunkHashes:undefined} : r) });
    }

    if (request.method !== 'POST' && request.method !== 'DELETE' && request.method !== 'PUT') return reply({ error: 'Yöntem desteklenmiyor.' }, 405);
    verifyRequestOrigin(request);
    await refreshSession();
    const user = await getUser();
    if (!user) return reply({ error: 'Proje yayımlamak için giriş yapın.' }, 401);
    if (!user.roles?.includes('admin')) return reply({ error: 'Proje yönetimi için yönetici yetkisi gerekiyor.' }, 403);

    const action = url.searchParams.get('action');
    if (action === 'part' || action === 'complete' || action === 'status') {
      const id = url.searchParams.get('id') || '';
      if (!validId(id)) return reply({error:'Geçersiz yükleme.'},400);
      const draft = await store.get(`drafts/${id}.json`, {type:'json'}) as any;
      if (!draft || draft.owner !== user.id) return reply({error:'Yükleme oturumu bulunamadı.'},404);
      const published = await store.get(`records/${id}.json`, {type:'json'}) as any;
      if (published) return reply({project:published,complete:true});
      if (Date.now()-draft.startedAt > 24*60*60*1000) return reply({error:'Yükleme oturumu süresi doldu. Yeniden başlayın.'},410);
      if (action === 'part') {
        if (request.method !== 'PUT') return reply({error:'PUT gerekli.'},405);
        const partText = url.searchParams.get('part') || '';
        const part = Number(partText);
        if (!/^(0|[1-9][0-9]{0,2})$/.test(partText) || part >= draft.record.chunkHashes.length)
          return reply({error:'Geçersiz parça.'},400);
        const expectedSize = Math.min(CHUNK_SIZE, draft.record.size-part*CHUNK_SIZE);
        if (Number(request.headers.get('content-length')) > expectedSize) return reply({error:'Parça çok büyük.'},413);
        const reader = request.body?.getReader();
        if (!reader) return reply({error:'Parça boş.'},400);
        const chunks: Uint8Array[]=[]; let length=0;
        while (true) {
          const {done,value}=await reader.read(); if(done)break;
          length+=value.length;
          if(length>expectedSize){await reader.cancel();return reply({error:'Parça çok büyük.'},413);}
          chunks.push(value);
        }
        if(length!==expectedSize)return reply({error:'Parça eksik.'},400);
        const bytes=new Uint8Array(length);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
        if(hash!==draft.record.chunkHashes[part])return reply({error:'Parça doğrulaması başarısız.'},400);
        // Hash-pinned writes make retries and concurrent duplicate requests idempotent.
        await store.set(`chunks/${id}/${part}`,bytes.buffer);
        return reply({ok:true,part});
      }
      if(request.method!=='POST')return reply({error:'POST gerekli.'},405);
      const listed=await store.list({prefix:`chunks/${id}/`});
      const keys=new Set(listed.blobs.map(b=>b.key));
      const missing=draft.record.chunkHashes.map((_:string,i:number)=>i).filter((i:number)=>!keys.has(`chunks/${id}/${i}`));
      if(action==='status')return reply({missing});
      if(missing.length)return reply({error:'Yükleme tamamlanmadı.',missing},409);
      await store.setJSON(`records/${id}.json`,draft.record);
      return reply({project:draft.record},201);
    }
    if(request.method==='PUT')return reply({error:'Geçersiz işlem.'},405);

    if (request.method === 'DELETE') {
      const id = url.searchParams.get('id') || '';
      if (!validId(id)) return reply({ error: 'Geçersiz proje kimliği.' }, 400);
      const record = await store.get(`records/${id}.json`, { type: 'json' }) as {sourceFiles?: unknown[];chunked?:boolean;chunkHashes?:string[]}|null;
      if (!record) return reply({ error: 'Proje bulunamadı.' }, 404);
      await store.delete(`records/${id}.json`);
      if(record.chunked){
        const keys=(record.chunkHashes || []).map((_,i)=>`chunks/${id}/${i}`);
        for(let i=0;i<keys.length;i+=10)await Promise.all(keys.slice(i,i+10).map(key=>store.delete(key)));
        await store.delete(`drafts/${id}.json`);
      } else await Promise.all((record.sourceFiles || []).map((_, index) => store.delete(`sources/${id}/${index}`)));
      await store.delete(`files/${id}.zip`); // Legacy archive cleanup.
      return reply({ ok: true });
    }

    const contentLength = Number(request.headers.get('content-length'));
    if (contentLength > MAX_REQUEST_BYTES) return reply({ error: 'İstek 3 MB sınırını aşıyor.' }, 413);
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

    const staged = action === 'begin';
    let uploadManifest: {path:string;size:number;offset:number}[] = [];
    let chunkHashes: string[] = [];
    if(staged){
      try {uploadManifest=JSON.parse(getText(form,'manifest',2500000));chunkHashes=JSON.parse(getText(form,'chunkHashes',15000));}
      catch{return reply({error:'Yükleme listesi geçersiz.'},400);}
      if(!Array.isArray(uploadManifest)||!uploadManifest.length||uploadManifest.length>SOURCE_COUNT||!Array.isArray(chunkHashes))return reply({error:'En fazla 10000 kaynak dosyası seçilebilir.'},400);
      let offset=0;const paths=new Set<string>();
      for(const f of uploadManifest){
        if(!f || typeof f.path!=='string'||!validPath(f.path)||paths.has(f.path)||!Number.isSafeInteger(f.size)||f.size<0||f.offset!==offset)return reply({error:'Dosya listesi geçersiz.'},400);
        paths.add(f.path);offset+=f.size;
      }
      if(offset>PROJECT_LIMIT)return reply({error:'Proje 100 MB sınırını aşıyor.'},413);
      if(chunkHashes.length!==Math.ceil(offset/CHUNK_SIZE)||chunkHashes.some(h=>typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h)))return reply({error:'Parça listesi geçersiz.'},400);
    }
    const sourceFiles = form.getAll('sources');
    if(staged && sourceFiles.length)return reply({error:'Parçalı yüklemede dosya içeriğini parça endpointine gönderin.'},400);
    let sourcePaths: unknown;
    try { sourcePaths = JSON.parse(getText(form, 'sourcePaths', 12000) || '[]'); } catch { sourcePaths = null; }
    if (!Array.isArray(sourcePaths) || !sourcePaths.every(path=>typeof path==='string'))
      return reply({ error: 'Kaynak dosya yolları geçersiz.' }, 400);
    if (sourceFiles.length !== sourcePaths.length || sourceFiles.length > MAX_FILE_COUNT)
      return reply({ error: 'En fazla 50 kaynak dosyası seçilebilir.' }, 400);
    if (!staged && sourceFiles.length === 0 && !repoUrl) return reply({ error: 'En az bir kaynak dosyası veya GitHub bağlantısı ekleyin.' }, 400);
    if (new Set(sourcePaths).size !== sourcePaths.length || sourcePaths.some(path=>!validPath(path)))
      return reply({ error: 'Kaynak dosya adları veya yolları geçersiz.' }, 400);

    const contents: string[] = [];
    const sourceManifest: {path:string;size:number}[] = [];
    let totalBytes = 0;
    for (let index=0; index<sourceFiles.length; index++) {
      const file = sourceFiles[index];
      if (!(file instanceof File) || file.size===0 || file.size>MAX_SINGLE_FILE)
        return reply({ error: 'Her kaynak dosyası 1–256 KB olmalı.' }, 400);
      totalBytes += file.size;
      if (totalBytes>MAX_SOURCE_BYTES) return reply({ error: 'Toplam kaynak kodu 2 MB sınırını aşıyor.' }, 413);
      const bytes = await file.arrayBuffer();
      let content: string;
      try { content = new TextDecoder('utf-8', { fatal:true }).decode(bytes); }
      catch { return reply({ error: `UTF-8 olmayan kaynak dosyası: ${sourcePaths[index]}` }, 400); }
      if (content.includes('\u0000')) return reply({ error: 'İkili dosya kaynak kodu olarak yüklenemez.' }, 400);
      contents.push(content);
      sourceManifest.push({path:sourcePaths[index], size:file.size});
    }

    if(staged){sourceManifest.push(...uploadManifest);totalBytes=uploadManifest.reduce((sum,f)=>sum+f.size,0);}

    const tags = [...new Set(tagText.split(',').map(v => v.trim()).filter(Boolean))].slice(0, 12);
    if (tags.some(tag => tag.length > 35)) return reply({ error: 'Etiketler 35 karakterden kısa olmalı.' }, 400);
    const id = crypto.randomUUID();
    const record = {
      id, number: 'P-' + id.slice(0, 6).toUpperCase(), title, platform,
      summary, color, category, levels: chosen as string[], tags,
      overview: overview.split(/\r?\n/).map(x => x.trim()).filter(Boolean),
      notes: notes.split(/\r?\n/).map(x => x.trim()).filter(Boolean),
      sourceFiles: sourceManifest, archive:false, repoUrl, filename:'', size: totalBytes,
      ...(staged?{chunked:true,chunkSize:CHUNK_SIZE,chunkHashes,fileCount:sourceManifest.length}:{}),
      createdAt: new Date().toISOString()
    };

    if(staged){
      await store.setJSON(`drafts/${id}.json`,{owner:user.id,startedAt:Date.now(),record});
      return reply({id,chunkSize:CHUNK_SIZE},201);
    }
    const written: string[] = [];
    try {
      for(let index=0;index<contents.length;index++) {
        const key = `sources/${id}/${index}`;
        await store.set(key, contents[index]);
        written.push(key);
      }
      await store.setJSON(`records/${id}.json`, record);
    } catch (error) {
      await Promise.allSettled(written.map(key => store.delete(key)));
      throw error;
    }
    return reply({ project: record }, 201);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 403)
      return reply({ error: 'İstek kaynağına izin verilmedi.' }, 403);
    console.error('[projects] failed', error instanceof Error ? error.name : 'UnknownError');
    return reply({ error: 'Proje işlemi tamamlanamadı. Lütfen tekrar deneyin.' }, 500);
  }
};
