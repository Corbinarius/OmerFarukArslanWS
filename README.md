# Ömer Faruk Arslan — Mühendislik Proje Arşivi

STM32, C2000 ve FPGA projeleri için Netlify üzerinde yayımlanan, kaynak dosyaları tek tek gösteren kişisel mühendislik portfolyosu. Referans tasarımın soft antrasit renkleri, sol taraftaki Hakkımda bloğu, platform renkleri ve proje filtreleri korunur.

## Özellikler

- Başlangıçta örnek proje kaydı **yoktur**. Gerçek projeler yönetici panelinden eklenir.
- Başlık, platform, kişiselleştirilebilir renk, Basit / Orta / Zor seviyeleri, etiket, açıklama ve test notları.
- **ZIP gerekmeden** çoklu kaynak dosyası veya bir proje klasörü yükleme (alt klasör yolları korunur).
- Proje detaylarında **sol tarafta dosya ağacı**, sağ tarafta seçilen dosyanın **tam kaynak kodu**; kopyalama ve tek dosya indirme.
- Kaynak dosyaları Netlify Blobs üzerinde tek tek tutulur ve katalogda yalnızca yol/boyut bilgisi bulunur.
- Önceden ZIP olarak yayımlanmış projeler indirme bağlantılarını **korur**. Eski ZIP içerikleri otomatik olarak dosya ağacına dönüştürülmez.
- Büyük projeler için isteğe bağlı GitHub bağlantısı.
- PDF doküman kütüphanesi ve Netlify Identity yönetici girişi korunur.

## GitHub'da güncelleme

1. Bu ZIP'i bilgisayarına çıkar.
2. İçindeki dosyaları mevcut `OmerFarukArslanWS` GitHub klasörüne kopyala; aynı isimli dosyaları değiştir. **`.git` klasörünü silme.**
3. GitHub Desktop → **Commit to main** → **Push origin**.
4. Netlify → **Deploys** → en son yayının **Published** olmasını bekle.
5. [Canlı site](https://omerfarukarslanws.netlify.app/) → **Yönetici girişi → + Proje ekle**.

> Değişen uygulama dosyaları: `public/index.html`, `public/assets/projects.js`, `netlify/functions/projects.mts`. Tam paket mevcut Identity, PDF ve test altyapısını da içerir.

## İlk projeyi yükleme: STM32F429 GPIO

Pakette `sample-projects/STM32F429-GPIO-LED/` klasörü bulunur. İçinde ayrı ayrı `src/main.c`, `src/app_led.c`, `include/app_led.h`, `platformio.ini`, `README.md` ve doküman dosyaları vardır.

Yönetici formunda:

- **Proje başlığı:** STM32F429 Discovery — GPIO LED ve Buton Kontrolü
- **Platform:** STM32F429
- **Renk:** `#A4C7E6`
- **Kategori:** Firmware / GPIO
- **Zorluk:** Basit
- **Etiketler:** STM32, GPIO, HAL, LED, Button
- **Kaynak:** **Proje klasörünü seç** ve `sample-projects/STM32F429-GPIO-LED/` klasörünü göster.

**Projeyi yayımla** sonrasında kullanıcılar proje kartına tıklayıp her kaynak dosyasını site içinde okuyabilir.

Bu örneğin uygulama mantığı bilgisayarda test edilmiştir. Fiziksel STM32F429 kartında ve hedef toolchain'de test edilmiş olduğu iddia edilmez.

## Sınırlar ve güvenlik

- En fazla **50** kaynak dosyası.
- Her dosya en fazla **256 KB**, toplam en fazla **2 MB**.
- Yalnızca izin verilen **UTF-8 metin / kaynak / yapılandırma dosyaları**; binary çıktılar, firmware dump ve görseller için GitHub depo bağlantısını kullan.
- Yeni sürümde tarayıcıdan **proje güncelleme** yok; yanlış yayımlanan projeyi silip yeniden ekleyebilirsin.
- Kaynak kodları herkes tarafından okunabilir. **`.env`, token, parola, özel anahtar, şirket içi kaynak, lisans hakkı olmayan kod, müşteri verisi** yayımlama.
- Kaynakları kaydetme ve silme sunucu tarafında Netlify Identity `admin` rolüyle korunur. Okuma ve indirme herkese açıktır.
- Gerçek Identity ve Blobs entegrasyonu için canlı Netlify ortamında son kontrol gerekir.

## Depo yapısı

```text
public/index.html            # Görünüm ve dosya ağacı
public/assets/projects.js   # Kaynak seçimi, API istekleri, proje yönetimi
public/assets/documents.js  # PDF arayüzü
src/identity-client.mjs      # Kimlik akışı (Netlify deploy sırasında derlenir)
netlify/functions/projects.mts       # Proje ve kaynak dosyası API'si
netlify/functions/document-auth.mts  # Giriş API'si
netlify/functions/documents.mts      # PDF API'si
sample-projects/STM32F429-GPIO-LED/  # Yükleme örneği
tests/                     # Otomatik testler
netlify.toml                # Netlify build ayarları
```

Node.js 22 ile yerel kalite kontrolleri:

```bash
npm ci
npm test
npm run typecheck
```

Netlify'daki build komutu `npm run check && npm run build:identity` şeklindedir. Bağımlılıkları olmayan statik HTML önizlemede yönetici API'si çalışmaz.

## Lisans

Üst seviye site için yeniden kullanım lisansı seçilmemiştir. Örnek projedeki lisans dosyasını ayrıca incele. Açıkça lisans verilmediği sürece yalnızca görüntülenebilir olması kodun serbestçe yeniden kullanılabileceği anlamına gelmez.
