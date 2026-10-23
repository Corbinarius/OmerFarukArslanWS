# Davet / Şifre Sıfırlama Düzeltmesi

Loglarda hem `phase: invite` hem `phase: reset` için `AuthError: Unauthorized` tespit edildi. Bu nedenle hesap ve rol ayarlarını değiştirmeden, Netlify Identity akışı sunucudan tarayıcıya taşındı.

- `src/identity-client.mjs`: resmi `@netlify/identity` SDK ile `handleAuthCallback()`, `acceptInvite()`, recovery için `updateUser()`, giriş ve çıkış.
- `public/assets/documents.js`: şifre kaydetme ve giriş artık SDK üzerinden; eski POST `/document-auth` ile token gönderilmiyor.
- `public/assets/projects.js`: proje yöneticisi girişinde aynı SDK kullanılıyor.
- `public/index.html`: aynı kaynaktan sunulan Identity paketi `documents.js` öncesinde yükleniyor.
- `netlify.toml`, `package.json`: yayın sırasında browser için paket oluşturuluyor (`esbuild` sürümü sabit).

**GitHub'a yükleme:** ZIP içeriğindeki dosyaları deponun köküne (klasör yapısını koruyarak) kopyalayın; Commit + Push. Netlify deploy başarılı olmalı. Netlify build loglarında `public/assets/identity-client.js` oluşturulduğunu kontrol edin. Kaynak dosya `src/identity-client.mjs` doğrudan siteye yayınlanmaz.

**Test:** Yeni davet ya da sıfırlama bağlantısı alın ve tarayıcıda deneyin. Şifreler ve token içeren bağlantıları kimseyle paylaşmayın. Davet kabulü sonrası `admin` rolü etkinleşmişse proje/PDF ekleme formu açılmalıdır.

**Dürüst sınırlama:** Burada gerçek Netlify Identity servisinde deneyemedim. `npm exec` Netlify build sırasında npm kayıt sunucusuna erişir. Başarılı build ve gerçek Identity akışı canlı ortamda doğrulanmalıdır. Yalnız bu adımlar devam eden `Unauthorized` hatasını garanti olarak ortadan kaldırmaz; Identity konfigürasyonu veya servis kaynaklıysa Netlify destek logları gerekir.
