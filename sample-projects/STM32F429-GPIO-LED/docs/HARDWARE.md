# Donanım bağlantıları

Hedef kart: **STM32F429I-DISC1**, MCU **STM32F429ZIT6**.

| MCU pini | Kart üstündeki işlev | HAL konfigürasyonu |
|---|---|---|
| PG13 | LD3 yeşil LED | Output / push-pull / no pull / low speed |
| PG14 | LD4 kırmızı LED | Output / push-pull / no pull / low speed |
| PA0 | B1 USER (mavi) | Input / no internal pull; harici pull-down var |

Kart üzerindeki LD3/LD4 bağlantıları aktif-high'dır; mantıksal `GPIO_PIN_SET` ilgili LED'i yakar.

## Pratik doğrulama

1. Kart güç LED'inin yandığını doğrula.
2. LD3/LD4 üzerindeki davranışı incele; ekstra jumper gerekmez.
3. B1 butonuna bir kez bas; yanıp sönme hızının değiştiğini gözle.
4. Hız çok farklıysa kart saat ve SysTick yapılandırmasını gözden geçir.

## Referans

- ST UM1670, bölüm 7.5 LED'ler ve 7.6 butonlar.
- ST MB1075 şemasında PG13 → LD3 ve PG14 → LD4 bağlantıları.
