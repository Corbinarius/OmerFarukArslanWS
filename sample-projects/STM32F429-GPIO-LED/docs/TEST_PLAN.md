# Fonksiyonel test planı

| ID | İşlem | Beklenen sonuç | Doğrulama |
|---|---|---|---|
| T01 | Kartı resetle | Yeşil LED ON, kırmızı OFF | Kart üzerinde gözlem |
| T02 | 500 ms bekle | Yeşil OFF, kırmızı ON | Kart üzerinde gözlem |
| T03 | B1'e bas, 40 ms'den uzun tut | Hızlı moda geçiş | Buton + gözlem |
| T04 | B1'i 125 ms'den uzun tut | Her 125 ms'de LED değişimi | Kart üzerinde gözlem |
| T05 | B1'i bırak, yeniden bas | Normal moda geri dönüş | Kart üzerinde gözlem |
| T06 | Butona kısa (<40 ms) darbe ver | Yanıp sönme modu değişmez | Debounce kontrolü |
| T07 | Uzun süre çalıştır | HAL tick taşması dahil kararlı çalışma | Uzun dönem test; henüz yapılmadı |

## Ölçüm bilgisi

- Zamanlama **HAL_GetTick()** üzerinden, yaklaşık 1 ms çözünürlüktedir.
- LED çıkışlarının 500/125 ms süreleri nominal yazılım hedefidir, ölçüm sonucu değildir.
- İşlemci, derleyici ve gerçek kart için fiziksel doğrulama henüz yapılmamıştır.
