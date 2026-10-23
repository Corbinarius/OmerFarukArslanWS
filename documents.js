(() => {
  const $ = id => document.getElementById(id);
  const endpoint = '/.netlify/functions/documents';
  const authEndpoint = '/.netlify/functions/document-auth';
  let files = [];
  let callback = null;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  async function api(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'İşlem tamamlanamadı.');
    return data;
  }
  const auth = body => api(authEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  function panel(open) {
    $('document-management').hidden = !open;
    $('manage-documents').setAttribute('aria-expanded', String(open));
  }
  function session(data) {
    $('document-login').hidden = data.admin || data.authenticated;
    $('document-upload').hidden = !data.admin;
    $('document-logout').hidden = !data.authenticated;
    $('manage-documents').textContent = data.admin ? 'PDF ekle' : 'Yönetici girişi';
    if (data.authenticated && !data.admin) $('document-auth-status').textContent = 'Bu hesabın doküman yükleme yetkisi yok. Yönetici rolü gerekli.';
  }
  function render() {
    const query = $('document-search').value.toLocaleLowerCase('tr').trim();
    const matches = files.filter(file => file.name.toLocaleLowerCase('tr').includes(query));
    $('document-list').innerHTML = matches.map(file => {
      const url = `${endpoint}?file=${encodeURIComponent(file.key)}`;
      return `<article class="document-row"><div class="document-name"><small>PDF / DOKÜMAN</small>${escape(file.name)}</div><div class="document-links"><a href="${escape(url)}" target="_blank" rel="noopener">Görüntüle ↗</a><a href="${escape(url)}&amp;download=1" download>İndir ↓</a></div></article>`;
    }).join('');
    $('document-status').textContent = !files.length ? 'Henüz doküman eklenmedi.' : !matches.length ? 'Aramanıza uygun doküman bulunamadı.' : `${matches.length} doküman`;
  }
  async function load() {
    $('document-status').textContent = 'Dokümanlar yükleniyor…';
    $('document-retry').hidden = true;
    try {
      const data = await api(endpoint);
      files = data.files.sort((a,b) => a.name.localeCompare(b.name, 'tr'));
      render();
    } catch { $('document-status').textContent = 'Dokümanlar yüklenemedi.'; $('document-retry').hidden = false; }
  }
  $('document-search').addEventListener('input', render);
  $('document-retry').addEventListener('click', load);
  $('manage-documents').addEventListener('click', () => panel($('document-management').hidden));
  $('document-login').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('document-login-submit'); button.disabled = true;
    $('document-auth-status').textContent = 'İşlem yapılıyor…';
    try {
      const data = await auth({ action: callback?.type || 'login', email: $('document-email').value, password: $('document-password').value, ...(callback ? { token: callback.token } : {}) });
      callback = null; $('document-password').value = '';
      $('document-auth-status').textContent = data.admin ? 'Giriş yapıldı. PDF ekleyebilirsiniz.' : 'Şifreniz kaydedildi.';
      session(data);
    } catch (error) { $('document-auth-status').textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('document-recover').addEventListener('click', async () => {
    if (!$('document-email').reportValidity()) return;
    const button = $('document-recover'); button.disabled = true;
    try { await auth({ action: 'recover', email: $('document-email').value }); $('document-auth-status').textContent = 'Hesap mevcutsa şifre yenileme bağlantısı gönderildi.'; }
    catch (error) { $('document-auth-status').textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('document-logout').addEventListener('click', async () => {
    try { await auth({ action: 'logout' }); session({}); $('document-auth-status').textContent = 'Çıkış yapıldı.'; }
    catch (error) { $('document-auth-status').textContent = error.message; }
  });
  $('document-upload').addEventListener('submit', async event => {
    event.preventDefault();
    const file = $('document-file').files[0];
    if (!file || !/\.pdf$/i.test(file.name) || !file.size || file.size > 3 * 1024 * 1024) { $('document-auth-status').textContent = 'En fazla 3 MB boyutunda bir PDF seçin.'; return; }
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    $('document-auth-status').textContent = 'PDF yükleniyor…';
    try {
      const body = new FormData(); body.set('file', file);
      await api(endpoint, { method: 'POST', body });
      $('document-upload').reset(); $('document-search').value = '';
      await load(); $('document-auth-status').textContent = 'PDF eklendi ve herkesin erişimine açıldı.';
    } catch (error) { $('document-auth-status').textContent = error.message; }
    finally { button.disabled = false; }
  });
  async function init() {
    const hash = new URLSearchParams(location.hash.slice(1));
    const invite = hash.get('invite_token'), recovery = hash.get('recovery_token');
    if (invite || recovery) {
      callback = { type: invite ? 'invite' : 'reset', token: invite || recovery };
      history.replaceState(null, '', location.pathname + location.search + '#dokumanlar');
      panel(true); $('document-login').hidden = false;
      $('login-title').textContent = invite ? 'Davetinizi kabul edin' : 'Yeni şifre belirleyin';
      $('document-email').hidden = true; $('document-email').required = false;
      document.querySelector('label[for="document-email"]').hidden = true;
      $('document-recover').hidden = true; $('document-login-submit').textContent = 'Şifreyi kaydet';
      $('document-password').autocomplete = 'new-password';
      $('dokumanlar').scrollIntoView();
    } else {
      try { session(await api(authEndpoint)); }
      catch { $('document-auth-status').textContent = 'Giriş durumu alınamadı. Tekrar giriş yapabilirsiniz.'; }
    }
    await load();
  }
  init();
})();
