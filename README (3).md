# Ömer Faruk Arslan — Mühendislik Proje Arşivi

STM32F429 ve TI C2000 çalışmaları için kişisel mühendislik portfolyosu. Sitede arama, platform/etiket/zorluk filtreleri, proje kayıtları ve PDF doküman kütüphanesi bulunur.

> **Önemli:** Bu depodaki dokuz proje kaydı, örnek açıklamalar ve *kod kesitleri* içeriyor. Bunlar orijinal STM32CubeIDE / CCS proje klasörleri **değildir** ve derlenebilir tam projeler olarak sunulmamalıdır. Gerçek projeleri yayımlamak için lisans ve gizlilik kontrolünden geçirilmiş kaynak dosyalarını ayrı klasörlere ekleyin.

## Mimari ve barındırma

| Bileşen | Konum | Çalışma ortamı |
| --- | --- | --- |
| Portfolyo arayüzü | `public/index.html` | Statik HTML/CSS/JavaScript |
| Doküman arayüzü | `public/assets/documents.js` | Tarayıcı |
| Oturum ve kimlik doğrulama | `netlify/functions/document-auth.mts` | Netlify Functions + Identity |
| PDF listeleme/yükleme/indirme | `netlify/functions/documents.mts` | Netlify Functions + Blobs |
| Testler | `tests/` | Node.js |
| CI | `.github/workflows/ci.yml` | GitHub Actions |
| Yayın ayarları | `netlify.toml` | Netlify |

**GitHub kod deposudur; siteyi Netlify üzerinden yayımlayın.** GitHub Pages yalnızca statik dosyaları sunar. Bu projedeki Netlify Functions, yönetici girişi, PDF yükleme ve kalıcı belge depolama özellikleri GitHub Pages üzerinde çalışmaz.

## GitHub'a yükleme

1. GitHub'da yeni bir depo oluşturun (örnek: `omer-faruk-arslan-lab`). İlk yükleme için GitHub arayüzünde otomatik README oluşturmayın; bu depoda README zaten bulunuyor.
2. ZIP dosyasını açın. **İçindeki klasörün içeriğini** depoya ekleyin: `public/`, `netlify/`, `.github/`, `tests/`, `package.json`, `package-lock.json`, `netlify.toml` vb.
3. `main` dalına push yapın. İsterseniz terminalden:

   ```bash
   git init
   git add .
   git commit -m "Initial portfolio and document archive"
   git branch -M main
   git remote add origin https://github.com/KULLANICI_ADIN/omer-faruk-arslan-lab.git
   git push -u origin main
   ```

4. GitHub **Actions** sekmesinde testlerin sonucunu görün.

`KULLANICI_ADIN` yerine kendi GitHub hesabınızı yazın.

## Netlify ile yayınlama

1. Netlify'da **Add new project → Import an existing project → GitHub** yoluyla depoya bağlanın.
2. Depodaki `netlify.toml` şu ayarları sağlar: publish dizini `public`, Functions dizini `netlify/functions`, build komutu `npm run check`.
3. İlk deploy tamamlandıktan sonra Netlify **Identity** özelliğini etkinleştirin.
4. Identity yönetiminden kendi e-posta adresinize davet gönderin. Kullanıcıya **sunucu tarafından yönetilen** `admin` rolünü verin. Mümkünse kayıt yöntemini *invite only* yapın.
5. Davet e-postasıyla hesabın şifresini belirleyip sitenin **Dokümanlar → Yönetici girişi** bölümünden giriş yapın. Yönetici rolü olmadan PDF yüklenemez.
6. PDF'ler Netlify Blobs üzerindeki `pdf-documents` deposunda saklanır. Siteyi yeniden yayımlamak yüklenmiş PDF'leri depoya kopyalamayı gerektirmez.

Dokümanlar herkese açık olarak listelenebilir, görüntülenebilir ve indirilebilir. Yükleme en fazla **3 MB** ve yalnızca PDF içindir. **Özel, şirket içi, gizli veya paylaşma hakkınız olmayan PDF'leri yüklemeyin.**

> Netlify Identity ve gerçek Blobs davranışı, dağıtılmış bir Netlify projesinde ayrıca sınanmalıdır. Burada yalnızca yerel birim testleri gerçek servisleri taklit eder. `netlify dev` ile arayüz ve Functions geliştirme mümkün olsa da bu ortamda yeni Identity akışının tam çalışacağını varsaymayın.

## Yerel geliştirme

Node.js 22 önerilir (`.nvmrc`).

```bash
npm ci
npm test
npm run typecheck
# Netlify CLI kuruluysa:
npx netlify dev
```

Sadece statik tasarımı görmek için:

```bash
python -m http.server 8000 --directory public
```

Ardından `http://localhost:8000` adresini açın. Bu statik önizlemede Dokümanlar API'si ve kullanıcı girişi çalışmaz; çalışması için Netlify Functions gerekir.

## Yeni proje eklemek

- Proje kataloğu şu anda `public/index.html` içindeki `PROJECTS` dizisinde bulunuyor. Başlık, platform, `levels`, etiket, özet ve notları burada güncelleyin.
- `levels: ['Orta', 'Zor']` gibi birden çok zorluk seçebilirsiniz. Platform renkleri mevcut CSS'deki `data-platform` kurallarıyla belirlenir.
- Sitenin dosya görüntüleyicisi **örnek dosyalar üretiyor**; gerçek proje yapısını sunmak için orijinal dosyaları ekleyip görüntüleyiciyi veri kaynağına bağlamanız gerekir.
- Gerçek proje kaynaklarını `projects/<proje-kimligi>/` altında saklamanız ve README dosyalarına pin eşlemeleri, derleme/yükleme adımları, kart/IDE sürümleri, test ve ölçüm notları eklemeniz önerilir. Kaynak depoya ekleme işlemi tek başına web arayüzünde otomatik listeleme yapmaz.
- Firma izinleri, üçüncü taraf lisanslar, anahtarlar ve kurum içi bilgiler için yayımlamadan önce denetim yapın.

## Güvenlik ve kontroller

Yüklemeler sunucuda oturum ve `admin` rolü ile sınırlandırılmıştır. PDF uzantısı, içerik tipi, boyut ve `%PDF-` başlığı kontrol edilir. Cross-origin POST istekleri reddedilir; PDF yanıtlarında içerik tipi ve sandbox başlığı bulunur. Bu kontroller kötü amaçlı PDF'leri tamamen güvenli hâle getirmez.

```bash
npm test
npm run typecheck
```

GitHub Actions bu komutları her `main` push'u ve pull request'te çalıştırır. Netlify yayınlaması ise GitHub'a bağlı dağıtım üzerinden yapılır.

## Lisans

Üst seviye proje için lisans seçimi henüz kesinleştirilmedi. Kodun kamusal görüntülenebilir olması yeniden kullanım izninin otomatik verildiği anlamına gelmez. Açık kaynak olarak dağıtmak isterseniz uygun bir `LICENSE` dosyası ekleyin. Üçüncü taraf veri sayfaları ve üretici örnekleri bu lisansın kapsamına otomatik girmez.
