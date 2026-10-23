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
  function editor(open) {
    $('project-manager').hidden = !open;
    $('open-project-manager').setAttribute('aria-expanded', String(open));
    if (open) $('project-manager').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function updateSession(session) {
    isAdmin = Boolean(session?.admin);
    window.portfolioAdmin = isAdmin;
    $('open-project-manager').textContent = isAdmin ? '+ Proje ekle' : 'Yönetici girişi';
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
    editor($('project-manager').hidden);
  });
  $('close-project-manager').addEventListener('click', () => editor(false));
  window.addEventListener('portfolio:session', e => updateSession(e.detail));
  $('project-admin-login').addEventListener('submit', async e => {
    e.preventDefault();
    const submit = $('project-login-button');
    submit.disabled = true;
    $('project-login-status').textContent = 'Giriş yapılıyor…';
    try {
      const session = await api('/.netlify/functions/document-auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action:'login',email:$('project-login-email').value,password:$('project-login-password').value })
      });
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
  $('project-publish-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!isAdmin) { goToLogin(); return; }
    const form = e.currentTarget;
    const button = $('project-publish-button');
    const levels = [...form.querySelectorAll('input[name="project-level"]:checked')].map(el=>el.value);
    if (!levels.length) { feedback('En az bir zorluk seviyesi seç.', true); return; }
    const file = $('new-project-file').files[0];
    const repoUrl = $('new-project-repo').value.trim();
    if ((!file || !file.size) && !repoUrl) { feedback('Kaynak ZIP veya GitHub bağlantısı ekle.', true); return; }
    if (file && (file.size > 3*1024*1024 || !/\.zip$/i.test(file.name))) {
      feedback('ZIP dosyası .zip uzantılı ve en fazla 3 MB olmalı.', true); return;
    }
    const data = new FormData(form);
    data.set('levels', JSON.stringify(levels));
    data.set('color', palette.value);
    button.disabled = true;
    feedback('Proje kaydediliyor…');
    try {
      const result = await api(apiPath, { method: 'POST', body: data });
      if (!acceptedRecord(result.project)) throw new Error('Sunucudan beklenmeyen proje yanıtı alındı.');
      PROJECTS.unshift(result.project);
      form.reset();
      palette.value = '#a4c7e6'; hex.value = palette.value;
      updatePlatformOptions();
      state.query = ''; $('search').value = '';
      state.platform = ''; state.levels.clear(); state.tag='';
      render();
      feedback('Proje yayımlandı. Artık arşivde listeleniyor.');
    } catch (error) { feedback(error.message, true); }
    finally { button.disabled = false; }
  });

  $('delete-current-project').addEventListener('click', async () => {
    const id = state.activeId;
    const project = PROJECTS.find(p=>p.id===id);
    if (!isAdmin || !project || (!project.archive && !project.repoUrl)) return;
    if (!window.confirm(`“${project.title}” projesini ve yüklenen ZIP dosyasını kalıcı olarak silmek istiyor musun?`)) return;
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
