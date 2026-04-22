# 📱 ZNA CRM Mobile

Saha teknisyenleri ve yönetim ekibi için kurumsal CRM mobil uygulaması. **React Native + Expo** ile geliştirildi, **Supabase** backend üzerinde çalışır.

[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react&logoColor=white)](https://reactnative.dev)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![License](https://img.shields.io/badge/license-Private-red)](#)

---

## ✨ Özellikler

### 👷 Teknisyen Modu
- **Görev & Servis takibi** — bana atanan işler, durum geçişleri, fotoğraf eki, not geçmişi
- **Tara** — QR / Barkod / DataMatrix / PDF417 okuma + fener + zoom + haptic feedback
- **Stok yönetimi** — S/N'li cihazlar ve sarf malzemeleri, depo hareketleri
- **Servis formu** — 3 tip (Servis / Bakım / Arıza) PDF üretimi, önizleme, e-posta, yazıcıya gönderme
- **Müşteri / Lokasyon / Cihaz** — çok lokasyonlu müşteriler, cihaz ağacı
- **Malzeme planı** — teslim al → sahada kullan → otomatik stok düşümü
- **Müşteri imzası** — servis kapatma için dokunmatik imza

### 🧑‍💼 Admin Modu (Teknik Müdür / Genel Müdür / Yazılım Geliştirmeci)
- **Yönetim Paneli** — KPI kartları: Onay Bekleyen, Aktif Servis, Min-Stok Altı, Açık Destek
- **Onay Kuyruğu** — teknisyen tamamladığı servisleri onayla / reddet (gerekçe ile)
- **Personel Takip** — saha personeli + her birinin aktif iş sayısı + detay (gittiği lokasyonlar, kullandığı malzemeler)
- **Stok Raporu** — min seviye altı uyarılar, toplam kalem sayıları
- **Destek Talepleri** — kullanıcı sorunlarına cevap yazma + kapatma

### 🎨 UX
- **Gündüz / Gece modu** — tüm ekranlarda otomatik
- **Bildirim rozetleri** — modül kartlarında açık talep sayısı
- **Canlı Supabase senkron** — fokus aldığında otomatik yenileme
- **EAS Update OTA** — JS değişikliklerini mağaza onayı olmadan canlıya al

### 🔒 App Store Uyumlu
- Hesabı Sil (App Store kuralı gereği)
- Gizlilik Politikası ekranı
- Kullanım Koşulları ekranı
- Profilden yasal bağlantılar erişimi

---

## 🚀 Kurulum

```bash
git clone https://github.com/oguzmeric/ZNACRM-MOBILE-APP.git
cd ZNACRM-MOBILE-APP
npm install
cp .env.example .env
# .env içine Supabase URL ve ANON KEY yaz
npx expo start
```

Telefonunda **Expo Go** uygulamasını indir, terminalde çıkan QR kodu tara.

---

## 🏗️ Teknoloji Yığını

| Katman | Araç |
|---|---|
| Frontend | React Native 0.81 + Expo SDK 54 |
| Dil | JavaScript (JSX) |
| Navigasyon | `@react-navigation/native-stack` |
| Backend | Supabase (Postgres + Storage) |
| Auth | Custom (kullanici_adi + sifre üzerinden) |
| State | React Context API + AsyncStorage |
| Kamera / Barkod | `expo-camera` |
| PDF | `expo-print` + HTML template |
| Paylaşım | `expo-sharing` + `expo-mail-composer` |
| Görsel | `expo-image-picker`, `expo-asset` |
| Titreşim | `expo-haptics` |
| Tema | `ThemeContext` — darkColors / lightColors paletleri |
| Dağıtım | EAS Build (Android APK/AAB), EAS Update (OTA) |

---

## 📂 Proje Yapısı

```
src/
├── components/         # Yeniden kullanılabilir parçalar (Avatar, Modallar, ScreenContainer)
├── context/            # AuthContext, ThemeContext
├── lib/                # supabase client, mapper (snake ↔ camel)
├── navigation/         # RootNavigator (teknisyen / admin / auth stack'leri)
├── screens/
│   ├── admin/          # Admin paneli ekranları (6 adet)
│   └── *.js            # Teknisyen ekranları (30+ adet)
├── services/           # Supabase çağrı katmanı (13 servis dosyası)
├── templates/          # HTML template üreticileri (servis formu)
├── utils/              # format, servis sabitleri, rol kontrolü
└── theme.js            # Renk paleti + spacing + shadow tanımları
```

---

## 📦 Dağıtım

### EAS Update (OTA — JS değişiklikleri için)
```bash
npx eas-cli update --branch main --message "Değişiklik açıklaması"
```
Kullanıcılara anında dağıtır, mağaza onayı yok.

### EAS Build (Native değişiklikler için)
```bash
npx eas-cli build --profile production --platform android
npx eas-cli build --profile production --platform ios
```
Android: APK / AAB üretir. iOS için **Apple Developer hesabı** ($99/yıl) gerekli.

### Mağazaya yükleme
```bash
npx eas-cli submit --platform android   # Play Store
npx eas-cli submit --platform ios       # App Store / TestFlight
```

---

## 🗄️ Supabase Şeması (Özet)

Ana tablolar:
- `kullanicilar` — rol + unvan + durum + foto_url
- `musteriler` / `musteri_kisileri` / `musteri_lokasyonlari`
- `servis_talepleri` — durum akışı: `bekliyor → inceleniyor → atandi → devam_ediyor → tamamlandi → onaylandi/reddedildi`
- `gorevler` — atanan iş + notlar + fotoğraflar
- `stok_kalemleri` (S/N'li) + `stok_urunler` (sarf/bulk)
- `servis_malzeme_plani` — planlı / teslim / kullanılan miktarlar
- `teklifler` + satırlar (jsonb)
- `destek_talepleri` — kullanıcıdan gelen sorunlar

---

## 🔐 Roller

| Unvan | Admin Paneli | Sayım | Servis |
|---|---|---|---|
| Teknisyen | ❌ | ❌ | ✅ |
| Depo Sorumlusu | ❌ | ✅ | ❌ |
| Admin | ❌ | ✅ | ✅ |
| Teknik Müdür | ✅ | ✅ | ✅ |
| Genel Müdür | ✅ | ❌ | ❌ |
| Yazılım Geliştirmeci | ✅ | ✅ | ✅ |

---

## 📝 Lisans

Özel. ZNA Teknoloji'nin iç kullanımı için geliştirilmiştir.

---

## 👤 Geliştirici

**Oğuz Meriç** — Yazılım Geliştirmeci  
📧 destek@zna.com.tr

---

> Bu uygulama **crm-app** (web) ile aynı Supabase backend'ini paylaşır — teknisyen mobilde güncelleme yaptığında web'de anlık görünür.
