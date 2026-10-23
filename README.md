# Ömer Faruk Arslan — Mühendislik Proje Arşivi

STM32F429 ve TI C2000 çalışmaları için kişisel mühendislik portfolyosu. Sitede arama, platform/etiket/zorluk filtreleri, proje kayıtları ve PDF doküman kütüphanesi bulunur.

**Başlangıçtaki dokuz örnek proje kaldırıldı.** Proje arşivi varsayılan olarak boş başlar; sitedeki yönetici panelinden yayımlanan gerçek projeler Netlify Blobs üzerinden listelenir. Yüklenmiş projeler ve PDF'ler bu değişiklikten etkilenmez.

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

## Proje kayıtları

- Başlangıçtaki 9 temsili kayıt kaldırılmıştır; `public/index.html` dosyasında `PROJECTS = []` durumundadır.
- Yeni gerçek projeleri **Proje kayıtları → Yönetici girişi → + Proje ekle** yolundan yayımlayın.
- Netlify Blobs deposundaki mevcut yayımlanmış projeler korunur. ZIP dosyaları ve PDF'ler silinmez.
- Projeleri yönetici oturumunda ayrıntı ekranındaki **Projeyi sil** düğmesiyle silebilirsiniz.
- Firma izinleri, üçüncü taraf lisanslar, gizli anahtarlar ve kurum içi bilgiler için yayımlamadan önce kontrol yapın.

## Güvenlik ve kontroller

Yüklemeler sunucuda oturum ve `admin` rolü ile sınırlandırılmıştır. PDF uzantısı, içerik tipi, boyut ve `%PDF-` başlığı kontrol edilir. Cross-origin POST istekleri reddedilir; PDF yanıtlarında içerik tipi ve sandbox başlığı bulunur. Bu kontroller kötü amaçlı PDF'leri tamamen güvenli hâle getirmez.

```bash
npm test
npm run typecheck
```

GitHub Actions bu komutları her `main` push'u ve pull request'te çalıştırır. Netlify yayınlaması ise GitHub'a bağlı dağıtım üzerinden yapılır.

## Lisans

Üst seviye proje için lisans seçimi henüz kesinleştirilmedi. Kodun kamusal görüntülenebilir olması yeniden kullanım izninin otomatik verildiği anlamına gelmez. Açık kaynak olarak dağıtmak isterseniz uygun bir `LICENSE` dosyası ekleyin. Üçüncü taraf veri sayfaları ve üretici örnekleri bu lisansın kapsamına otomatik girmez.

## Yeni özellik: Sitenin içinden proje yayımlama

Bu sürümde proje listesinin üstünde **Yönetici girişi / + Proje ekle** düğmesi vardır.

1. Netlify'da **Project configuration → Identity** bölümünden Identity'yi etkinleştirin, kendi e-postanızı davet edin, hesabınıza sunucudan `admin` rolü verin ve mümkünse davetsiz kaydı kapatın. Identity yapılandırılmadan giriş ve yeni proje ekleme çalışmaz.
2. Sitenin **Proje kayıtları** bölümündeki **Yönetici girişi** düğmesine basın; e-posta ve şifrenizi aynı panelden girin.
3. **+ Proje ekle** formundan proje adı, platform, renk, bir veya birden fazla zorluk seviyesi, etiketler, teknik açıklama ve test notlarını girin.
4. **3 MB veya daha küçük orijinal kaynak ZIP'i** yükleyin. Daha büyük bir proje için GitHub kaynak repo bağlantısı verin. Her iki yöntem birlikte de kullanılabilir.
5. **Projeyi yayımla** butonuna basın. Proje Netlify Blobs'ta saklanır; otomatik yeniden deploy gerekmeden ziyaretçilerin proje listesindeki filtrelerde ve detay ekranlarında görünür.
6. Giriş yapmış yönetici, yayımladığı projeyi detay penceresindeki **Projeyi sil** düğmesinden geri kaldırabilir. Yanlışlıkla silinmeyi azaltmak için tarayıcı onayı istenir.

### Tasarım ve veri depolama

- Referans tasarımın antrasit/gri zemin ve soft mavi/kızıl geçişleri aynen bırakıldı.
- Eski dokuz örnek kayıt HTML içinde bulunmaya devam eder. Bu örnekler tam, derlenebilir proje değildir.
- Yeni projeler `netlify/functions/projects.mts` API'siyle `portfolio-projects` adlı **site-geneli Netlify Blobs deposuna** yazılır. ZIP dosyaları ve meta veriler farklı anahtarlarda tutulur; yeni Netlify deploy'ları bu içeriği silmez.
- Herkese açık olan işlemler: listeleme ve kaynak paketini indirme. Yönetici gerektiren işlemler: yayımlama ve silme. `admin` rolü yalnızca Netlify Identity üzerinde atanır; tarayıcıdaki gizli butonlar güvenlik sınırı değildir.
- Netlify Functions'ın ikili yükleme sınırları nedeniyle ZIP üst sınırı 3 MB'tır. Büyük STM32CubeIDE/Vivado projeleri için temizlenmiş GitHub reposu önerilir. Kaynak paketlerine gizli anahtar, kuruma ait bilgiler veya yayın hakkınız olmayan dosyaları eklemeyin.
- Yeni projelerin ZIP'lerinin içeriği tarayıcı içinde dosya ağacı olarak gösterilmez; doğrudan ZIP indirilir. GitHub linki varsa kaynak depo da açılabilir.
- Bu arayüz GitHub'a bağlı Netlify'da çalışır. Salt statik HTML açıldığında Netlify Identity / Blobs mevcut olmadığı için canlı proje ekleme çalışmaz.

### Değişen veya eklenen dosyalar

```text
public/index.html
public/assets/documents.js
public/assets/projects.js       (yeni)
netlify/functions/projects.mts   (yeni)
tests/site.test.cjs
tests/projects.test.cjs          (yeni)
README.md
```

GitHub'a yeni sürümün **içindeki dosyaları mevcut klasörleri koruyarak** yükleyin. `main` dalına push yaptıktan sonra Netlify otomatik deploy yapar. Yeni dosyalarda bir GitHub Actions/typecheck hatası varsa deploy başarılı olana kadar canlı sitede değişiklik görünmez.
