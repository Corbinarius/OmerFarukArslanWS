# Site içinde proje dosyaları

## Kullanım
1. Yönetici girişi yap ve Proje ekle bölümünü aç.
2. Başlık, platform, açıklama ve zorluk seviyesini doldur.
3. Bilgisayarımdan proje klasörü seç alanıyla projenin kök klasörünü seç.
4. Seçilen dosyaları kontrol et ve yayımla. Proje detayı otomatik açılır.
5. Proje dosyaları sekmesindeki klasörleri aç/kapat; .c, .h veya diğer desteklenen dosyalara tıkla. Dosya ara alanı alt klasörlerdeki dosyaları da bulur.

Tarayıcıya C:\\Projects gibi bir yol yazmak erişim izni vermez; sistemin klasör seçme penceresinde klasör seçilmelidir. Yükleme bir anlık kopyadır, bilgisayardaki sonraki değişiklikler otomatik eşitlenmez.

Klasör yüklemeleri mevcut Netlify Blobs deposunda kalıcı saklanır. Yeni klasör/dosya yükleme sınırı: 100 MB (104857600 bayt), en fazla 10000 UTF-8 kaynak dosyası. Tek bir kaynak dosyası da 100 MB olabilir. Desteklenmeyen dosyalar ve .git/.env gibi yollar atlanır; seçim özeti atlanan dosyaları bildirir. Desteklenen kaynak dosyalarının toplam boyutu esas alınır; derleme çıktıları ve desteklenmeyen ikili dosyalar yüklenmez.

## GitHub ve eski ZIP kayıtları
- Herkese açık GitHub deposunun kök URL'si desteklenir: https://github.com/kullanici/depo
- Varsayılan dalın dosya ağacı alınır; seçilen kaynak dosyası aynı sayfada açılır. Özel depolar ve alt klasör/dal URL'leri desteklenmez.
- GitHub kaynakları GitHub'dan okunur; bağımsız kalıcı kopya oluşturulmaz. GitHub erişim sınırında hata ve yeniden deneme düğmesi gösterilir.
- Önceden yayımlanmış ZIP kayıtları tarayıcı belleğinde açılır; kullanıcıya ZIP indirme veya sayfadan ayrılma zorunluluğu yoktur. Yeni yüklemeler için klasör seçimi kullanılır.
- ZIP görüntüleme: 16 MB arşiv/açılmış kaynak sınırı, 2000 desteklenen dosya; dosya başına 256 KB önizleme. Standart store/deflate ZIP desteklenir; şifreli/ZIP64 arşivler desteklenmez. Güncel Chrome/Edge önerilir.
- Kod salt okunur metin olarak gösterilir, çalıştırılmaz. Satır numaraları, kopyalama ve isteğe bağlı tek dosya indirme vardır.

## Yayına alma
Bu kaynak paketini mevcut Netlify projenizin kaynak deposuna aktarın ve yeniden deploy edin. Mevcut netlify.toml, Identity ve Blobs ayarları korunmuştur. Sunucu fonksiyonları gerektiğinden yalnızca index.html dosyasını açmak veya public klasörünü statik olarak yüklemek yeterli değildir.

## Doğrulama
npm run check: 27 test ve TypeScript kontrolü başarılı.
npm run build:identity: başarılı.
Tarayıcıda örnek STM32 projesiyle dosya ağacı, C/header geçişi ve arama kontrol edildi. ZIP ve GitHub bağdaştırıcıları otomatik testlerde örnek yanıtlarla doğrulandı. Canlı Netlify hesabında giriş/yükleme ve gerçek GitHub API bağlantısı bu ortamda doğrulanmadı.

## 100 MB parçalı yükleme

- Her veri isteği en fazla 512 KB; küçük dosyalar aynı parçada birleştirilir. 100 MB için 200 veri isteği oluşur.
- Dosya ağacı ve proje bilgileri ayrı, küçük bir başlangıç isteğinde gönderilir. Yol listesinin UTF-8 sınırı 2.5 MB'dır.
- Her parçanın SHA-256 özeti ve boyutu sunucuda kontrol edilir. Eksik veya bozuk parça varsa proje yayımlanmaz.
- Yükleme yüzdesi ve gönderilen MB gösterilir. Geçici ağ/sunucu hatalarında üç otomatik tekrar yapılır.
- Tekrarlar yetmezse aynı sekmede, aynı dosya ve bilgilerle yeniden Yayımla düğmesine basın. Başarılı parçalar tekrar gönderilmez. Sayfayı yenilemek/tarayıcıyı kapatmak devam bilgisini kaybettirir.
- Yükleme oturumu 24 saat geçerlidir. Tamamlanmamış yüklemeler herkese açık listede görünmez. Süresi dolan taslakların arka planda otomatik temizliği bu sürümde yoktur.
- Kaynak dosyalarının ilk 256 KB bölümü site içinde önizlenir; büyük dosyalarda açıkça belirtilir. İndir düğmesi dosyanın tamamını yine küçük isteklerle getirir. Kopyala yalnız görüntülenen bölümü kopyalar.
- Katalog tüm projelerin dosya listelerini taşımaz; ilgili projenin ağacı açıldığında getirilir.
- Önceki multipart API eski istemciler için 2 MB sınırıyla korunur; güncel arayüz yeni parçalı akışı kullanır. Eski ZIP/GitHub görüntüleme sınırları değişmedi.
- Site planının toplam depolama, bant genişliği ve kullanım kotası ayrıca geçerlidir. Parçalama tek istek boyutu sınırını çözer.

Testler: 100 MB / 200 parça uçtan uca akışı, 100 MB + 1 bayt reddi, eksik/bozuk parça, yetkisiz ve süresi dolmuş oturum, tekrar yayımlama, silme, çok sayıda küçük dosya, bağlantı kesilmesi sonrası eksik parçadan devam, parça sınırından geçen UTF-8 kaynak önizlemesi ve tam dosya indirme. Bu testler yerel bellek deposuyla çalıştırıldı; canlı Netlify'a 100 MB aktarım yapılmadı.

Netlify payload referansı: https://docs.netlify.com/build/functions/configuration/
