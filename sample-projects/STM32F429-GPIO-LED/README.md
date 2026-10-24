# STM32F429 Discovery — GPIO LED & Button

**Platform:** STMicroelectronics STM32F429I-DISC1 (`STM32F429ZIT6`)  
**Seviye:** Basit  
**Etiketler:** STM32, GPIO, HAL, LED, Button  
**Geliştirme:** C / STM32Cube HAL / PlatformIO

Bu proje, STM32F429I Discovery üzerindeki iki dahili LED'i `HAL_GetTick()` ile **bloklamadan** kontrol eder. Kartın mavi USER butonuna basınca yanıp sönme hızı değişir. Harici direnç, breadboard veya ilave kablolama gerekmez.

> Bu, kişisel portfolyoya eklenmek üzere yeni hazırlanmış örnek bir **tam uygulama kaynak projesidir**. Fiziksel kartta henüz çalıştırılarak doğrulanmamıştır. PlatformIO ilk derlemede gerekli STM32Cube HAL / derleyici paketlerini indirir; bu bağımlılıklar ZIP içine gömülü değildir.

## Davranış

- Normal mod: her **500 ms**'de aktif LED değişir (yeşil ⇄ kırmızı).
- Hızlı mod: her **125 ms**'de aktif LED değişir.
- Mavi **B1 USER** butonuna her basışta normal/hızlı mod değişir.
- Buton titreşimi için **40 ms yazılımsal debounce** kullanılır.
- `HAL_Delay()` yoktur; uygulama ana döngüsü bloke edilmez.
- Sistem saati 16 MHz HSI ile çalışır; PLL kullanılmaz.

## Donanım

| Fonksiyon | GPIO | Kart bileşeni | Elektriksel anlam |
|---|---|---|---|
| Yeşil LED | PG13 | LD3 | High → ON |
| Kırmızı LED | PG14 | LD4 | High → ON |
| Kullanıcı butonu | PA0 | B1 USER | Basılıyken High |

Kartta LED akım sınırlama dirençleri ve B1 için harici pull-down zaten bulunmaktadır. Bu pin bilgileri ST'nin UM1670 kullanıcı kılavuzu ve MB1075 şemasıyla karşılaştırıldı.

## Proje ağacı

```text
stm32f429-gpio-led-project/
├── platformio.ini           # Kart, framework ve ST-LINK yükleme ayarları
├── src/
│   ├── main.c               # HAL, sistem saati, SysTick ve ana döngü
│   └── app_led.c            # LED durum makinesi ve buton debounce
├── include/
│   └── app_led.h            # Uygulama arayüzü
├── docs/
│   ├── HARDWARE.md          # Donanım ve pin doğrulama
│   └── TEST_PLAN.md         # Beklenen davranış / kontrol listesi
├── tests/
│   ├── mocks/stm32f4xx_hal.h
│   └── test_app_led.c       # GCC ile çalışabilen bağımsız mantık testleri
├── .editorconfig
├── .gitignore
├── LICENSE
└── README.md
```

## Kurulum ve derleme

1. Visual Studio Code ve **PlatformIO IDE** eklentisini yükle.
2. PlatformIO'da **Open Project** ile bu klasörü aç (`platformio.ini` klasör kökünde olmalı).
3. Kartı ST-LINK USB portundan bilgisayara bağla.
4. PlatformIO terminalinde:

```bash
pio run
pio run --target upload
```

PlatformIO CLI yerine arayüzde **Build** ve **Upload** seçeneklerini de kullanabilirsin. Sistem ST-LINK sürücülerini gerektirebilir. STM32CubeIDE'nin doğrudan `.ioc` tabanlı yerel projesi değildir; burada *PlatformIO + STM32Cube HAL* kullanılmaktadır.

### İlk açılışta beklenen

- LD3 (yeşil) yanar, LD4 (kırmızı) sönüktür.
- 500 ms sonra LD3 söner, LD4 yanar.
- Mavi B1'e bir kez basınca değişim aralığı 125 ms'ye düşer.
- Tekrar basınca 500 ms'ye döner.

## Test etme

Uygulama mantığını STM32 kartı olmadan sınamak için makinede GCC varsa:

```bash
gcc -std=c11 -Wall -Wextra -Werror -Itests/mocks -Iinclude \
    tests/test_app_led.c src/app_led.c -o test_app_led
./test_app_led
```

Bu test **gerçek hedef donanımında derleme/yükleme yerine geçmez**.

## Tasarım notları

- Koda 16 MHz HSI saat kurulumu bilinçli şekilde eklendi; güç elektroniği kontrol döngüsünün zamanlama bütçesi için optimize edilmiş değildir.
- `SysTick_Handler()` içinde `HAL_IncTick()` çağrısı, `HAL_GetTick()` tabanlı zamanlamanın işlemesi için gereklidir.
- Mod değişiminde zamanlayıcı yeniden başlatılır; tek bir uzun döngüden dolayı art arda hızlı LED geçişleri yapılmaz.
- 32-bit tick sayacında `now - then` hesabı, sayaç taşmalarını tolere eder.

## Kaynaklar

- ST, UM1670: https://www.st.com/resource/en/user_manual/dm00093903-discovery-kit-with-stm32f429zi-mcu-stmicroelectronics.pdf
- PlatformIO `disco_f429zi`: https://docs.platformio.org/en/latest/boards/ststm32/disco_f429zi.html

## Lisans

MIT. Kaynak kodlar açık kullanım ve geliştirmeye uygundur.
