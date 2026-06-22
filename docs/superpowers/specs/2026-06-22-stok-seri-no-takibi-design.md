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
2. **Adet kaynağı = Senaryo A:** Adedi depocu girer (`stok_urunler.stok_miktari`).
   Seriler bu adede doğru tamamlanır. **Eksik = stok_miktari − kayıtlı seri sayısı.**
3. **Excel: hem mobil (tek ürün) hem web (çok ürünlü master).**
4. Adet ürüne göre değişken (sabit değil). S/N takibi yalnız işaretli ürünlerde.
5. **Çıkışta seri seçimi bu fazda YOK → 2. faz.** Bu faz: seri kaydı + eksik takibi.
6. **Adetten fazla seri → engelleme yok, uyarı ver** ("X adet ama Y seri").

## Veri modeli (backend — crm-app)

Migration `053_stok_seri_takibi.sql`:

```sql
-- Ürün seri-takipli mi? (kamera/sunucu vb. = true)
alter table stok_urunler add column if not exists seri_takipli boolean default false;

-- Aynı seri iki kez girilmesin (boşlar hariç). Mevcut veride çakışma olursa
-- önce raporla; gerekirse partial unique index.
create unique index if not exists stok_kalemleri_seri_no_uq
  on stok_kalemleri (seri_no) where seri_no is not null and seri_no <> '';

notify pgrst, 'reload schema';
```

Notlar:
- `seri_takipli` ürün düzeyinde bayrak. Dinamik "kalem var mı" çıkarımı,
  *henüz serisi girilmemiş ama seri-takipli* ürünü ("50 girildi, 0 seri, 50 eksik")
  ifade edemediği için bayrak şart.
- Tekillik index'i uygulamadan önce mevcut çift seriler kontrol edilecek; çakışma
  varsa kullanıcıya raporlanıp temizlenecek (migration index'i koşullu).
- `stok_kalemleri` RLS (migration 002) — personel insert iznini doğrula; gerekirse
  policy eklenecek.

## Sınıflandırma uyumu

`seri_takipli=true` ürünler, `stok_kalemleri`'nde henüz kaydı olmasa bile
seri-farkındalı detay ekranına yönlenmeli (eksik takibi için).
`stokKalemiService.js` listeleme mantığı, `seri_takipli` bayrağını da hesaba
katacak (kalem yoksa bile seri-takipliyse `tip='seri'` + `kayitliSeri=0`).

## Mobil (crm-mobile)

### Ürün detayında "Seri Numaraları (X/Y)" bölümü
- Y = `stok_miktari` (depocu girdiği adet), X = kayıtlı seri sayısı.
- Eksik (Y−X) > 0 ise turuncu rozet; X>Y ise uyarı satırı.
- Kayıtlı serilerin listesi (seri_no, varsa barkod, durum).

### "Seri Ekle" → alt menü
- **📷 Tara:** kamerayla arka arkaya okutma. Her okutma:
  - boş/çok kısa → uyar,
  - sistemde zaten varsa → "zaten kayıtlı" uyarısı, eklenmez,
  - geçerliyse `stok_kalemleri`'ne ekle (stok_kodu, seri_no, marka/model ürün-
    den, durum='depoda'), listeye anında yansıt.
  - Sayaç: "12/50 eklendi".
- **📄 Excel'den Yükle:** `expo-document-picker` ile .xlsx seç →
  `expo-file-system` ile oku → `xlsx` (SheetJS) ile parse →
  ilk sütun = seri_no (opsiyonel 2. sütun = barkod) → önizleme (kaç geçerli,
  kaç boş, kaç zaten kayıtlı) → onayla → toplu insert. Sonuç raporu:
  "40 eklendi, 3 zaten kayıtlı, 2 boş atlandı".

### Yeni servis (`stokKalemiService`)
- `serileriTopluEkle(stokKodu, seriler[], { marka, model })` → batch insert,
  dedupe (DB unique + uygulama-içi), sonuç özeti döner.
- `urunSeriDurumu(stokKodu)` → { adet, kayitliSeri, eksik }.

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
- Adetten fazla seri → uyar ("X adet, Y seri — adedi güncelle?"), izin ver.
- Master import'ta bilinmeyen stok_kodu → o satır atlanır + raporlanır.

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
