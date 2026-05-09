# Mobil İyileştirmeler — Tasarım

**Tarih:** 2026-05-09
**Kapsam:** crm-mobile (Expo SDK 52, Supabase backend)
**Hedef:** 4 bağımsız iyileştirme — push notification, servis formu PDF arşivi, pull-to-refresh standardizasyonu, tarih picker standardizasyonu.

---

## 1. Push Notification (Expo Push)

### Amaç
Her in-app bildirim, kullanıcının cihazına push olarak da iletilsin. Uygulama kapalıyken/arka plandayken kilit ekranında görünür. Kullanıcı bildirim tipi seçmez — tüm bildirimler push.

### Altyapı
- **Servis:** Expo Push Notifications (ücretsiz, Expo'nun APNs/FCM relay'i)
- **Paket:** `expo-notifications`
- **Edge Function:** Supabase Edge Function `push-gonder` — Expo Push API'ye HTTP POST atar

### Veri Modeli

Yeni tablo:
```sql
create table kullanici_push_tokenlari (
  id bigserial primary key,
  kullanici_id bigint not null references kullanicilar(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  son_gorulen timestamptz default now(),
  olusturma_tarih timestamptz default now(),
  unique (kullanici_id, token)
);
create index idx_push_token_kullanici on kullanici_push_tokenlari(kullanici_id);
```

Bir kullanıcının birden fazla cihazı olabilir → çoklu token. `unique(kullanici_id, token)` aynı tokeni yeniden kayıt etmeyi engeller.

### Akış

**Token kaydı (login sonrası):**
1. `expo-notifications` permission iste
2. Permission alındıysa `getExpoPushTokenAsync()` ile token al
3. `kullanici_push_tokenlari` tablosuna upsert (mevcut token varsa `son_gorulen` güncelle)
4. Logout'ta o cihazın tokeni silinir

**Push trigger:**
1. Mevcut `bildirimleriEkle` fonksiyonu yeni satır ekliyor
2. `bildirimler` tablosuna `AFTER INSERT` PostgreSQL trigger eklenir
3. Trigger Supabase Edge Function `push-gonder`'i `pg_net` veya `http` extension ile çağırır (payload: bildirim id)
4. Edge Function:
   - Bildirimi DB'den çeker
   - Hedef kullanıcının tüm `token`'larını alır
   - Expo Push API'ye batch POST atar (`https://exp.host/--/api/v2/push/send`)
   - Geçersiz token (`DeviceNotRegistered`) dönerse o token tablodan silinir

**Tıklama davranışı:**
- Bildirime dokunma → uygulama açılır, son ekranda kalır
- Deep link YOK
- Kullanıcı app içindeki çan ikonuna basıp listeyi açar
- Realtime subscription zaten aktif olduğu için badge sayısı otomatik güncellenir

**iOS/Android badge:**
- App foreground'da: `okunmamis` count'a göre `setBadgeCountAsync` çağrılır
- Yeni push geldiğinde Expo otomatik badge artırır (payload'a `badge` koyarsak)

### Hata Senaryoları
- Permission reddi → token kaydı yapılmaz, in-app bildirim çalışmaya devam eder, sessiz fail
- Edge Function hatası → bildirim DB'ye eklenmeye devam eder (in-app çalışır), push gönderilemez
- Geçersiz token → otomatik temizleme

### Etkilenen Dosyalar
- `src/lib/pushBildirimKayit.js` *(yeni)* — token al/kaydet/sil
- `src/services/bildirimService.js` — değişmez
- `App.js` veya AuthContext — login sonrası token kayıt çağrısı
- `supabase_migrations/031_push_tokenlari.sql` *(yeni)*
- `supabase/functions/push-gonder/index.ts` *(yeni)* — Edge Function
- DB trigger SQL'i migration içinde

---

## 2. Servis Formu PDF Arşivi

### Amaç
Üretilen her servis formu PDF'i Supabase Storage'a kaydedilsin. Servis detay ekranında "Form Arşivi" bölümü ile geçmiş versiyonlar görünür/indirilebilir olsun.

### Veri Modeli

```sql
create table servis_formu_arsivi (
  id bigserial primary key,
  servis_id bigint not null references servis_talepleri(id) on delete cascade,
  dosya_yolu text not null,
  olusturan_id bigint not null references kullanicilar(id),
  boyut_byte int,
  olusturma_tarih timestamptz default now()
);
create index idx_arsiv_servis on servis_formu_arsivi(servis_id, olusturma_tarih desc);
```

### Storage
- Bucket: `servis-formlari` (private)
- RLS: kullanıcı sadece yetkili olduğu servisin formlarına erişir
- Dosya yolu: `servis_{servisId}/{ISO timestamp}.pdf`
  - Örnek: `servis_124/2026-05-09T14-30-15Z.pdf`
- Mime: `application/pdf`

### Akış
1. `servisFormuService.formuOlustur` PDF üretir (mevcut)
2. PDF dosyası Supabase Storage'a yüklenir
3. `servis_formu_arsivi` tablosuna kayıt
4. Mevcut paylaş akışı çalışmaya devam eder
5. Yükleme başarısız olursa: kullanıcıya `Alert` ile uyarı, PDF yine de paylaşılabilir (yerel dosya hâlâ var)

### UI

**Servis Detay ekranı:**
- Yeni bölüm: `📎 Form Arşivi` (mevcut form üret butonunun altında)
- Liste, en yeni üstte:
  ```
  📄 09.05.2026 14:30 — Mehmet Y.       [İndir] [Paylaş]
  📄 08.05.2026 09:15 — Mehmet Y.       [İndir] [Paylaş]
  ```
- İlk üretimden önce: bölüm gizli ya da "Henüz arşiv yok" boş durumu
- İndir/Paylaş: signed URL (1 saat geçerli) → expo-file-system ile indir → expo-sharing

### Geriye Dönük
- Eski form üretimleri için migrasyon yok
- Bu özellik yayına çıktıktan sonra üretilen formlar arşive girer

### Etkilenen Dosyalar
- `src/services/servisFormuService.js` — PDF üretim sonrası upload + DB insert
- `src/services/servisFormuArsivService.js` *(yeni)* — liste/indir/sil
- `src/screens/ServisTalebiDetayScreen.js` — yeni bölüm
- `supabase_migrations/032_servis_formu_arsivi.sql` *(yeni)*
- Supabase Storage bucket setup (manuel veya migration)

---

## 3. Pull-to-Refresh Standardizasyonu

### Amaç
Tüm liste/detay ekranlarında tutarlı pull-to-refresh davranışı.

### Pattern

Yeni custom hook `src/hooks/useRefresh.js`:
```js
import { useState, useCallback } from 'react'
import { RefreshControl } from 'react-native'

export function useRefresh(yukleFn) {
  const [yenileniyor, setYenileniyor] = useState(false)
  const onRefresh = useCallback(async () => {
    setYenileniyor(true)
    try { await yukleFn() } finally { setYenileniyor(false) }
  }, [yukleFn])
  return {
    yenileniyor,
    refreshControl: <RefreshControl refreshing={yenileniyor} onRefresh={onRefresh} />,
  }
}
```

Kullanım:
```js
const { refreshControl } = useRefresh(yukle)
<FlatList refreshControl={refreshControl} ... />
```

### Etkilenecek Ekranlar

Implementation öncesi repo taranacak. **Tahmini liste:**
- `GorevlerScreen.js`
- `ServisTalepleriScreen.js`
- `GorusmelerScreen.js`
- `TekliflerScreen.js`
- `MusteriDetayScreen.js` (alt sekmeler: Kişiler/Lokasyonlar/Cihazlar/Servisler)

Mevcut implementasyonu olanlar (BildirimlerScreen, DemolarScreen) aynı pattern'e migrate edilir — değişen davranış yok, kod tekilleşir.

### Etkilenen Dosyalar
- `src/hooks/useRefresh.js` *(yeni)*
- Yukarıdaki ekranlar — taramanın gösterdiği eksiklere göre

---

## 4. Tarih Picker Standardizasyonu

### Amaç
Tüm tarih girişlerinde tek paket, iki wrapper component, anlamlı mod kullanımı.

### Paket
`react-native-modal-datetime-picker` (peer dep: `@react-native-community/datetimepicker`)

### Wrapper Component'ler

`src/components/TarihSec.js`:
```js
// Sınır/deadline alanları için (saat gereksiz)
<TarihSec
  value={tarih}              // Date | null
  onChange={setTarih}
  label="Son Tarih"
  minDate={...}              // opsiyonel
  maxDate={...}              // opsiyonel
/>
```

`src/components/TarihSaatSec.js`:
```js
// Randevu/hatırlatma alanları için (saat anlamlı)
<TarihSaatSec
  value={tarihSaat}
  onChange={setTarihSaat}
  label="Randevu Zamanı"
/>
```

İkisi de aynı görsel stile sahip (input görünümlü touchable + tıklayınca modal açılır), tema renklerini `useTheme` ile alır.

### Mod Eşlemesi

| Form alanı | Wrapper | Sebep |
|---|---|---|
| Görev son tarih | TarihSec | Deadline |
| Görev hatırlatma | TarihSaatSec | Belirli saatte hatırlatma |
| Servis planlanan ziyaret | TarihSaatSec | Randevu |
| Görüşme zamanı | TarihSaatSec | Randevu |
| Demo veriliş tarihi | TarihSec | Gün cinsinden |
| Demo beklenen iade tarihi | TarihSec | Gün cinsinden |
| Demo süre uzatma | TarihSec | Gün cinsinden |
| Teklif geçerlilik tarihi | TarihSec | Sınır |

**Kural:** "**Randevu/hatırlatma** ise `TarihSaatSec`, **deadline/sınır** ise `TarihSec`."

### Etkilenen Dosyalar
- `src/components/TarihSec.js` *(yeni)*
- `src/components/TarihSaatSec.js` *(yeni)*
- `package.json` — yeni paket
- Form ekranları: `YeniGorevScreen`, `GorevDetayScreen` (varsa edit), `YeniServisScreen`, `ServisTalebiDetayScreen` (planlanan ziyaret), `YeniGorusmeScreen`, `GorusmeDetayScreen`, `YeniDemoZimmetScreen`, `DemoSureyiUzatModal`, `YeniTeklifScreen`, `TeklifDetayScreen` (geçerlilik)

---

## Implementation Sırası (Önerilen)

1. **Tarih picker** — bağımsız, hızlı, hemen değer üretir (1-2 saat)
2. **Pull-to-refresh** — bağımsız, mekanik (1 saat)
3. **Servis formu PDF arşivi** — Storage setup + servis detay UI (yarım gün)
4. **Push notification** — DB + Edge Function + token akışı, en karmaşık (yarım-1 gün)

Her adım ayrı commit, ayrı EAS Update aday'ı.

---

## Test Stratejisi

- **Tarih picker:** her form ekranında bir yeni kayıt + bir düzenleme akışı manuel test
- **Pull-to-refresh:** her ekranı çek, yenilenme animasyonu doğru, veri güncel mi kontrol
- **Servis formu arşivi:** form üret → arşivde görün → indir/paylaş çalışıyor → ikinci üretim ikinci versiyon olarak listede
- **Push notification:** gerçek cihazda — uygulama kapalı, arka plan, foreground 3 senaryo + token rotasyonu (logout/login)

---

## Out of Scope

- TR/EN i18n
- Push tıklama deep link (gelecekte istenirse eklenebilir)
- Eski formlar için arşive geriye dönük migrasyon
- Bildirim tipi tercihi UI'sı (kullanıcı hangi bildirimleri push istediğini seçemez — hepsi gelir)
- Custom takvim grid'i
- Offline draft/queue
