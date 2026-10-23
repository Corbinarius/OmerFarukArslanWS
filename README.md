# Orijinal kaynak projeler nasıl eklenecek?

Bu depo hâlihazırda proje **kartları ve örnek kod kesitleri** içeriyor. Gerçek kaynak proje klasörleri ZIP'e dahil edilmediğinden bunları varmış gibi göstermiyoruz.

Tavsiye edilen yapı:

```text
projects/
  stm32f429-gpio-led/
    README.md
    Core/
    Drivers/            # ilgili lisansları ve üretici dosyalarını kontrol edin
    *.ioc
  c2000-pll-pwm/
    README.md
    src/
    include/
    *.syscfg
```

Her proje README'sinde hedef kart/MCU, pin haritası, araç zinciri sürümü, bağımlılıklar, derleme ve yükleme komutları, beklenen çıkış, doğrulanan testler ve bilinen sınırlamalar yer almalıdır.

**Önemli:** Kaynakların `projects/` içine eklenmesi otomatik olarak web sitesinde görünmelerini sağlamaz. `public/index.html` içindeki katalog ile indirme/görüntüleme bağları ayrıca güncellenmelidir.
