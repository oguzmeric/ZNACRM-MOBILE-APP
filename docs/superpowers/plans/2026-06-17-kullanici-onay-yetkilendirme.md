# Kullanıcı Self-Kayıt + Admin Onay/Yetkilendirme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kullanıcılar e-posta+OTP ile self-kayıt olsun; admin onaylayana kadar giriş yapamasın; admin (web+mobil) "Onay Bekleyenler"i görüp erişim seviyesi (Müşteri/Personel/Yönetici) atayarak onaylasın veya reddetsin.

**Architecture:** `kullanicilar` tablosuna `onay_durum` durum kolonu eklenir (default `'onaylandi'` → mevcutlar etkilenmez). Self-kayıt `'beklemede'` yazar. Login akışı (web+mobil) tek noktada onay kontrolü yapar. Admin işlemleri 3 SECURITY DEFINER RPC ile atomik yürür. UI hem web (KullaniciYonetimi.jsx) hem mobil (yeni admin ekranı) tarafına eklenir; mobile self-kayıt ekranı eklenir.

**Tech Stack:** Supabase Postgres (RPC, RLS), Deno edge functions, React/Vite (web), Expo/React Native (mobil). Test runner YOK → doğrulama: SQL sorguları, `npm run build`/`eslint`, ve runtime smoke (expo / vercel preview).

**Repo konumları:**
- Web (worktree): `C:\Users\MSI-LAPTOP\crm-app\.claude\worktrees\adoring-hermann-edb720`
- Mobil: `C:\Users\MSI-LAPTOP\crm-mobile`
- Supabase project ref: `hcrbwxeuscfibgmchdtt`
- Migrasyonlar **elle** uygulanır (Supabase SQL Editor veya `npx supabase db ...`). Edge fn deploy: `npx supabase functions deploy <slug> --project-ref hcrbwxeuscfibgmchdtt`. Web deploy: `npx vercel --prod --yes`. Mobil: `eas update --branch production`.

**Erişim seviyesi → tip/rol türetme tablosu (tüm UI ve RPC bunu kullanır):**

| Erişim seviyesi | `tip` | `rol` | Ek alan |
|---|---|---|---|
| `musteri` (Müşteri) | `musteri` | `musteri` | `musteri_id` |
| `personel` (Personel) | `zna` | `personel` | `moduller[]`, `izinli_turler[]` |
| `yonetici` (Yönetici) | `zna` | `admin` | — |

---

## Task 1: DB migration — onay kolonları + 3 RPC

**Files:**
- Create: `crm-app/.claude/worktrees/adoring-hermann-edb720/supabase_migrations/049_kullanici_onay_yetki.sql`

- [ ] **Step 1: Migration dosyasını yaz**

Tam içerik:

```sql
-- Migration 049: Kullanıcı self-kayıt onay/yetkilendirme akışı
-- - kullanicilar'a onay durumu kolonları
-- - admin onay kuyruğu + onayla/reddet RPC'leri (SECURITY DEFINER)
-- Admin tanımı: rol='admin' (is_admin) VEYA yönetici unvanı (admin_sifre_sifirla ile aynı liste)

-- 1) Kolonlar
alter table kullanicilar
  add column if not exists onay_durum   text default 'onaylandi',
  add column if not exists onay_tarihi  timestamptz,
  add column if not exists onaylayan_id bigint references kullanicilar(id) on delete set null,
  add column if not exists red_nedeni   text;

-- Mevcut tüm satırlar onaylı (kimse kilitlenmesin)
update kullanicilar set onay_durum = 'onaylandi' where onay_durum is null;

-- Değer kısıtı (varsa önce düşür, idempotent)
alter table kullanicilar drop constraint if exists kullanicilar_onay_durum_chk;
alter table kullanicilar
  add constraint kullanicilar_onay_durum_chk
  check (onay_durum in ('beklemede','onaylandi','reddedildi'));

-- 2) Admin kontrol helper'ı (rol='admin' VEYA yönetici unvanı)
create or replace function yonetici_mi()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select rol = 'admin'
       or lower(coalesce(unvan,'')) in ('genel müdür','teknik müdür','yazılım geliştirmeci')
     from kullanicilar where auth_id = auth.uid()),
    false
  );
$$;

-- 3) Onay bekleyenleri getir
create or replace function onay_bekleyen_kullanicilar()
returns setof kullanicilar
language plpgsql stable security definer set search_path = public as $$
begin
  if not yonetici_mi() then
    raise exception 'Yetkisiz: yalnızca yöneticiler onay kuyruğunu görebilir.';
  end if;
  return query
    select * from kullanicilar
    where onay_durum = 'beklemede'
    order by created_at asc nulls last, id asc;
end;
$$;

-- 4) Kullanıcıyı onayla — erişim seviyesine göre tip/rol + yetkiler yazar
create or replace function kullanici_onayla(
  p_id            bigint,
  p_tip           text,
  p_rol           text,
  p_moduller      text[]  default '{}',
  p_musteri_id    bigint  default null,
  p_izinli_turler text[]  default '{}'
)
returns kullanicilar
language plpgsql security definer set search_path = public as $$
declare
  admin_id bigint;
  sonuc kullanicilar;
begin
  if not yonetici_mi() then
    raise exception 'Yetkisiz: yalnızca yöneticiler onaylayabilir.';
  end if;
  if p_tip not in ('zna','musteri') then
    raise exception 'Geçersiz tip: %', p_tip;
  end if;
  if p_rol not in ('admin','personel','musteri') then
    raise exception 'Geçersiz rol: %', p_rol;
  end if;

  select id into admin_id from kullanicilar where auth_id = auth.uid();

  update kullanicilar set
    onay_durum   = 'onaylandi',
    onay_tarihi  = now(),
    onaylayan_id = admin_id,
    red_nedeni   = null,
    tip          = p_tip,
    rol          = p_rol,
    moduller     = coalesce(p_moduller, '{}'),
    izinli_turler= coalesce(p_izinli_turler, '{}'),
    musteri_id   = case when p_tip = 'musteri' then p_musteri_id else null end
  where id = p_id
  returning * into sonuc;

  if sonuc.id is null then
    raise exception 'Kullanıcı bulunamadı: %', p_id;
  end if;
  return sonuc;
end;
$$;

-- 5) Kullanıcıyı reddet
create or replace function kullanici_reddet(p_id bigint, p_neden text default null)
returns kullanicilar
language plpgsql security definer set search_path = public as $$
declare
  sonuc kullanicilar;
begin
  if not yonetici_mi() then
    raise exception 'Yetkisiz: yalnızca yöneticiler reddedebilir.';
  end if;
  update kullanicilar set
    onay_durum = 'reddedildi',
    red_nedeni = p_neden,
    onay_tarihi = now()
  where id = p_id
  returning * into sonuc;
  if sonuc.id is null then
    raise exception 'Kullanıcı bulunamadı: %', p_id;
  end if;
  return sonuc;
end;
$$;

grant execute on function yonetici_mi() to authenticated;
grant execute on function onay_bekleyen_kullanicilar() to authenticated;
grant execute on function kullanici_onayla(bigint, text, text, text[], bigint, text[]) to authenticated;
grant execute on function kullanici_reddet(bigint, text) to authenticated;

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Migration'ı uygula**

Supabase SQL Editor'a (proje `hcrbwxeuscfibgmchdtt`) yapıştırıp çalıştır. Beklenen: hata yok, "Success".

- [ ] **Step 3: Kolonların oluştuğunu doğrula**

SQL Editor'da çalıştır:
```sql
select column_name, column_default
from information_schema.columns
where table_name = 'kullanicilar' and column_name like 'onay%' or column_name = 'red_nedeni';
```
Beklenen: `onay_durum` (default `'onaylandi'::text`), `onay_tarihi`, `onaylayan_id`, `red_nedeni` satırları döner.

- [ ] **Step 4: Mevcut kullanıcıların kilitlenmediğini doğrula**
```sql
select count(*) filter (where onay_durum = 'onaylandi') as onayli,
       count(*) filter (where onay_durum <> 'onaylandi') as digerleri
from kullanicilar;
```
Beklenen: `digerleri = 0` (hepsi onaylı).

- [ ] **Step 5: Commit**
```bash
cd C:\Users\MSI-LAPTOP\crm-app\.claude\worktrees\adoring-hermann-edb720
git add supabase_migrations/049_kullanici_onay_yetki.sql
git commit -m "feat(onay): kullanicilar onay_durum kolonlari + onay/reddet RPC'leri"
```

---

## Task 2: Edge function — self-kayıt 'beklemede' + tekrar-kayıt mesajı

**Files:**
- Modify: `crm-app/.claude/worktrees/adoring-hermann-edb720/supabase/functions/kayit-kod-dogrula/index.ts`

- [ ] **Step 1: Mevcut kullanıcı sorgusuna onay_durum ekle**

`index.ts:103-107` bloğundaki select'i değiştir:
```ts
    const { data: mevcut } = await supa
      .from('kullanicilar')
      .select('id, ad, email, auth_id, email_dogrulandi, tip, onay_durum')
      .eq('email', email)
      .maybeSingle()
```

- [ ] **Step 2: Tekrar-kayıt dalı ekle (zaten beklemede ise)**

`index.ts:111` `if (amac === 'kayit') {` satırının HEMEN ALTINA, auth oluşturma bloğundan ÖNCE ekle:
```ts
      // Zaten kayıtlı ve onay bekliyorsa: tekrar kayıt açma, bilgilendir
      if (mevcut && mevcut.onay_durum === 'beklemede') {
        return new Response(
          JSON.stringify({
            ok: true,
            kullaniciId: mevcut.id,
            authId: authUserId,
            mesaj: 'Başvurunuz alınmış ve onay bekliyor. Yönetici onayından sonra giriş yapabilirsiniz.',
            onayBekliyor: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
```

- [ ] **Step 3: Yeni kullanıcı insert'ine onay_durum='beklemede' ekle**

`index.ts:140-149` insert objesini değiştir (`tip: 'musteri'` satırını koru — onay öncesi geçici, onayda admin set edecek):
```ts
          .insert({
            ad: adAday,
            kullanici_adi: adAday,
            email,
            email_dogrulandi: true,
            auth_id: authUserId,
            tip: 'musteri',
            durum: 'cevrimdisi',
            onay_durum: 'beklemede',
          })
```

- [ ] **Step 4: Başarı mesajını "onay bekliyor"a çevir**

`index.ts:163-171` response objesindeki `mesaj` alanını değiştir:
```ts
          mesaj: 'Kayıt tamamlandı. Hesabınız yönetici onayından sonra aktif olacak.',
          onayBekliyor: true,
```
(NOT: `amac==='kayit'` ve yeni kullanıcı durumunda. Mevcut onaylı kullanıcının `email_dogrulandi` güncellemesi yolu — `else if` dalı — aynı kalır, onay_durum'a dokunmaz.)

- [ ] **Step 5: Deploy**
```bash
cd C:\Users\MSI-LAPTOP\crm-app\.claude\worktrees\adoring-hermann-edb720
npx supabase functions deploy kayit-kod-dogrula --project-ref hcrbwxeuscfibgmchdtt
```
Beklenen: "Deployed Function kayit-kod-dogrula".

- [ ] **Step 6: Commit**
```bash
git add supabase/functions/kayit-kod-dogrula/index.ts
git commit -m "feat(onay): self-kayit onay_durum=beklemede + tekrar-kayit bilgisi"
```

---

## Task 3: Web login gate + onay servis fonksiyonları

**Files:**
- Modify: `crm-app/.claude/worktrees/adoring-hermann-edb720/src/services/kullaniciService.js`
- Modify: `crm-app/.claude/worktrees/adoring-hermann-edb720/src/pages/Login.jsx` (catch ile mesaj göster)

- [ ] **Step 1: `kullaniciGirisKontrol`'e onay gate ekle**

`kullaniciService.js:24-31` profil bloğunu değiştir — profil çekildikten sonra onay kontrolü (throw):
```js
  const { data: profil, error: profilError } = await supabase
    .from('kullanicilar')
    .select('*')
    .eq('auth_id', authData.user.id)
    .single()

  if (profilError) { console.warn('[kullaniciGirisKontrol] profil hatası:', profilError.message); return null }
  if (!profil) return null

  if (profil.onay_durum === 'beklemede') {
    await supabase.auth.signOut()
    const e = new Error('Hesabınız onay bekliyor. Yönetici onayından sonra giriş yapabilirsiniz.')
    e.kod = 'ONAY_BEKLIYOR'
    throw e
  }
  if (profil.onay_durum === 'reddedildi') {
    await supabase.auth.signOut()
    const e = new Error('Başvurunuz reddedildi.' + (profil.red_nedeni ? ' Sebep: ' + profil.red_nedeni : ''))
    e.kod = 'REDDEDILDI'
    throw e
  }
  return toCamel(profil)
```

- [ ] **Step 2: Onay servis fonksiyonlarını ekle**

`kullaniciService.js` sonuna ekle:
```js
// === Onay/yetkilendirme (admin) ===

export const onayBekleyenleriGetir = async () => {
  const { data, error } = await supabase.rpc('onay_bekleyen_kullanicilar')
  if (error) { console.error('onayBekleyenleriGetir hata:', error.message); throw error }
  return arrayToCamel(data ?? [])
}

// erisim: 'musteri' | 'personel' | 'yonetici'
export const kullaniciOnayla = async (id, erisim, ek = {}) => {
  const harita = {
    musteri:  { tip: 'musteri', rol: 'musteri' },
    personel: { tip: 'zna',     rol: 'personel' },
    yonetici: { tip: 'zna',     rol: 'admin' },
  }
  const m = harita[erisim]
  if (!m) throw new Error('Geçersiz erişim seviyesi: ' + erisim)
  const { data, error } = await supabase.rpc('kullanici_onayla', {
    p_id: id,
    p_tip: m.tip,
    p_rol: m.rol,
    p_moduller: ek.moduller ?? [],
    p_musteri_id: ek.musteriId ?? null,
    p_izinli_turler: ek.izinliTurler ?? [],
  })
  if (error) { console.error('kullaniciOnayla hata:', error.message); throw error }
  return toCamel(data)
}

export const kullaniciReddet = async (id, neden = null) => {
  const { data, error } = await supabase.rpc('kullanici_reddet', { p_id: id, p_neden: neden })
  if (error) { console.error('kullaniciReddet hata:', error.message); throw error }
  return toCamel(data)
}
```

- [ ] **Step 3: Login.jsx — fırlatılan onay hatasını yüzeyde göster**

`Login.jsx` içindeki giriş submit handler'ını bul (büyük olasılıkla `girisYap(...)` çağıran `async` fonksiyon). `girisYap` çağrısını try/catch'e al; catch'te `setHata(err.message)` (mevcut hata-gösterme state'inin adını kullan). Mevcut yapı `const ok = await girisYap(...)` ise şu şekle getir:
```js
    try {
      const ok = await girisYap(kullaniciAdi, sifre)
      if (!ok) setHata('Kullanıcı adı veya şifre hatalı.')
    } catch (err) {
      setHata(err?.message || 'Giriş yapılamadı.')
    }
```
(NOT: `girisYap` AuthContext'te `kullaniciGirisKontrol`'ü await ediyor ve onu try/catch'lemiyor → throw yukarı propagate olur. AuthContext.girisYap'a dokunma gerekmez.)

- [ ] **Step 4: Signup.jsx — otomatik giriş onay'a takılırsa düzgün mesaj**

`Signup.jsx:82-91` `kayitTamamla` içindeki otomatik giriş bloğunu değiştir. `girisYap` artık throw edebileceği için:
```js
      await kayitKodDogrula({ email, kod, yeniSifre: sifre, amac: 'kayit' })
      // Kayıt sonrası hesap onay bekliyor — otomatik giriş denenmez
      setBilgi('Kayıt alındı! Hesabınız yönetici onayından sonra aktif olacak. Onaylanınca giriş yapabilirsiniz.')
      setTimeout(() => navigate('/login', { replace: true }), 2500)
```
(Otomatik `girisYap` çağrısı kaldırıldı — onay bekleyen kullanıcı zaten giremez.)

- [ ] **Step 5: Build doğrula**
```bash
cd C:\Users\MSI-LAPTOP\crm-app\.claude\worktrees\adoring-hermann-edb720
npm run build
```
Beklenen: build başarılı, hata yok.

- [ ] **Step 6: Commit**
```bash
git add src/services/kullaniciService.js src/pages/Login.jsx src/pages/Signup.jsx
git commit -m "feat(onay): web login gate + onay servis fonksiyonlari + signup mesaji"
```

---

## Task 4: Web admin "Onay Bekleyenler" bölümü

**Files:**
- Modify: `crm-app/.claude/worktrees/adoring-hermann-edb720/src/pages/KullaniciYonetimi.jsx`

- [ ] **Step 1: KullaniciYonetimi.jsx yapısını oku**

Sayfanın admin guard'ını, mevcut kullanıcı listesini, `musteriler` verisini (firma seçimi için) ve modül listesini nasıl aldığını tespit et. Servis importlarına ekle:
```js
import { onayBekleyenleriGetir, kullaniciOnayla, kullaniciReddet } from '../services/kullaniciService'
```

- [ ] **Step 2: Bekleyenler state + yükleme**

Component içine ekle:
```js
const [bekleyenler, setBekleyenler] = useState([])
const [bekleyenYukleniyor, setBekleyenYukleniyor] = useState(false)

const bekleyenleriYukle = async () => {
  setBekleyenYukleniyor(true)
  try { setBekleyenler(await onayBekleyenleriGetir()) }
  catch (e) { console.warn('[onay] yükleme:', e.message) }
  finally { setBekleyenYukleniyor(false) }
}
useEffect(() => { bekleyenleriYukle() }, [])
```

- [ ] **Step 3: Onayla/Reddet aksiyonları**
```js
const onayla = async (id, erisim, ek) => {
  try {
    await kullaniciOnayla(id, erisim, ek)
    await bekleyenleriYukle()
    // ana kullanıcı listesini de tazele (varsa mevcut yükleme fonksiyonunu çağır)
  } catch (e) { alert('Onaylanamadı: ' + e.message) }
}
const reddet = async (id) => {
  const neden = window.prompt('Reddetme nedeni (opsiyonel):') ?? null
  try { await kullaniciReddet(id, neden); await bekleyenleriYukle() }
  catch (e) { alert('Reddedilemedi: ' + e.message) }
}
```

- [ ] **Step 4: "Onay Bekleyenler" bölümünü render et**

Mevcut kullanıcı listesinin ÜSTÜNE, sayfanın başına bir kart ekle. Her satır için yerel seçim (erişim seviyesi + ek alan) tutan küçük bir alt-bileşen:
```jsx
{bekleyenler.length > 0 && (
  <section className="onay-bekleyenler" style={{ marginBottom: 24 }}>
    <h2>Onay Bekleyenler ({bekleyenler.length})</h2>
    {bekleyenler.map((k) => (
      <OnaySatiri key={k.id} kullanici={k} musteriler={musteriler}
        moduller={MODUL_LISTESI} onOnayla={onayla} onReddet={reddet} />
    ))}
  </section>
)}
```

Alt-bileşen (aynı dosyanın sonuna, default export'tan önce):
```jsx
function OnaySatiri({ kullanici, musteriler, moduller, onOnayla, onReddet }) {
  const [erisim, setErisim] = useState('musteri')
  const [musteriId, setMusteriId] = useState('')
  const [seciliModuller, setSeciliModuller] = useState([])

  const ekAlan = () => {
    if (erisim === 'musteri') {
      return (
        <select value={musteriId} onChange={(e) => setMusteriId(e.target.value)}>
          <option value="">Firma seçin…</option>
          {(musteriler ?? []).map((m) => <option key={m.id} value={m.id}>{m.firmaAdi ?? m.ad}</option>)}
        </select>
      )
    }
    if (erisim === 'personel') {
      return (
        <div className="modul-secim">
          {(moduller ?? []).map((mod) => (
            <label key={mod.id}>
              <input type="checkbox" checked={seciliModuller.includes(mod.id)}
                onChange={(e) => setSeciliModuller((p) => e.target.checked ? [...p, mod.id] : p.filter((x) => x !== mod.id))} />
              {mod.ad ?? mod.id}
            </label>
          ))}
        </div>
      )
    }
    return null
  }

  const onayDisabled = erisim === 'musteri' && !musteriId

  return (
    <div className="onay-satiri" style={{ border: '1px solid var(--border-default)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
      <div><strong>{kullanici.email}</strong> · {kullanici.ad}</div>
      <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
        {[['musteri', 'Müşteri'], ['personel', 'Personel'], ['yonetici', 'Yönetici']].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setErisim(id)}
            style={{ fontWeight: erisim === id ? 700 : 400 }}>{label}</button>
        ))}
      </div>
      {ekAlan()}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" disabled={onayDisabled}
          onClick={() => onOnayla(kullanici.id, erisim, { musteriId: musteriId || null, moduller: seciliModuller })}>
          Onayla
        </button>
        <button type="button" onClick={() => onReddet(kullanici.id)}>Reddet</button>
      </div>
    </div>
  )
}
```
(NOT: `MODUL_LISTESI` ve `musteriler` — dosyada zaten mevcut olan modül sabitini / müşteri state'ini kullan. Yoksa Step 1'de tespit ettiğin kaynağı bağla. Stil mevcut CSS değişkenleriyle uyumlu.)

- [ ] **Step 5: Build doğrula**
```bash
cd C:\Users\MSI-LAPTOP\crm-app\.claude\worktrees\adoring-hermann-edb720
npm run build
```
Beklenen: build başarılı.

- [ ] **Step 6: Commit**
```bash
git add src/pages/KullaniciYonetimi.jsx
git commit -m "feat(onay): web admin Onay Bekleyenler bolumu"
```

---

## Task 5: Mobil login gate + onay servis fonksiyonları

**Files:**
- Modify: `crm-mobile/src/services/kullaniciService.js`
- Modify: `crm-mobile/src/screens/LoginScreen.js`
- Create: `crm-mobile/src/services/emailAuthService.js`

- [ ] **Step 1: Mobil `kullaniciGirisKontrol`'e onay gate ekle**

`kullaniciService.js:23-32` bloğunu değiştir:
```js
  if (pErr || !profil) {
    console.warn('[kullaniciGirisKontrol] profil bulunamadı:', pErr?.message)
    await supabase.auth.signOut()
    return null
  }
  if (profil.hesap_silindi) {
    await supabase.auth.signOut()
    return null
  }
  if (profil.onay_durum === 'beklemede') {
    await supabase.auth.signOut()
    const e = new Error('Hesabınız onay bekliyor. Yönetici onayından sonra giriş yapabilirsiniz.')
    e.kod = 'ONAY_BEKLIYOR'
    throw e
  }
  if (profil.onay_durum === 'reddedildi') {
    await supabase.auth.signOut()
    const e = new Error('Başvurunuz reddedildi.' + (profil.red_nedeni ? ' Sebep: ' + profil.red_nedeni : ''))
    e.kod = 'REDDEDILDI'
    throw e
  }
  return toCamel(profil)
```

- [ ] **Step 2: Onay servis fonksiyonlarını ekle**

`kullaniciService.js` sonuna (Task 3 Step 2 ile AYNI kod — mobilde de `arrayToCamel`/`toCamel` import zaten var):
```js
// === Onay/yetkilendirme (admin) ===

export const onayBekleyenleriGetir = async () => {
  const { data, error } = await supabase.rpc('onay_bekleyen_kullanicilar')
  if (error) { console.error('onayBekleyenleriGetir hata:', error.message); throw error }
  return arrayToCamel(data ?? [])
}

export const kullaniciOnayla = async (id, erisim, ek = {}) => {
  const harita = {
    musteri:  { tip: 'musteri', rol: 'musteri' },
    personel: { tip: 'zna',     rol: 'personel' },
    yonetici: { tip: 'zna',     rol: 'admin' },
  }
  const m = harita[erisim]
  if (!m) throw new Error('Geçersiz erişim seviyesi: ' + erisim)
  const { data, error } = await supabase.rpc('kullanici_onayla', {
    p_id: id, p_tip: m.tip, p_rol: m.rol,
    p_moduller: ek.moduller ?? [], p_musteri_id: ek.musteriId ?? null, p_izinli_turler: ek.izinliTurler ?? [],
  })
  if (error) { console.error('kullaniciOnayla hata:', error.message); throw error }
  return toCamel(data)
}

export const kullaniciReddet = async (id, neden = null) => {
  const { data, error } = await supabase.rpc('kullanici_reddet', { p_id: id, p_neden: neden })
  if (error) { console.error('kullaniciReddet hata:', error.message); throw error }
  return toCamel(data)
}
```

- [ ] **Step 3: Mobil emailAuthService.js oluştur**

`crm-mobile/src/services/emailAuthService.js` (web wrapper'ın mobil eşi):
```js
// Email tabanli auth — mobil. Edge function'lari cagiran helper'lar.
import { supabase } from '../lib/supabase'

async function ftnHataMesaj(error) {
  let mesaj = error?.message ?? 'İşlem başarısız.'
  try {
    const ctx = error?.context
    if (ctx && typeof ctx.text === 'function') {
      const text = await ctx.text()
      if (text) {
        try {
          const body = JSON.parse(text)
          if (body?.hata) {
            mesaj = body.hata
            if (body?.kalanDeneme != null) mesaj += ` (${body.kalanDeneme} deneme hakkınız kaldı)`
          }
        } catch { mesaj = text.slice(0, 300) }
      }
    }
  } catch {}
  return mesaj
}

export async function kayitKodGonder(email, amac = 'kayit') {
  const { data, error } = await supabase.functions.invoke('kayit-kod-gonder', {
    body: { email: email.trim().toLowerCase(), amac },
  })
  if (error) throw new Error(await ftnHataMesaj(error))
  if (!data?.ok) throw new Error(data?.hata ?? 'Kod gönderilemedi.')
  return data
}

export async function kayitKodDogrula({ email, kod, yeniSifre, amac = 'kayit' }) {
  const { data, error } = await supabase.functions.invoke('kayit-kod-dogrula', {
    body: { email: email.trim().toLowerCase(), kod: kod.trim(), yeniSifre, amac },
  })
  if (error) throw new Error(await ftnHataMesaj(error))
  if (!data?.ok) throw new Error(data?.hata ?? 'Doğrulama başarısız.')
  return data
}
```

- [ ] **Step 4: LoginScreen handleLogin — onay hatasını Alert ile göster**

`LoginScreen.js:23-32` `handleLogin`'i değiştir:
```js
  const handleLogin = async () => {
    if (!kullaniciAdi || !sifre) {
      Alert.alert('Eksik bilgi', 'Kullanıcı adı ve şifre gerekli.')
      return
    }
    setLoading(true)
    try {
      const ok = await girisYap(kullaniciAdi, sifre)
      if (!ok) Alert.alert('Giriş başarısız', 'Kullanıcı adı veya şifre hatalı.')
    } catch (err) {
      Alert.alert('Giriş yapılamadı', err?.message || 'Bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }
```
(NOT: mobil `AuthContext.girisYap` `kullaniciGirisKontrol`'ü await ediyor, try/catch'lemiyor → throw propagate olur. AuthContext'e dokunma gerekmez.)

- [ ] **Step 5: Lint/syntax doğrula**
```bash
cd C:\Users\MSI-LAPTOP\crm-mobile
npx expo export --platform ios --output-dir /tmp/expo-check 2>&1 | tail -5 || node -e "require('@babel/core')" 2>/dev/null; echo "manuel: expo start ile çalıştırıp giriş ekranını dene"
```
(Test runner yok; gerçek doğrulama Task 8 smoke'da. Burada en azından dosyaların import edildiğini `expo start` ile kontrol et.)

- [ ] **Step 6: Commit**
```bash
cd C:\Users\MSI-LAPTOP\crm-mobile
git add src/services/kullaniciService.js src/services/emailAuthService.js src/screens/LoginScreen.js
git commit -m "feat(onay): mobil login gate + onay servisleri + emailAuthService"
```

---

## Task 6: Mobil self-kayıt ekranı (KayitScreen) + navigasyon

**Files:**
- Create: `crm-mobile/src/screens/KayitScreen.js`
- Modify: `crm-mobile/src/navigation/RootNavigator.js`
- Modify: `crm-mobile/src/screens/LoginScreen.js` (Kayıt ol bağlantısı)

- [ ] **Step 1: KayitScreen.js oluştur** (2 adımlı: email → OTP+şifre)
```jsx
import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { kayitKodGonder, kayitKodDogrula } from '../services/emailAuthService'

export default function KayitScreen({ navigation }) {
  const { colors } = useTheme()
  const [adim, setAdim] = useState(1)
  const [email, setEmail] = useState('')
  const [kod, setKod] = useState('')
  const [sifre, setSifre] = useState('')
  const [sifre2, setSifre2] = useState('')
  const [loading, setLoading] = useState(false)
  const [geriSayim, setGeriSayim] = useState(0)

  useEffect(() => {
    if (geriSayim <= 0) return
    const t = setTimeout(() => setGeriSayim((g) => g - 1), 1000)
    return () => clearTimeout(t)
  }, [geriSayim])

  const kodGonder = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Hata', 'Geçerli bir e-posta adresi girin.'); return
    }
    setLoading(true)
    try {
      await kayitKodGonder(email, 'kayit')
      setAdim(2); setGeriSayim(60)
      Alert.alert('Kod gönderildi', `${email} adresine 6 haneli kod gönderildi. Spam klasörünü de kontrol edin.`)
    } catch (e) { Alert.alert('Hata', e?.message || 'Kod gönderilemedi.') }
    finally { setLoading(false) }
  }

  const kayitTamamla = async () => {
    if (!/^\d{6}$/.test(kod)) { Alert.alert('Hata', 'Kod 6 haneli olmalı.'); return }
    if (sifre.length < 8) { Alert.alert('Hata', 'Şifre en az 8 karakter olmalı.'); return }
    if (sifre !== sifre2) { Alert.alert('Hata', 'Şifreler eşleşmiyor.'); return }
    setLoading(true)
    try {
      await kayitKodDogrula({ email, kod, yeniSifre: sifre, amac: 'kayit' })
      Alert.alert(
        'Başvuru alındı',
        'Hesabınız yönetici onayından sonra aktif olacak. Onaylanınca giriş yapabilirsiniz.',
        [{ text: 'Tamam', onPress: () => navigation.goBack() }],
      )
    } catch (e) { Alert.alert('Hata', e?.message || 'Kayıt tamamlanamadı.') }
    finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.textPrimary }]}>Hesap Oluştur</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          {adim === 1 ? 'E-posta adresinizi girin, 6 haneli kod gönderelim.' : `${email} adresine gönderilen kodu ve yeni şifrenizi girin.`}
        </Text>

        {adim === 1 ? (
          <>
            <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.borderStrong }]}
              placeholder="adsoyad@firma.com" placeholderTextColor={colors.textFaded}
              autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
              value={email} onChangeText={setEmail} />
            <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={kodGonder} disabled={loading}>
              <Text style={styles.btnText}>{loading ? 'Gönderiliyor…' : 'Kod Gönder →'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.borderStrong, letterSpacing: 6, textAlign: 'center' }]}
              placeholder="000000" placeholderTextColor={colors.textFaded} keyboardType="number-pad" maxLength={6}
              value={kod} onChangeText={(t) => setKod(t.replace(/\D/g, '').slice(0, 6))} />
            <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.borderStrong }]}
              placeholder="Yeni şifre (en az 8 karakter)" placeholderTextColor={colors.textFaded} secureTextEntry
              value={sifre} onChangeText={setSifre} />
            <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.borderStrong }]}
              placeholder="Şifre tekrar" placeholderTextColor={colors.textFaded} secureTextEntry
              value={sifre2} onChangeText={setSifre2} />
            <TouchableOpacity disabled={geriSayim > 0 || loading} onPress={kodGonder}>
              <Text style={[styles.resend, { color: geriSayim > 0 ? colors.textFaded : colors.primary }]}>
                {geriSayim > 0 ? `Yeni kod (${geriSayim}sn)` : 'Yeni kod gönder'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={kayitTamamla} disabled={loading}>
              <Text style={styles.btnText}>{loading ? 'İşleniyor…' : 'Kayıt Ol →'}</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 18 }}>
          <Text style={[styles.link, { color: colors.textMuted }]}>Zaten hesabın var mı? Giriş yap</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  wrap: { padding: 24, justifyContent: 'center', flexGrow: 1 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 22 },
  input: { padding: 14, borderRadius: 10, fontSize: 15, borderWidth: 1, marginBottom: 12 },
  btn: { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resend: { fontSize: 12.5, fontWeight: '600', textAlign: 'right', marginBottom: 8 },
  link: { fontSize: 13, textAlign: 'center', fontWeight: '600' },
})
```

- [ ] **Step 2: RootNavigator — auth stack'ine KayitScreen ekle**

`RootNavigator.js:8` import bloğuna ekle:
```js
import KayitScreen from '../screens/KayitScreen'
```
`RootNavigator.js:136-137` auth dalını değiştir (tek ekran yerine iki ekran):
```jsx
        {!kullanici ? (
          <>
            <Stack.Screen name="Giriş" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Kayıt" component={KayitScreen} options={{ title: 'Hesap Oluştur' }} />
          </>
        ) : adminModu ? (
```

- [ ] **Step 3: LoginScreen — "Kayıt ol" bağlantısı**

`LoginScreen.js`'de `handleLogin`'i kullanan ekranda, giriş butonunun ALTINA (card içinde, button'dan sonra) ekle. Önce `useAuth` satırının yanına `navigation`'ı al — component imzasını `export default function LoginScreen({ navigation }) {` yap. Sonra butondan sonra:
```jsx
          <TouchableOpacity onPress={() => navigation.navigate('Kayıt')} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: 13, fontWeight: '600' }}>
              Hesabın yok mu? <Text style={{ color: '#60a5fa' }}>Kayıt ol</Text>
            </Text>
          </TouchableOpacity>
```

- [ ] **Step 4: Çalışma doğrula** — `expo start`, giriş ekranında "Kayıt ol" görünür, dokununca KayitScreen açılır. (Smoke Task 8'de tam akış.)

- [ ] **Step 5: Commit**
```bash
cd C:\Users\MSI-LAPTOP\crm-mobile
git add src/screens/KayitScreen.js src/navigation/RootNavigator.js src/screens/LoginScreen.js
git commit -m "feat(onay): mobil self-kayit ekrani + login baglantisi"
```

---

## Task 7: Mobil admin "Onay Bekleyenler" ekranı + menü

**Files:**
- Create: `crm-mobile/src/screens/admin/AdminKullaniciOnayScreen.js`
- Modify: `crm-mobile/src/navigation/RootNavigator.js` (admin stack'e ekle)
- Modify: admin menü/dashboard (AdminDashboardScreen veya admin menü dizisi — Step 3'te tespit)

- [ ] **Step 1: AdminKullaniciOnayScreen.js oluştur**

`musteriler` ve modül listesi mobilde nasıl çekiliyorsa onu kullan (örn. `musteriService` / `servisConstants`). İskelet:
```jsx
import { useCallback, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import ScreenContainer from '../../components/ScreenContainer'
import { useTheme } from '../../context/ThemeContext'
import { onayBekleyenleriGetir, kullaniciOnayla, kullaniciReddet } from '../../services/kullaniciService'
import { musterileriGetir } from '../../services/musteriService'

const ERISIMLER = [
  { id: 'musteri', label: 'Müşteri' },
  { id: 'personel', label: 'Personel' },
  { id: 'yonetici', label: 'Yönetici' },
]

export default function AdminKullaniciOnayScreen() {
  const { colors } = useTheme()
  const [liste, setListe] = useState([])
  const [musteriler, setMusteriler] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [secim, setSecim] = useState({}) // { [id]: { erisim, musteriId } }

  const yukle = useCallback(async () => {
    try {
      const [b, m] = await Promise.all([onayBekleyenleriGetir(), musterileriGetir().catch(() => [])])
      setListe(b); setMusteriler(m ?? [])
    } catch (e) { Alert.alert('Hata', e?.message || 'Yüklenemedi.') }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const erisimSec = (id, erisim) => setSecim((p) => ({ ...p, [id]: { ...(p[id] || {}), erisim } }))
  const firmaSec  = (id, musteriId) => setSecim((p) => ({ ...p, [id]: { ...(p[id] || {}), musteriId } }))

  const onayla = async (k) => {
    const s = secim[k.id] || { erisim: 'musteri' }
    if (s.erisim === 'musteri' && !s.musteriId) { Alert.alert('Eksik', 'Müşteri için firma seçin.'); return }
    try {
      await kullaniciOnayla(k.id, s.erisim || 'musteri', { musteriId: s.musteriId || null })
      await yukle()
    } catch (e) { Alert.alert('Onaylanamadı', e?.message || '') }
  }
  const reddet = (k) => {
    Alert.alert('Reddet', `${k.email} reddedilsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Reddet', style: 'destructive', onPress: async () => {
        try { await kullaniciReddet(k.id, null); await yukle() } catch (e) { Alert.alert('Hata', e?.message || '') }
      } },
    ])
  }

  const renderItem = ({ item: k }) => {
    const s = secim[k.id] || { erisim: 'musteri' }
    return (
      <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.email, { color: colors.textPrimary }]}>{k.email}</Text>
        <Text style={[styles.alt, { color: colors.textMuted }]}>{k.ad}</Text>
        <View style={styles.satir}>
          {ERISIMLER.map((e) => (
            <TouchableOpacity key={e.id} onPress={() => erisimSec(k.id, e.id)}
              style={[styles.chip, { borderColor: colors.border }, (s.erisim || 'musteri') === e.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              <Text style={{ color: (s.erisim || 'musteri') === e.id ? '#fff' : colors.textMuted, fontWeight: '700', fontSize: 12 }}>{e.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {(s.erisim || 'musteri') === 'musteri' && (
          <View style={styles.satir}>
            {musteriler.slice(0, 30).map((m) => (
              <TouchableOpacity key={m.id} onPress={() => firmaSec(k.id, m.id)}
                style={[styles.chip, { borderColor: colors.border }, s.musteriId === m.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Text style={{ color: s.musteriId === m.id ? '#fff' : colors.textMuted, fontSize: 12 }}>{m.firmaAdi ?? m.ad}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={[styles.satir, { marginTop: 10 }]}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => onayla(k)}>
            <Text style={styles.btnText}>Onayla</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#ef4444' }]} onPress={() => reddet(k)}>
            <Text style={styles.btnText}>Reddet</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><ActivityIndicator color={colors.primary} /></View>

  return (
    <ScreenContainer>
      <FlatList
        data={liste}
        keyExtractor={(k) => String(k.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); yukle() }} />}
        ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 40 }}>Onay bekleyen kayıt yok.</Text>}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  kart: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  email: { fontSize: 15, fontWeight: '800' },
  alt: { fontSize: 12, marginTop: 2, marginBottom: 8 },
  satir: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
})
```
(NOT: `musterileriGetir` mobilde gerçekten bu isimle mi? Step 1'de `crm-mobile/src/services/musteriService.js`'i kontrol et; isim farklıysa doğru export'u kullan. Modül atama mobilde ikinci aşamaya bırakılabilir — müşteri/firma seçimi MVP için yeterli, personel/yönetici onayı modülsüz de çalışır, modüller sonradan KullaniciYonetimi web'den de atanabilir.)

- [ ] **Step 2: RootNavigator — admin stack'e ekle**

Import:
```js
import AdminKullaniciOnayScreen from '../screens/admin/AdminKullaniciOnayScreen'
```
Admin `<Stack.Screen ...>` listesine (örn. `AdminYeniPersonel` yanına) ekle:
```jsx
            <Stack.Screen name="AdminKullaniciOnay" component={AdminKullaniciOnayScreen} options={{ title: 'Kullanıcı Onayları' }} />
```

- [ ] **Step 3: Admin menüsüne giriş ekle**

`crm-mobile/src/screens/admin/AdminDashboardScreen.js` (veya admin menü dizisi) içinde mevcut menü öğelerinin tanımlandığı yeri bul (örn. `AdminYeniPersonel`/`AdminPersonelTakip`'e giden kart). Aynı kalıpla bir kart ekle:
```jsx
{ baslik: 'Kullanıcı Onayları', ikon: 'user-check', ekran: 'AdminKullaniciOnay' }
```
(Gerçek prop adlarını mevcut menü öğelerinden kopyala — `navigation.navigate('AdminKullaniciOnay')` çağrısı yapacak şekilde.)

- [ ] **Step 4: Çalışma doğrula** — `expo start`, admin moduna geç, menüde "Kullanıcı Onayları" görünür ve açılır.

- [ ] **Step 5: Commit**
```bash
cd C:\Users\MSI-LAPTOP\crm-mobile
git add src/screens/admin/AdminKullaniciOnayScreen.js src/navigation/RootNavigator.js src/screens/admin/AdminDashboardScreen.js
git commit -m "feat(onay): mobil admin kullanici onay ekrani + menu"
```

---

## Task 8: Uçtan uca smoke testi + deploy

- [ ] **Step 1: DB hazır mı** — Task 1 migration uygulandı (kolonlar + RPC'ler mevcut).

- [ ] **Step 2: Web deploy**
```bash
cd C:\Users\MSI-LAPTOP\crm-app\.claude\worktrees\adoring-hermann-edb720
npx vercel --prod --yes
```

- [ ] **Step 3: Mobil OTA**
```bash
cd C:\Users\MSI-LAPTOP\crm-mobile
$env:CI=1; eas update --branch production --message "kullanici onay/yetkilendirme"
```

- [ ] **Step 4: Smoke — kayıt akışı**
  - Web `/signup` (veya mobil "Kayıt ol") → test e-posta ile kayıt ol → OTP gir → "Hesabınız onay bekliyor" mesajı görülür.
  - SQL ile doğrula: `select email, onay_durum from kullanicilar where email = '<test>';` → `beklemede`.

- [ ] **Step 5: Smoke — giriş engeli**
  - Aynı test hesabıyla giriş dene (web + mobil) → "Hesabınız onay bekliyor" mesajı, içeri girmez.

- [ ] **Step 6: Smoke — onay**
  - Admin olarak web KullaniciYonetimi → "Onay Bekleyenler" → erişim seviyesi seç (örn. Müşteri + firma) → Onayla.
  - SQL: `select onay_durum, tip, rol, musteri_id from kullanicilar where email='<test>';` → `onaylandi`, beklenen tip/rol.
  - Test hesabıyla tekrar giriş → artık içeri girer.
  - Aynı akışı mobil admin ekranından bir başka test hesabıyla tekrarla.

- [ ] **Step 7: Smoke — reddet**
  - Yeni test kaydı → admin "Reddet" → giriş denemesinde "Başvurunuz reddedildi." mesajı.

- [ ] **Step 8: Final commit/push**
```bash
# her iki repoda
git push
```

---

## Task 9 (OPSİYONEL): Yeni kayıtta admin'e push bildirimi

Kapsam dışı tutulabilir. İstenirse: `kayit-kod-dogrula` yeni kullanıcı oluşturduğunda `push-gonder` fonksiyonunu çağırıp rol='admin' kullanıcılara "Yeni kayıt onay bekliyor: {email}" gönder. Ayrı task olarak ele alınır.

---

## Notlar / riskler
- **Admin tanımı çift:** `yonetici_mi()` hem `rol='admin'` hem yönetici unvanlarını kabul eder → gerçek admin hesabı hangisiyle işaretliyse çalışır.
- **toCamel/arrayToCamel:** RPC `setof kullanicilar` döndürdüğü için snake_case gelir; servis katmanı camel'e çevirir. UI camel alan adları kullanır (`onayDurum`, `redNedeni`).
- **Mevcut müşteri self-kayıtları:** Migration öncesi kayıt olmuş `tip='musteri'` kullanıcılar `onay_durum='onaylandi'` (default) → mevcut davranış korunur, retroaktif onaya düşmezler.
- **RLS:** Yeni RPC'ler SECURITY DEFINER + `yonetici_mi()` guard'lı; tablo politikalarına ek değişiklik gerekmez.
```
