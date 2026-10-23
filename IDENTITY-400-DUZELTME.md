# Netlify Identity 400 – Hata ayrıştırma yaması

## Neden?
Eski `document-auth.mts`, Netlify Identity işlemindeki her hatayı HTTP 400 ve tek bir genel mesaj olarak dönüyordu. Bu nedenle davet tokenı reddedilse de servis bağlantı hatası yaşansa da aynı mesaj görünüyordu. Bu yama kullanıcının parolasını, tokenını veya davet bağlantısını loglamadan işlem aşamasını ve Netlify Identity hata durumunu Functions loglarına kaydeder.

## Yüklenecek dosyalar
- `netlify/functions/document-auth.mts`
- `public/assets/documents.js`

GitHub Desktop üzerinde mevcut projenin aynı yollarına kopyalayın; `Commit to main` ardından `Push origin` yapın. Netlify otomatik deploy tamamlayınca yeni e-posta bağlantısı isteyin. **Eski şifre sıfırlama bağlantısını kullanmayın.**

## Netlify'da hata nedenini bulma
1. Netlify > Project > Logs > Functions > `document-auth` bölümünü açın.
2. **Yeni** recovery e-postasındaki bağlantıya tıklayıp şifrenizi kaydetmeyi deneyin.
3. Logda `[document-auth] identity failure` olayındaki `phase`, `status`, `code`, `message` alanlarına bakın.
4. `phase: reset`, `status: 400` gerçek kimlik sağlayıcısının şifre sıfırlama isteğini reddettiğini gösterir. `status: 0`, `503` gibi durumlar servis / runtime hatasına işaret edebilir.
5. Hiç log görünmüyor ve tarayıcı `404`/`502` veriyorsa ilgili Function deploy edilmemiş veya çalışmamış olabilir.

Davet bağlantılarıyla ilgili hassas `invite_token`, `recovery_token`, `nf_jwt`, `nf_refresh` değerlerini paylaşmayın. Diagnostic kodlarını ve tokenlardan arındırılmış hata metnini paylaşmak yeterlidir.

## Önemli
Yama ilkesi güvenli tanılama + durum ayrıştırmasıdır; yeniden davet/sıfırlama tokenının neden reddedildiğini log olmadan kesin saptayamaz. Netlify'ın resmi `@netlify/identity` API'sindeki `acceptInvite(token,password)` ve `recoverPassword(token,password)` çağrıları aynen kullanılmıştır.
