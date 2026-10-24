# Yönetici paneli ve ana sayfa

## Kullanım
Sağ üstte Yönetici paneli düğmesini açın. Yönetici hesabınızla giriş yaptıktan sonra proje yükleme (100 MB parçalı akış), ana sayfa içeriği ve PDF yönetimi kullanılabilir.

Hakkımda, çalışma alanları, her iki bölümün etiketleri ve LinkedIn profil adresi Ana sayfa içeriği bölümünden değiştirilir. Kaydettiğiniz değişiklikler Netlify Blobs içinde tutulur; ziyaretçilere de gösterilir. Metinler HTML olarak çalıştırılmaz.

## İlk yönetici hesabı ve kullanıcı adı
Mevcut Netlify Identity kurulumu korunmuştur. Yönetici hesabınız varsa aynı e-posta/şifre ile giriş yapın. Hesabın Identity tarafında admin rolü bulunmalıdır. Yeni hesap gerekiyorsa Identity üzerinden davet oluşturun ve davet bağlantısıyla şifrenizi belirleyin. Hesap kurtarma / davet düğmesi bu akışı korur.

E-posta yerine kısa kullanıcı adıyla giriş için Netlify ortam değişkenlerine, Functions kapsamında:

- ADMIN_USERNAME: kullanmak istediğiniz kullanıcı adı (örnek: omer)
- ADMIN_EMAIL: mevcut admin Identity hesabınızın e-posta adresi

ekleyip yeniden deploy edin. Bu eşleme yalnızca sunucudadır. Şifre yine Identity hesabının şifresidir; kaynak kodda hazır/parola veya yeni hesap yoktur. Bu değişkenler tanımlı değilse e-posta ile giriş çalışır, kısa kullanıcı adı çalışmaz.

## LinkedIn
Gerçek profil adresi sağlanmadığı için yanlış bir profil bağlantısı eklenmedi. Panelden https://www.linkedin.com/in/... adresinizi kaydedin; sol üstte ismin yanındaki LinkedIn bağlantısı etkinleşir.

## Aktif ziyaretçi sayacı
45 saniyede bir, görünür sayfalardan rastgele tarayıcı kimliği gönderilir. Aynı tarayıcıdaki sekmeler aynı kimliği kullanır. Şimdiki ve önceki dakika kovalarındaki tekil kimlikler sayılır (yaklaşık 60–120 saniye etkinlik penceresi). Bu bir insan doğrulaması değildir; farklı cihaz/tarayıcılar ayrı sayılır, botlar kesin olarak ayırt edilmez. İsim, IP, e-posta toplanmaz. Sunucu erişilemiyorsa uydurma sayı yerine — gösterilir.

presence-cleanup zamanlanmış fonksiyonu eski sayaç kayıtlarını beş dakikada bir, işlem başına en fazla 200 kayıtla temizler. Sayaç fonksiyon ve depolama kullanımına dahildir; trafik arttığında plan kotasını izleyin. Zamanlanmış temizliğin çalışması Netlify yayını gerektirir.

## Temalar
Sağ üstteki düğme açık/koyu temayı değiştirir. Tercih yalnız ziyaretçinin tarayıcısında saklanır. Varsayılan koyu temadır.

## Yayın ve doğrulama
Paketin tamamını mevcut Netlify kaynak projesine aktarın, yeniden deploy edin. Yalnız public klasörünü statik yüklemek; kimlik doğrulama, kalıcı ayarlar, sayaç ve proje yüklemeyi çalıştırmaz.

31 otomatik test, TypeScript kontrolü ve Identity derlemesi başarılı. Tarayıcıda tema düğmesi ve panel açılışı; örnek oturumda yönetici alanları kontrol edildi. Gerçek Netlify hesabında giriş ve canlı sayaç henüz test edilmedi. qa-*.html test sayfaları dağıtım paketine dahil değildir.
