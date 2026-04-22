# CRM Mobil

Saha teknisyenleri ve satış ekibi için React Native + Expo mobil uygulama. Mevcut **crm-app** (web) ile **aynı Supabase** backend'ini paylaşır.

## Modüller

| Modül | Kullanıcı | Durum |
|---|---|---|
| Giriş / Profil | Tüm | ✅ İskelet |
| Görevler (görüntüle + ata) | Tüm | 🔜 Placeholder |
| Servis Talepleri | Teknisyen | 🔜 Placeholder |
| Tara — S/N · Barkod · QR + OCR | Teknisyen | 🔜 Placeholder |
| Aracımdaki Stok | Teknisyen | 🔜 Placeholder |
| Teklif (hazırla + email) | Satışçı | 🔜 Placeholder |
| Müşteriler | Tüm | 🔜 Placeholder |

## Kurulum

```bash
cd crm-mobile
npm install
cp .env.example .env
# .env içine Supabase URL ve ANON KEY yaz (web crm-app ile aynı)
npm start
```

Telefonuna **Expo Go** uygulamasını indir, terminalde çıkan QR kodu okut.

## Android'e çıkış

### 1) Geliştirme — Expo Go (en hızlı)
- `npm start` → telefon Expo Go'da QR kodu oku → app hemen açılır.
- Kamera, lokasyon, image-picker Expo Go'da çalışır.

### 2) Test — APK (mağaza onayı yok)
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```
- ~15 dk sonra EAS bir APK linki verir.
- WhatsApp/email ile teknisyene gönder, kurulum (3. parti uygulama izni gerekir).
- Aylık 30 ücretsiz build.

### 3) Yayın — Play Store
```bash
eas build --platform android --profile production   # AAB üretir
eas submit --platform android                       # Play Store'a yükler
```
- Önce **Google Play Developer hesabı** ($25 tek seferlik) gerekli.
- İlk yayın 1-3 gün incelemede.

## iOS

- Expo Go ile geliştirme: hemen çalışır (App Store'dan Expo Go indir).
- Yayın: **Apple Developer** hesabı gerekli ($99/yıl).
- `eas build --platform ios --profile production` → TestFlight veya App Store.

## Klasör yapısı

```
src/
├── lib/           # supabase client, mapper (snake↔camel)
├── context/       # AuthContext (oturum + kullanıcı/rol)
├── navigation/    # RootNavigator (login vs ana stack)
├── screens/       # Ekranlar (Login, Home, vs.)
├── components/    # Tekrar kullanılan parçalar
├── services/      # Supabase çağrıları (gorevService, servisService, vb.)
└── utils/         # Yardımcılar (sync queue, format, vb.)
```

## Sıradaki adımlar

1. Supabase migration: `musteri_lokasyonlari`, `stok_kalemleri`, `stok_kalemi_hareketleri` tabloları.
2. `services/` katmanı (web'deki `servisService`, `gorevService` vb. mobil için uyarlama).
3. Tara ekranı: `expo-camera` ile barkod/QR + OCR fallback.
4. Teklif ekranı + Supabase Edge Function (PDF + email — Resend).

## Notlar

- **Aynı Supabase**: web ve mobil aynı tabloları okur/yazar; herhangi bir teknisyen telefonda durum güncellerse web'de anlık görünür.
- **Rol kontrolü**: `kullanicilar.rol` alanı menü/ekran erişimini belirler. Şu an "görev atama" herkese açık (ileride kısıtlanabilir).
- **OCR (üretici S/N etiketi)**: ML Kit native modül gerektirir → Expo Go'da çalışmaz, sadece **EAS Dev Build** ile aktif olur. Önce barkod/QR scanner devreye alınacak, OCR ikinci aşamada.
