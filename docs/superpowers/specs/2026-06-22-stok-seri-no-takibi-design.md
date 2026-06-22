# Stok Seri Numarası (S/N) Takibi — Tasarım

Tarih: 2026-06-22
Durum: Onaylandı (kullanıcı brainstorming'de onayladı)

## Amaç

Seri-takipli ürünlerde (kamera, sunucu, DVR, NVR vb.) stok girişinden sonra
her fiziksel cihazın seri numarasının sisteme girilebilmesi. İki giriş yöntemi:
mobilde **kamerayla tarama** ve **Excel** ile toplu yükleme; web'de **çok ürünlü
master import**. Seri-takipli ürünlerde "kaç adet girildi / kaç seri kayıtlı /
kaç eksik" takibi yapılır.

## Bağlam (mevcut sistem)

- **Bulk ürünler** (`tip: 'bulk'`): `stok_urunler` tablosu, `stok_miktari` ile
  sadece adet tutulur (kablo, vida vb.). Ekran: `BulkDetayScreen.js`.
- **Seri-numaralı cihazlar** (`tip: 'seri'`): `stok_kalemleri` tablosu, her birim
  ayrı satır (`seri_no`, `barkod`, `durum`, müşteri/lokasyon vb.).
  Ekranlar: `CihazDetayScreen.js`, `ModelDetayScreen.js`. Audit:
  `stok_kalemi_hareketleri`.
- **Sınıflandırma (mevcut):** bir `stok_kodu`'nun `stok_kalemleri`'nde kaydı
  varsa `'seri'`, yoksa `'bulk'` sayılıyor (`stokKalemiService.js`).
- Kamera tarama altyapısı mevcut (`TaraScreen.js`, `expo-camera`); `kalemAra(kod)`
  seri_no/barkod ile arar.
- `expo-document-picker` ve `expo-camera` paketleri kurulu (mevcut APK build 5'te
  var). `xlsx` (SheetJS) kurulu değil — saf JS olduğu için OTA ile eklenebilir.

## Kararlar (brainstorming sonucu)

1. **Tam seri-takipli:** eklenen her seri `stok_kalemleri`'nde ayrı birim
   (`durum='depoda'`).
2. **Adet kaynağı = Senaryo A, mevcut trigger'a uyumlu hale getirilmiş:**
   Depocunun girdiği hedef adet `stok_urunler.beklenen_adet`'te tutulur.
   Gerçek `stok_miktari` trigger ile depodaki seri sayısına eşittir (DOKUNULMAZ).
   **Eksik = beklenen_adet − kayıtlı seri sayısı (toplam kalem).**
3. **Excel: hem mobil (tek ürün) hem web (çok ürünlü master).**
4. Adet ürüne göre değişken (sabit değil). S/N takibi yalnız işaretli ürünlerde.
5. **Çıkışta seri seçimi bu fazda YOK → 2. faz.** Bu faz: seri kaydı + eksik takibi.
6. **Beklenenden fazla seri → engelleme yok, uyarı ver** ("X bekleniyor ama Y seri").

## ⚠️ Mevcut trigger gerçeği (tasarımı belirleyen kısıt)

`stok_kalemleri` üzerinde iki trigger var:
- `stok_kalemleri_after_change` → her insert/update/delete'te
  `refresh_stok_miktari(stok_kodu)` çağırır. Bu fonksiyon: ürünün
  `stok_kalemleri`'nde **en az 1 kaydı varsa**,
  `stok_urunler.stok_miktari = count(*) where durum='depoda'` yapar.
  Kalem yoksa dokunmaz (bulk davranışı korunur).
- `kalem_to_stok_hareket` → her durum değişiminde / insert'te `stok_hareketleri`'ne
  S/N'li bir hareket satırı yazar (insert'te "Ana Depo Girişi (yeni kayıt)").

**Sonuç:** Seri-takipli üründe `stok_miktari` türetilmiş bir değerdir (depodaki
seri sayısı). Depocunun "50 bekliyorum" hedefi bu yüzden AYRI bir alanda
(`beklenen_adet`) tutulur; `stok_miktari`'ye dokunulmaz.

## Veri modeli (backend — crm-app)

Migration `053_stok_seri_takibi.sql`:

```sql
-- Ürün seri-takipli mi? (kamera/sunucu vb. = true)
alter table stok_urunler add column if not exists seri_takipli boolean default false;

-- Depocunun girdiği hedef adet (Senaryo A). stok_miktari trigger-türevli olduğu
-- için hedef ayrı tutulur. Eksik = beklenen_adet − kayıtlı seri sayısı.
alter table stok_urunler add column if not exists beklenen_adet integer;

-- Aynı seri iki kez girilmesin (boşlar hariç). Mevcut veride çakışma olursa
-- index oluşturulamaz; migration önce çakışma kontrolü raporlar.
create unique index if not exists stok_kalemleri_seri_no_uq
  on stok_kalemleri (seri_no) where seri_no is not null and seri_no <> '';

notify pgrst, 'reload schema';
```

Notlar:
- `seri_takipli` ürün düzeyinde bayrak. Dinamik "kalem var mı" çıkarımı,
  *henüz serisi girilmemiş ama seri-takipli* ürünü ("50 bekleniyor, 0 seri")
  ifade edemediği için bayrak şart.
- `beklenen_adet`: ürün seri-takipli işaretlenirken, o anki `stok_miktari` değeri
  buraya kopyalanır (mevcut 50 → beklenen_adet=50 korunur). Sonra depocu
  düzenleyebilir. `stok_miktari` trigger'a bırakılır.
- Tekillik index'i uygulamadan önce mevcut çift seriler kontrol edilecek (Task 1
  doğrulama adımı). Çakışma varsa raporlanıp temizlenecek.
- `stok_kalemleri` RLS (migration 002) — personel insert iznini doğrula; gerekirse
  policy eklenecek.

## Sınıflandırma uyumu

`seri_takipli=true` ürünler, `stok_kalemleri`'nde henüz kaydı olmasa bile
seri-farkındalı detay ekranına yönlenmeli (eksik takibi için).
`stokKalemiService.js` listeleme/özet mantığı (`modellerOzetiniGetir`,
`tumKalemleriGetir`), `seri_takipli` bayrağını da hesaba katacak: kalem yoksa
bile `seri_takipli=true` ise `tip='seri'` + `kayitliSeri=0` + `beklenenAdet`.

Seri-takipli üründe bulk **+Giriş / −Çıkış** butonları (doğrudan `stok_miktari`
yazan `bulkHareketEkle`) **gizlenir** — adet artık serilerden türüyor. Onların
yerine "Seri Ekle" akışı gelir.

## Mobil (crm-mobile)

### Ürün detayında "Seri Numaraları (X/Y)" bölümü
- Y = `beklenen_adet` (depocu hedefi), X = kayıtlı seri sayısı (toplam kalem).
- Eksik (Y−X) > 0 ise turuncu rozet; X>Y ise uyarı satırı ("beklenenden fazla").
- `beklenen_adet` boşsa sadece X gösterilir (hedefsiz); depocu hedef girebilir.
- Kayıtlı serilerin listesi (seri_no, varsa barkod, durum).
- Gerçek depo adedi (`stok_miktari` = depoda olan seri sayısı) ayrı küçük satırda
  bilgi olarak gösterilebilir.

### "Seri Ekle" → alt menü
- **📷 Tara:** kamerayla arka arkaya okutma. Her okutma:
  - boş/çok kısa → uyar,
  - sistemde zaten varsa → "zaten kayıtlı" uyarısı, eklenmez,
  - geçerliyse `stok_kalemleri`'ne ekle (stok_kodu, seri_no, marka/model ürün-
    den, durum='depoda'), listeye anında yansıt.
  - Sayaç: "12 eklendi (kalan: 38)".
- **📄 Excel'den Yükle:** `expo-document-picker` ile .xlsx seç →
  `expo-file-system` ile oku → `xlsx` (SheetJS) ile parse →
  ilk sütun = seri_no (opsiyonel 2. sütun = barkod) → önizleme (kaç geçerli,
  kaç boş, kaç zaten kayıtlı) → onayla → toplu insert. Sonuç raporu:
  "40 eklendi, 3 zaten kayıtlı, 2 boş atlandı".

### Yeni servis fonksiyonları (`stokKalemiService`)
- `serileriTopluEkle(stokKodu, seriler[], { marka, model })` → batch insert,
  dedupe (DB unique + uygulama-içi + DB'de var olanları ayıkla), sonuç özeti:
  `{ eklenen, zatenVar, bos }`.
- `urunSeriDurumu(stokKodu)` → `{ beklenenAdet, kayitliSeri, eksik, depoda }`.
- `beklenenAdetGuncelle(stokKodu, adet)` → `stok_urunler.beklenen_adet` set eder.

## Web (crm-app)

- **Ürünü "seri-takipli" işaretle** (stok ürün düzenleme: `seri_takipli` toggle).
- **Ürün bazında "Excel'den Seri Yükle"** (tek sütun seri_no) — mobildekiyle aynı
  mantık, tarayıcıda SheetJS.
- **Toplu master import:** `stok_kodu | seri_no` (+ ops. `barkod, marka, model`)
  sütunlu tek Excel → birden çok ürünün serileri tek seferde. Bilinmeyen
  stok_kodu / çakışan seri / boş satır raporlanır. Asıl toplu giriş kanalı budur.

## Excel formatları

- **Tek ürün (mobil + web):** A sütunu seri_no (başlık opsiyonel; "seri",
  "seri_no", "serial" başlıkları tanınır ve atlanır), her satır bir seri.
  Opsiyonel B sütunu barkod.
- **Web master:** başlıklı; zorunlu `stok_kodu`, `seri_no`; opsiyonel `barkod`,
  `marka`, `model`. Başlık eşleştirme büyük/küçük harf ve TR-normalize duyarsız.

## Kurallar / uç durumlar

- Zaten kayıtlı seri → atla + raporla.
- Boş/whitespace satır → atla.
- Seri_no trim + normalize (baş/son boşluk, görünmez karakter temizliği).
- Beklenenden fazla seri → uyar ("X bekleniyor, Y seri — beklenen adedi
  güncelle?"), izin ver.
- Master import'ta bilinmeyen stok_kodu → o satır atlanır + raporlanır.
- Seri-takipli işaretlenirken mevcut `stok_miktari` → `beklenen_adet`'e kopyalanır.

## Dağıtım

- Mobil: tümü **OTA** (xlsx saf JS; kamera + document-picker mevcut build'de) →
  yeni APK gerekmez.
- Backend: tek migration (Management API ile `db query --linked`).
- Web: Vercel prod deploy.

## Kapsam dışı (sonraki fazlar)

- Faz 2: çıkış/sevkiyatta hangi serinin çıktığının seçimi; seri ↔ müşteri/saha
  lifecycle entegrasyonunun stok çıkış akışına bağlanması.
- Barkod/QR etiket basımı.
- Seri geçmişi zenginleştirme (giriş hareketine bağlama).
