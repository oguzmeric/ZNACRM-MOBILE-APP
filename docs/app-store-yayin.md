# App Store yayın dosyası — ZNA CRM (iOS)

App Store Connect'e girilecek her metin burada. **Alanları buradan kopyala.**
Karakter sınırları Apple'ın kendi sınırlarıdır; aşarsan kayıt kabul edilmez.

- App Store Connect kaydı: `ascAppId 6764050085`
- Bundle ID: `com.zna.crmmobile`
- Dağıtım kararı (18.08): **herkese açık App Store**, iPhone-only
  (`supportsTablet: false` — iPad ekran görüntüsü zorunluluğu ve iPad kaynaklı
  red riski böylece kalkar)

---

## 1. Mağaza künyesi

| Alan | Değer | Sınır |
|---|---|---|
| **Name** | `ZNA CRM` | 30 |
| **Subtitle** | `Saha servis ve iş takibi` | 30 |
| **Primary Category** | Business | — |
| **Secondary Category** | Productivity | — |
| **Age Rating** | 4+ | — |
| **Copyright** | `2026 ZNA Teknoloji` | — |
| **Support URL** | `https://talep.znateknoloji.com/yardim` | — |
| **Marketing URL** | `https://www.znateknoloji.com.tr` | — |
| **Privacy Policy URL** | `https://talep.znateknoloji.com/gizlilik` | — |

> Ad alternatifi: aramada daha görünür olmak istersen `ZNA CRM — Saha Servis`
> (20 karakter) de kullanılabilir. Mevcut kayıtta ad zaten `ZNA CRM` ise
> değiştirmeye gerek yok.

### Keywords (100 karakter, virgülle ayrılmış, boşluk bırakma)

```
saha servis,teknik servis,iş takibi,görev,arıza,bakım,keşif,stok,mesai,teknisyen,servis formu
```

Uygulama adında ve alt başlıkta geçen kelimeleri buraya tekrar yazma —
Apple onları zaten indeksler, yer israfı olur.

### Promotional Text (170 karakter — yayından sonra da değiştirilebilir)

```
Saha ekipleri için servis, görev, keşif ve stok takibi. Müşteriler için arıza talebi açma ve sürecini anlık izleme. Tek uygulamada, sahadan ofise kesintisiz akış.
```

---

## 2. Description (4000 karakter)

```
ZNA CRM, güvenlik ve bilişim sistemleri kurulum, bakım ve servis süreçlerini uçtan uca yöneten bir saha hizmet uygulamasıdır. Sahadaki teknik ekip ile ofis arasındaki akışı tek yerde toplar; müşteri de kendi taleplerini aynı sistem üzerinden açar ve izler.

SAHA EKİBİ İÇİN

• Servis talepleri: Size atanan işleri görün, yerinde açın, yapılan işlemi ve kullanılan malzemeyi kaydedin, müşteri imzasıyla kapatın.
• Görevler: Ana görev ve alt görev yapısı, kabul/ret akışı, yorum ve dosya ekleri, gecikme takibi.
• Keşif: Sahada kroki çizin, fotoğraf üzerine işaretleme yapın, malzeme listesini otomatik çıkarın ve keşif raporunu paylaşın.
• Stok ve seri numarası: Barkod veya seri numarası okutarak ürün girişi/çıkışı yapın, üzerinizdeki envanteri anlık görün.
• Bakım: Planlı bakım işlerini adım adım tamamlayın, formu imzalatın, PDF çıktısını iletin.
• Mesai: QR ile mesai başlatın ve bitirin; kayıt, işlemin yapıldığı çalışma noktasıyla birlikte tutulur.
• Arızalı ürün girişi: Müşteriden alınan arızalı cihazı seri numarasıyla ya da seri numarası olmadan sisteme kaydedin.

MÜŞTERİLER İÇİN

• Arıza ve servis talebi açın; talebinize ait fotoğraf ve açıklamayı ekleyin.
• Talebinizin hangi aşamada olduğunu, kimin ilgilendiğini ve ne zaman kapandığını anlık izleyin.
• Yapılan işe ait servis formunu görüntüleyin ve değerlendirin.
• Size kurulmuş cihazların envanterini ve teklif taleplerinizi tek ekranda takip edin.

NASIL ÇALIŞIR

Uygulama, kurum yöneticisi tarafından tanımlanan hesaplarla kullanılır. ZNA Teknoloji ile çalışan kurumlar, kendilerine e-posta ile gönderilen davet bağlantısı üzerinden portal hesaplarını oluşturur ve taleplerini bu hesapla yönetir.

GİZLİLİK VE GÜVENLİK

• Veriler Avrupa Birliği (İrlanda) bölgesindeki sunucularda barındırılır, aktarım TLS ile şifrelenir.
• Her kullanıcı yalnız yetkili olduğu kayıtları görür; yetkilendirme satır düzeyinde uygulanır.
• Konum yalnızca kullanıcı bir işlemi başlattığı anda, o işlem için alınır. Uygulama arka planda konum takibi yapmaz.
• Kamera ve galeri erişimi yalnız kullanıcının çektiği veya seçtiği görseller içindir.
• Uygulamada reklam ve uygulama içi satın alma yoktur.
• Hesabınızı dilediğiniz an uygulama içinden silebilirsiniz: Profil > Hesabı Sil.

Gizlilik politikası: https://talep.znateknoloji.com/gizlilik
Yardım ve destek: https://talep.znateknoloji.com/yardim
```

---

## 3. What's New (sürüm notu)

İlk App Store yayını için:

```
ZNA CRM ilk kez App Store'da.

• Saha ekibi için servis, görev, keşif, bakım ve stok takibi
• Müşteriler için arıza talebi açma ve süreci anlık izleme
• Seri numarası ve barkod okuma ile hızlı stok işlemleri
• Keşifte kroki çizimi ve fotoğraf üzerine işaretleme
• QR ile mesai başlatma ve bitirme
```

---

## 4. App Privacy anketi (App Store Connect > App Privacy)

Aşağıdaki tablo, uygulamanın gerçekte topladığı veriye göre 18.08'de
hazırlandı. **Tracking sorusuna cevap: HAYIR** — hiçbir veri reklam veya
izleme amacıyla kullanılmıyor, üçüncü taraf veri simsarına aktarılmıyor.

| Apple kategorisi | Veri türü | Toplanıyor mu | Amaç | Kimliğe bağlı mı |
|---|---|---|---|---|
| Contact Info | Name | Evet | App Functionality | Linked |
| Contact Info | Email Address | Evet | App Functionality | Linked |
| Contact Info | Phone Number | Evet | App Functionality | Linked |
| Location | Precise Location | Evet | App Functionality | Linked |
| User Content | Photos or Videos | Evet | App Functionality | Linked |
| User Content | Other User Content | Evet | App Functionality | Linked |
| Identifiers | User ID | Evet | App Functionality | Linked |
| Diagnostics | Crash Data | Evet | App Functionality | Not Linked |
| Diagnostics | Performance Data | Evet | App Functionality | Not Linked |

Toplanmıyor olarak işaretlenecekler: Financial Info, Health & Fitness,
Browsing History, Search History, Purchases, Sensitive Info, Contacts,
Advertising Data, Usage Data.

> "Other User Content" = servis/görev notları, imzalar, keşif krokileri.
> Crash/Performance verisi Sentry üzerinden toplanır; kullanıcı kimliğine
> bağlanmadığı için "Not Linked".

---

## 5. App Review Information

Apple incelemecisinin okuyacağı not. **İngilizce yazılır.** Bu notun amacı,
"bu uygulama yalnız bir şirketin çalışanları için, App Store'a uygun değil"
(Guideline 4.2) itirazını baştan karşılamaktır — uygulamanın dış müşterilere
de açık olduğunu net söyler.

```
ZNA CRM is a field service management app with two distinct audiences:

1. Field technicians and office staff of ZNA Teknoloji, a security and IT
   systems integrator, who manage service requests, tasks, site surveys,
   maintenance and inventory.

2. Corporate customers of ZNA Teknoloji, who use the app to open fault and
   service requests, follow their progress in real time, review the completed
   service form, and see the inventory of devices installed at their sites.

Accounts are provisioned by the company: customer accounts are created through
an e-mail invitation link. A working demo account with representative sample
data is provided below so the review team can access all functionality.

LOCATION: Location is requested only in the foreground, at the moment the user
starts a specific action — clock-in/clock-out verification, recording the
address where a service or site survey took place, and vehicle photo logs.
The app performs no background location tracking.

CAMERA / PHOTOS: Used for barcode and serial-number scanning and for attaching
photos to service, survey and maintenance records. The app never scans the
photo library; only user-selected images are uploaded.

ACCOUNT DELETION: Available in-app under Profile > Delete Account
(Profil > Hesabı Sil).

The app contains no advertising, no in-app purchases and no public
user-generated content.

Privacy policy: https://talep.znateknoloji.com/gizlilik
Support: https://talep.znateknoloji.com/yardim
```

### Demo hesabı (bu alanı SEN doldur)

App Store Connect > App Review Information > Sign-In Information:

- `Sign-in required` işaretli olmalı
- Kullanıcı adı / e-posta: **_______**
- Parola: **_______**

> ⚠️ Demo hesabı **gerçek müşteri verisi görmemeli**. En temizi, portal
> müşterisi tipinde ayrı bir hesap açıp içine birkaç örnek talep koymak.
> İncelemeci hesabın içine girip her ekranı gezecektir.

---

## 6. Ekran görüntüleri

Zorunlu boyut: **6.9" iPhone — 1320 × 2868 piksel** (dikey).
Apple bu seti diğer iPhone boyutlarına kendisi ölçekler; ek boyut şart değil.

- En az 3, en çok 10 görsel. 5-6 tanesi ideal.
- Durum çubuğu görünür olabilir, sorun değil.
- ⚠️ **Gerçek müşteri adı, telefonu ve adresi görünmemeli.** Demo hesabıyla
  veya örnek kayıtlarla çek.

Önerilen sıra (ilk iki görsel en çok görülendir):

1. Ana ekran — bugünkü işler / özet
2. Servis talebi detayı — yapılan işlem ve malzeme
3. Keşif krokisi veya fotoğraf üzerine işaretleme
4. Stok / seri numarası okutma
5. Görev listesi
6. Müşteri tarafı — talep açma ekranı

**Nasıl alınır:** TestFlight'taki uygulamayı iPhone'da aç, ilgili ekranlarda
ekran görüntüsü çek (yan tuş + ses açma), görselleri bana gönder. Boyutu
1320 × 2868'e ben ayarlayıp App Store Connect'e yüklenecek hâle getiririm.

---

## 7. Gönderim adımları

```bash
npx eas-cli@latest build --platform ios --profile production
```

Build bitince:

```bash
npx eas-cli@latest submit --platform ios --profile production
```

Sonra App Store Connect'te:

1. Uygulama > **+ Version or Platform** ile yeni bir App Store sürümü aç
2. Yukarıdaki metinleri ve ekran görüntülerini gir
3. Build bölümünden yeni yüklenen build'i seç
4. App Privacy anketini doldur (bölüm 4)
5. App Review Information'a notu ve demo hesabı gir (bölüm 5)
6. **Add for Review** → **Submit**

İnceleme tipik olarak 24-48 saat sürer. Red gelirse Apple gerekçeyi Resolution
Center'da yazar; itiraz veya düzeltme aynı ekrandan yapılır.
