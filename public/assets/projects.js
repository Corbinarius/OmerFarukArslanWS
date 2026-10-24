/* Project publishing UI. All publish/delete permission checks happen in Netlify Functions. */
(() => {
  const $ = id => document.getElementById(id);
  const apiPath = '/.netlify/functions/projects';
  let isAdmin = false;

  function feedback(message, bad = false) {
    $('project-publish-status').textContent = message;
    $('project-publish-status').style.color = bad ? '#e4aaa8' : '#afd0b7';
  }
  async function api(url, options) {
    const response = await fetch(url, { credentials: 'same-origin', ...(options || {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Sunucu işlemi tamamlanamadı.');
    return data;
  }
  function editor(open) { if(open)window.openAdminPanel();else window.closeAdminPanel(); }
  function updateSession(session) {
    isAdmin = Boolean(session?.admin);
    window.portfolioAdmin = isAdmin;
    $('profile-editor').hidden=!isAdmin;
    $('admin-logout').hidden=!session?.authenticated;
    $('open-project-manager').textContent = 'Yönetici paneli';
    $('project-admin-login').hidden = isAdmin;
    $('project-publish-form').hidden = !isAdmin;
    if (state.activeId) renderDetail();
  }
  function goToLogin() {
    editor(true);
    $('project-login-email').focus();
  }
  function updatePlatformOptions() {
    const select = $('platform');
    const current = state.platform;
    const platforms = [...new Set(PROJECTS.map(project => project.platform))].sort((a,b)=>a.localeCompare(b, 'tr'));
    select.replaceChildren(new Option('Tüm platformlar', ''), ...platforms.map(p=>new Option(p,p)));
    select.value = current;
  }
  function acceptedRecord(project) {
    return project && typeof project.id === 'string' && typeof project.title === 'string' &&
      typeof project.summary === 'string' && typeof project.platform === 'string' &&
      Array.isArray(project.levels) && project.levels.every(v=>['Basit','Orta','Zor'].includes(v)) &&
      Array.isArray(project.tags) && Array.isArray(project.overview) && Array.isArray(project.notes);
  }
  async function loadProjects() {
    try {
      const { projects } = await api(apiPath);
      if (!Array.isArray(projects)) throw Error('Sunucudan geçersiz proje listesi geldi.');
      const verified = projects.filter(acceptedRecord).filter(p=>!PROJECTS.some(s=>s.id===p.id));
      PROJECTS.unshift(...verified);
      updatePlatformOptions();
      render();
    } catch (error) {
      // Static sample projects still display if API is temporarily unavailable.
      feedback('Yüklenen projeler alınamadı: '+error.message, true);
    }
  }

  $('open-project-manager').addEventListener('click', () => {
    editor(!$('admin-dialog').open);
  });
  $('close-project-manager').addEventListener('click', () => editor(false));
  window.addEventListener('portfolio:session', e => updateSession(e.detail));
  $('project-admin-login').addEventListener('submit', async e => {
    e.preventDefault();
    const submit = $('project-login-button');
    submit.disabled = true;
    $('project-login-status').textContent = 'Giriş yapılıyor…';
    try {
      if (!window.portfolioIdentity) throw new Error('Kimlik bileşeni yüklenemedi. Sayfayı yenileyin.');
      const username=$('project-login-email').value.trim();
      if(username.includes('@'))await window.portfolioIdentity.login(username,$('project-login-password').value);
      else await api('/.netlify/functions/document-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',email:username,password:$('project-login-password').value})});
      const session = await api('/.netlify/functions/document-auth');
      $('project-login-password').value = '';
      updateSession(session);
      window.dispatchEvent(new Event('portfolio:refresh-auth'));
      $('project-login-status').textContent = session.admin ? '' : 'Giriş yapıldı ancak hesabınızda yönetici yetkisi yok.';
      if (session.admin) $('new-project-title').focus();
    } catch(error) { $('project-login-status').textContent = error.message; }
    finally { submit.disabled = false; }
  });

  const palette = $('new-project-color');
  const hex = $('new-project-color-hex');
  palette.addEventListener('input', () => { hex.value = palette.value; });
  hex.addEventListener('change', () => {
    const next = hex.value.trim();
    if (/^#[a-f0-9]{6}$/i.test(next)) palette.value = next;
    else hex.value = palette.value;
  });
  $('new-project-platform').addEventListener('input', e => {
    const str = e.target.value.toLowerCase();
    if (str.includes('stm') || str.includes('stmicro')) palette.value = '#a4c7e6';
    else if (str.includes('ti ') || str.includes('c2000') || str.includes('texas')) palette.value = '#e4aaa8';
    else return;
    hex.value = palette.value;
  });
  const supportedSource = /(?:\.(?:c|h|cc|cpp|cxx|hpp|hxx|hh|v|sv|svh|vhd|vhdl|tcl|s|asm|ld|ioc|ini|txt|md|json|yaml|yml|xml|py|sh|cmake|cfg|sdc|xdc|launch|project|cproject|map|hex|csv)|(?:^|\/)(?:Makefile|CMakeLists\.txt|README|LICENSE))$/i;
  const safePath = path => path.length <= 180 && !path.startsWith('/') &&
    path.split('/').every(part => part && part !== '.' && part !== '..' && !part.includes('\\') &&
      !['.env','.git','.ssh','node_modules','secrets'].includes(part.toLowerCase()));
  const sourceInputs = [$('new-project-sources'), $('new-project-folder')];
  function collectedSources() {
    const files = sourceInputs.flatMap(input => [...input.files]).map(file => ({
      file, path: (file.webkitRelativePath || file.name).replaceAll('\\','/')
    }));
    const allowed = files.filter(item => safePath(item.path) && supportedSource.test(item.path));
    const unique = new Map();
    for (const item of allowed) unique.set(item.path, item);
    return { files:[...unique.values()], skipped:files.length-allowed.length, duplicates:allowed.length-unique.size };
  }
  function updateSourcePreview() {
    const {files,skipped,duplicates}=collectedSources();
    const text = files.length ? `${files.length} kaynak dosyası (${files.reduce((sum,x)=>sum+x.file.size,0).toLocaleString('tr-TR')} bayt)\n${files.slice(0,12).map(x=>'• '+x.path).join('\n')}${files.length>12?'\n…':''}` : 'Henüz kaynak dosyası seçilmedi.';
    $('source-selection').textContent = text + (skipped?`\n${skipped} desteklenmeyen veya hassas dosya atlandı.`:'') + (duplicates?`\n${duplicates} yinelenen dosya tekilleştirildi.`:'');
  }
  sourceInputs.forEach(input=>input.addEventListener('change', updateSourcePreview));

  $('project-publish-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!isAdmin) { goToLogin(); return; }
    const form = e.currentTarget;
    const button = $('project-publish-button');
    const levels = [...form.querySelectorAll('input[name="project-level"]:checked')].map(el=>el.value);
    if (!levels.length) { feedback('En az bir zorluk seviyesi seç.', true); return; }
    const { files } = collectedSources();
    const repoUrl = $('new-project-repo').value.trim();
    if (!files.length && !repoUrl) { feedback('En az bir kaynak dosyası, klasör veya GitHub bağlantısı ekle.', true); return; }
    if (files.length > 10000 || files.reduce((sum,x)=>sum+x.file.size,0)>100*1024*1024) {
      feedback('En fazla 10000 kaynak dosyası, toplam 100 MB.', true); return;
    }
    const data = new FormData(form);
    data.set('levels', JSON.stringify(levels));
    data.set('color', palette.value);

    button.disabled = true;
    feedback('Proje kaydediliyor…');
    try {
      const result = files.length ? await window.ProjectUpload.publish(files,data,feedback) : await api(apiPath, { method: 'POST', body: data });
      if (!acceptedRecord(result.project)) throw new Error('Sunucudan beklenmeyen proje yanıtı alındı.');
      PROJECTS.unshift(result.project);
      form.reset();
      palette.value = '#a4c7e6'; hex.value = palette.value;
      sourceInputs.forEach(input=>{ input.value=''; }); updateSourcePreview();
      updatePlatformOptions();
      state.query = ''; $('search').value = '';
      state.platform = ''; state.levels.clear(); state.tag='';
      render();
      feedback('Proje yayımlandı. Kaynak dosyaları proje detayında açıldı.');
      editor(false);
      openProject(result.project.id);
    } catch (error) { feedback(error.message + ' Aynı dosyalarla yeniden Yayımla düğmesine basarak bu sekmede kaldığın yerden devam edebilirsin.', true); }
    finally { button.disabled = false; }
  });

  $('delete-current-project').addEventListener('click', async () => {
    const id = state.activeId;
    const project = PROJECTS.find(p=>p.id===id);
    if (!isAdmin || !project || (!project.sourceFiles?.length && !project.archive && !project.repoUrl)) return;
    if (!window.confirm(`“${project.title}” projesini ve yüklenen tüm kaynak dosyalarını kalıcı olarak silmek istiyor musun?`)) return;
    const button = $('delete-current-project');
    button.disabled = true;
    try {
      await api(`${apiPath}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const idx = PROJECTS.findIndex(p=>p.id===id);
      if (idx !== -1) PROJECTS.splice(idx, 1);
      closeProject();
      updatePlatformOptions(); render();
      feedback('Proje arşivden silindi.');
    } catch (error) { window.alert('Silinemedi: ' + error.message); }
    finally { button.disabled = false; }
  });

  async function checkSession() {
    try { updateSession(await api('/.netlify/functions/document-auth')); }
    catch { updateSession({ admin: false }); }
  }
  checkSession();
  loadProjects();
})();
