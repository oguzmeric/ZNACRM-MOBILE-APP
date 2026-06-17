# Kullanıcı Self-Kayıt + Admin Onay/Yetkilendirme — Tasarım

**Tarih:** 2026-06-17
**Repolar:**
- Mobil: `C:\Users\MSI-LAPTOP\crm-mobile` (Expo / React Native)
- Web: `C:\Users\MSI-LAPTOP\crm-app` (React/Vite + Supabase) — worktree: `.claude\worktrees\adoring-hermann-edb720`
- Supabase project ref: `hcrbwxeuscfibgmchdtt`

## Amaç

Kullanıcılar e-posta + OTP ile kendileri kayıt olabilsin. Kayıt olan kişi **admin onaylayana kadar sisteme giriş yapamaz**. Admin (web + mobil) "Onay Bekleyenler"i görür, her birine **erişim seviyesi** (Müşteri / Personel / Yönetici) ve ilgili yetkileri atayıp onaylar veya reddeder.

## Mevcut durum (özet)

- **Self-kayıt:** Web `src/pages/Signup.jsx` → edge functions `kayit-kod-gonder` / `kayit-kod-dogrula`. Verify fonksiyonu `auth.users` + `kullanicilar` satırı oluşturur; şu an `tip='musteri'`, `durum='cevrimdisi'`, `email_dogrulandi=true`.
- **Kullanıcı tablosu `kullanicilar`:** `tip` (`zna`|`musteri`), `rol` (`admin`|`personel`|`musteri`, default `personel`), `email`, `email_dogrulandi`, `moduller text[]`, `izinli_turler text[]`, `musteri_id`, `durum` (online durumu — onay durumu DEĞİL).
- **Admin paneli (web):** `src/pages/KullaniciYonetimi.jsx` — kullanıcıları listeler/düzenler. **Onay bekleyen bölümü YOK.**
- **Mobil:** Self-kayıt yok; sadece admin elle kullanıcı ekliyor (`src/screens/admin/AdminYeniPersonelScreen.js`). Login: `src/services/kullaniciService.js` → `kullaniciGirisKontrol`.
- **Roller/RLS:** `is_admin()`, `is_staff()`, `current_user_role()` helper'ları (`002_rls_policies.sql`). Login sentetik e-posta + `supabase.auth.signInWithPassword`, sonra `kullanicilar` satırı çekilir.

## Karar: Yaklaşım A — Tek tablo + onay durumu

Ayrı başvuru tablosu (B) yerine `kullanicilar`'a bir durum kolonu eklenir. En az kod, mevcut OTP/login altyapısına en temiz oturan, en düşük hata yüzeyli çözüm. Onaylanınca kişi olduğu yerde aktifleşir; veri taşıma yok.

---

## 1. Veri modeli

`kullanicilar` tablosuna eklenecek kolonlar (yeni migration):

```sql
alter table kullanicilar
  add column if not exists onay_durum   text default 'onaylandi',  -- 'beklemede' | 'onaylandi' | 'reddedildi'
  add column if not exists onay_tarihi  timestamptz,
  add column if not exists onaylayan_id bigint references kullanicilar(id) on delete set null,
  add column if not exists red_nedeni   text;

-- güvence: mevcut satırların hepsi onaylı (kimse kilitlenmesin)
update kullanicilar set onay_durum = 'onaylandi' where onay_durum is null;

-- opsiyonel CHECK
alter table kullanicilar
  add constraint kullanicilar_onay_durum_chk
  check (onay_durum in ('beklemede','onaylandi','reddedildi'));
```

**Kritik:** Default `'onaylandi'` → mevcut kullanıcılar ve admin'in elle eklediği kişiler otomatik onaylı. Sadece self-kayıt açıkça `'beklemede'` yazar.

## 2. Kayıt akışı + login gate

### Kayıt (self-signup)
- **Edge function `kayit-kod-dogrula`:** yeni `kullanicilar` satırı oluştururken `onay_durum = 'beklemede'`. Tip/rol kayıt anında nötr başlar (varsayılan değerlerde kalır), kesin tip/rol/yetki **onayda** admin tarafından belirlenir.
- **Tekrar kayıt:** aynı e-posta zaten `beklemede` ise yeni satır açma; "Başvurunuz zaten alındı, onay bekliyor" döndür. (Mevcut "kullanıcı zaten var" kontrolünün yanına onay_durum dalı eklenir.)
- **Mobil self-kayıt:** Login ekranına "Kayıt ol" bağlantısı + yeni `KayitScreen` (web `Signup.jsx`'in mobil karşılığı). Aynı `kayit-kod-gonder` / `kayit-kod-dogrula` edge function'larını `supabase.functions.invoke` ile çağırır. Web `Signup.jsx` aynen kalır.

### Login gate (web + mobil — tek nokta)
Login akışında `kullanicilar` satırı çekildikten hemen sonra:

```
onay_durum === 'beklemede'   → supabase.auth.signOut() + hata:
    "Hesabınız onay bekliyor. Yönetici onayından sonra giriş yapabilirsiniz."
onay_durum === 'reddedildi'  → signOut() + hata:
    "Başvurunuz reddedildi." (+ varsa red_nedeni)
onay_durum === 'onaylandi'   → normal giriş
```

- Web: `kullaniciService.js → kullaniciGirisKontrol` (sentetik e-posta yolu + e-posta giriş yolu ikisi de).
- Mobil: `src/services/kullaniciService.js → kullaniciGirisKontrol`.
- Self-kayıt OTP'den sonra web'in otomatik `girisYap` adımı da bu gate'e takılır → kullanıcı "onay bekliyor" mesajını görür (doğru davranış).

## 3. Admin onay/yetkilendirme paneli (web + mobil)

### Erişim seviyesi (tek seçim — tip+rol türetilir)
Admin onaylarken tek bir "erişim seviyesi" seçer; sistem `tip`/`rol`'ü türetir (çelişkili kombinasyon imkânsız):

| Admin seçer | `tip` | `rol` | Ek alan |
|---|---|---|---|
| **Müşteri** | `musteri` | `musteri` | firma (`musteri_id`) |
| **Personel** | `zna` | `personel` | `moduller` + `izinli_turler` |
| **Yönetici** | `zna` | `admin` | — |

### Backend — RPC'ler (SECURITY DEFINER, `kullaniciSifreSifirla` kalıbıyla)

```
onay_bekleyen_kullanicilar()
    -- is_admin() kontrollü; onay_durum='beklemede' satırlarını döner
    -- (id, ad, email, created_at, ...)

kullanici_onayla(p_id, p_tip, p_rol, p_moduller, p_musteri_id, p_izinli_turler)
    -- is_admin() kontrollü
    -- onay_durum='onaylandi', onay_tarihi=now(), onaylayan_id=<admin id>
    -- + p_tip / p_rol / p_moduller / p_musteri_id / p_izinli_turler yazılır
    -- tek atomik işlem

kullanici_reddet(p_id, p_neden)
    -- is_admin() kontrollü
    -- onay_durum='reddedildi', red_nedeni=p_neden
```

RPC sebebi: durum + yetkiler tek atomik işlemde yazılsın, RLS'e takılmasın, login gate ile tutarlı kalsın.

### Web — `KullaniciYonetimi.jsx`
- Sayfa üstünde **"Onay Bekleyenler"** bölümü/sekmesi; bekleyen varsa sayaç rozeti ("Onay Bekleyenler (3)").
- Her satır: e-posta + kayıt tarihi; **Erişim seviyesi** seçimi (Müşteri/Personel/Yönetici); seçime göre ek alan (firma **veya** modüller+servis türleri); **Onayla** / **Reddet** (reddette neden sorulur).
- Servis katmanı: `kullaniciService.js`'e `onayBekleyenleriGetir()`, `kullaniciOnayla(...)`, `kullaniciReddet(...)` eklenir (RPC sarmalayıcıları).

### Mobil — yeni admin ekranı "Onay Bekleyenler"
- Admin menüsüne giriş + bekleyen sayısı rozeti.
- Aynı alanlar (erişim seviyesi → firma veya modüller), mobil-uygun kart/seçim arayüzü.
- Aynı RPC'leri `kullaniciService.js` üzerinden çağırır.

## 4. Bildirimler + uç durumlar

### Bildirimler
- **Admin'e push (opsiyonel, önerilen):** yeni kayıt gelince admin'lere `push-gonder` ile "Yeni kayıt onay bekliyor: {email}".
- **Kullanıcıya onay maili (opsiyonel):** onay anında Resend ile "Hesabınız onaylandı".
- Reddedilince ayrı bildirim yok; kişi giriş denediğinde mesajı görür.

### Uç durumlar
- **Mevcut kullanıcılar:** migration default `'onaylandi'` → kilitlenmez.
- **Admin'in elle eklediği kullanıcı** (`kullaniciEkle`): açıkça `onay_durum='onaylandi'` yazılır.
- **Tekrar kayıt (beklemede):** yeni satır yok, "zaten alındı" mesajı.
- **Reddedilen tekrar kayıt:** `reddedildi` kalır; admin gerekirse `beklemede`'ye çekip yeniden değerlendirir. Kayıt silinmez (iz kalır).
- **RLS:** bekleyen kullanıcı kendi satırını görse de login gate'e takılır; veri sızıntısı yok.

## Etkilenen dosyalar (özet)

**Web (`crm-app`):**
- `supabase_migrations/0XX_kullanici_onay_durum.sql` (yeni: kolonlar + 3 RPC)
- `supabase/functions/kayit-kod-dogrula/index.ts` (`onay_durum='beklemede'` + tekrar-kayıt dalı)
- `src/services/kullaniciService.js` (login gate + onay servis fonksiyonları)
- `src/pages/KullaniciYonetimi.jsx` ("Onay Bekleyenler" bölümü)

**Mobil (`crm-mobile`):**
- `src/services/kullaniciService.js` (login gate + onay servis fonksiyonları)
- `src/screens/KayitScreen.js` (yeni self-kayıt ekranı) + `LoginScreen.js`'e "Kayıt ol" bağlantısı
- `src/screens/admin/AdminOnayBekleyenlerScreen.js` (yeni) + admin menüsüne giriş
- `src/services/kullaniciService.js → kullaniciEkle` (varsa elle ekleme yolunda `onay_durum='onaylandi'`)

## Kapsam dışı (YAGNI)
- Ayrı başvuru tablosu (Yaklaşım B).
- Reddedilen kullanıcıya otomatik e-posta/SMS bildirimi.
- Self-servis rol değiştirme; tüm yetki değişimi admin üzerinden.
