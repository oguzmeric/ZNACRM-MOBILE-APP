# Mobil İyileştirmeler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** crm-mobile uygulamasına 4 iyileştirme: gerçek push notification, servis formu PDF arşivi, tutarlı pull-to-refresh, tutarlı tarih picker.

**Architecture:**
- Push: `expo-notifications` + Supabase Edge Function ile Expo Push API'ye relay
- PDF Arşiv: Supabase Storage bucket + ayrı tablo, servis detay ekranında listeleme
- Refresh: Tek custom hook `useRefresh`, mevcut + yeni ekranlarda uniform pattern
- Tarih: `react-native-modal-datetime-picker` üzerine 2 wrapper component (TarihSec, TarihSaatSec)

**Tech Stack:** React Native, Expo SDK 52, Supabase (PostgreSQL + Auth + Realtime + Storage + Edge Functions), expo-notifications, react-native-modal-datetime-picker.

**Test stratejisi:** Repo'da otomatik test altyapısı yok. Her task sonunda **manuel device/simulator doğrulaması** + commit. Kritik akışlar EAS Update öncesi son kez gerçek cihazda doğrulanır.

**Repo notu:** Migration dosyaları `crm-app` repo'sunda (`supabase_migrations/`). Mobile kod `crm-mobile` repo'sunda. Bu plan iki repoyu da kapsayan adımlar içerir.

---

## SECTION A — TARİH PİCKER STANDARDİZASYONU

İlk yapılır çünkü bağımsız, hızlı, kullanıcıya görünür değer üretir.

### Task A1: Paket kurulumu

**Files:**
- Modify: `crm-mobile/package.json`

- [ ] **Step 1: Paketleri kur**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
npx expo install react-native-modal-datetime-picker @react-native-community/datetimepicker
```

Beklenen: `package.json` ve `package-lock.json` güncellenir, paketler `dependencies` altına eklenir.

- [ ] **Step 2: Doğrula**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile && grep -E "modal-datetime-picker|datetimepicker" package.json
```

Beklenen çıktı (versiyonlar farklı olabilir):
```
"@react-native-community/datetimepicker": "...",
"react-native-modal-datetime-picker": "...",
```

- [ ] **Step 3: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add package.json package-lock.json
git commit -m "deps: tarih picker paketleri (modal-datetime-picker + datetimepicker)"
```

---

### Task A2: TarihSec component'i

**Files:**
- Create: `crm-mobile/src/components/TarihSec.js`

- [ ] **Step 1: Component'i yaz**

```js
// crm-mobile/src/components/TarihSec.js
// Tarih seçimi (saat YOK) — deadline/sınır alanları için.
// Kullanım:
//   <TarihSec value={tarih} onChange={setTarih} label="Son Tarih" minDate={new Date()} />

import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import DateTimePickerModal from 'react-native-modal-datetime-picker'
import { useTheme } from '../context/ThemeContext'

export default function TarihSec({ value, onChange, label, minDate, maxDate, placeholder }) {
  const [acik, setAcik] = useState(false)
  const { colors } = useTheme()

  const goster = value
    ? new Date(value).toLocaleDateString('tr-TR')
    : (placeholder ?? 'Tarih seçin')

  return (
    <View>
      {!!label && <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>}
      <TouchableOpacity
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setAcik(true)}
        activeOpacity={0.7}
      >
        <Text style={{ color: value ? colors.textPrimary : colors.textFaded, fontSize: 15 }}>
          {goster}
        </Text>
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={acik}
        mode="date"
        display={Platform.OS === 'ios' ? 'inline' : 'default'}
        date={value ? new Date(value) : new Date()}
        minimumDate={minDate}
        maximumDate={maxDate}
        onConfirm={(d) => { setAcik(false); onChange?.(d) }}
        onCancel={() => setAcik(false)}
        locale="tr-TR"
        confirmTextIOS="Seç"
        cancelTextIOS="Vazgeç"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { padding: 14, borderRadius: 10, borderWidth: 1 },
})
```

- [ ] **Step 2: Manuel doğrulama yok (component bağımsız)** — bir sonraki task'ta kullanıma alınınca doğrulanır.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add src/components/TarihSec.js
git commit -m "feat(component): TarihSec — tarih (gün) seçici wrapper"
```

---

### Task A3: TarihSaatSec component'i

**Files:**
- Create: `crm-mobile/src/components/TarihSaatSec.js`

- [ ] **Step 1: Component'i yaz**

```js
// crm-mobile/src/components/TarihSaatSec.js
// Tarih + saat seçimi — randevu/hatırlatma alanları için.
// Kullanım:
//   <TarihSaatSec value={tarihSaat} onChange={setTarihSaat} label="Randevu Zamanı" />

import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import DateTimePickerModal from 'react-native-modal-datetime-picker'
import { useTheme } from '../context/ThemeContext'

export default function TarihSaatSec({ value, onChange, label, minDate, maxDate, placeholder }) {
  const [acik, setAcik] = useState(false)
  const { colors } = useTheme()

  const goster = value
    ? new Date(value).toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : (placeholder ?? 'Tarih ve saat seçin')

  return (
    <View>
      {!!label && <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>}
      <TouchableOpacity
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setAcik(true)}
        activeOpacity={0.7}
      >
        <Text style={{ color: value ? colors.textPrimary : colors.textFaded, fontSize: 15 }}>
          {goster}
        </Text>
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={acik}
        mode="datetime"
        display={Platform.OS === 'ios' ? 'inline' : 'default'}
        date={value ? new Date(value) : new Date()}
        minimumDate={minDate}
        maximumDate={maxDate}
        onConfirm={(d) => { setAcik(false); onChange?.(d) }}
        onCancel={() => setAcik(false)}
        locale="tr-TR"
        confirmTextIOS="Seç"
        cancelTextIOS="Vazgeç"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { padding: 14, borderRadius: 10, borderWidth: 1 },
})
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add src/components/TarihSaatSec.js
git commit -m "feat(component): TarihSaatSec — tarih+saat seçici wrapper"
```

---

### Task A4: YeniGorevScreen — TarihSec ile son tarih

**Files:**
- Modify: `crm-mobile/src/screens/YeniGorevScreen.js`

- [ ] **Step 1: Mevcut tarih input'unu bul ve değiştir**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile && grep -n -E "sonTarih|son_tarih|deadline" src/screens/YeniGorevScreen.js
```

İlgili `TextInput` veya custom modal'ı tespit et.

- [ ] **Step 2: Import ekle ve render'ı değiştir**

`YeniGorevScreen.js` üst kısmında diğer importların yanına:
```js
import TarihSec from '../components/TarihSec'
```

Mevcut son tarih TextInput'unu (varsa) `<TarihSec />` ile değiştir:
```js
<TarihSec
  value={sonTarih}
  onChange={setSonTarih}
  label="Son Tarih"
  minDate={new Date()}
/>
```

State zaten `Date | null` veya ISO string olabilir. ISO string ise:
```js
<TarihSec
  value={sonTarih}
  onChange={(d) => setSonTarih(d.toISOString().slice(0, 10))}
  label="Son Tarih"
  minDate={new Date()}
/>
```

- [ ] **Step 3: Hatırlatma alanı varsa TarihSaatSec ile değiştir**

```js
import TarihSaatSec from '../components/TarihSaatSec'

<TarihSaatSec
  value={hatirlatma}
  onChange={setHatirlatma}
  label="Hatırlatma Zamanı"
  minDate={new Date()}
/>
```

- [ ] **Step 4: Manuel doğrulama**

Expo Go veya dev client'ta:
1. "Yeni Görev" aç
2. Son Tarih alanına tıkla → modal açılsın
3. Bir tarih seç → input'ta Türkçe formatla görünsün ("11.05.2026")
4. Görevi kaydet → liste/detayda doğru tarih görünsün

- [ ] **Step 5: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add src/screens/YeniGorevScreen.js
git commit -m "feat(gorev): tarih picker'ı TarihSec/TarihSaatSec ile standartla"
```

---

### Task A5: YeniServisTalebiScreen — planlanan ziyaret

**Files:**
- Modify: `crm-mobile/src/screens/YeniServisTalebiScreen.js`

- [ ] **Step 1: İlgili tarih alanını bul**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile && grep -n -E "planlanan|ziyaret|tarih" src/screens/YeniServisTalebiScreen.js
```

- [ ] **Step 2: TarihSaatSec import et ve değiştir**

```js
import TarihSaatSec from '../components/TarihSaatSec'

<TarihSaatSec
  value={planlananZiyaret}
  onChange={setPlanlananZiyaret}
  label="Planlanan Ziyaret"
  minDate={new Date()}
/>
```

- [ ] **Step 3: ServisTalebiDetayScreen'de de varsa aynı değişikliği yap**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile && grep -n -E "planlananZiyaret|planlanan_ziyaret" src/screens/ServisTalebiDetayScreen.js
```

Edit varsa aynı pattern.

- [ ] **Step 4: Manuel doğrulama**

Yeni servis talebi aç, planlanan ziyaret seç (örn. "Yarın 14:30"), kaydet, detayda doğru görünsün.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add src/screens/YeniServisTalebiScreen.js src/screens/ServisTalebiDetayScreen.js
git commit -m "feat(servis): planlanan ziyaret için TarihSaatSec"
```

---

### Task A6: YeniGorusmeScreen — görüşme zamanı

**Files:**
- Modify: `crm-mobile/src/screens/YeniGorusmeScreen.js`
- Possibly modify: `crm-mobile/src/screens/GorusmeDetayScreen.js`

- [ ] **Step 1: Görüşme tarih/saat alanlarını bul ve değiştir**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile && grep -n -E "gorusmeTarih|gorusme_tarih|tarih" src/screens/YeniGorusmeScreen.js
```

- [ ] **Step 2: TarihSaatSec ile değiştir**

```js
import TarihSaatSec from '../components/TarihSaatSec'

<TarihSaatSec
  value={gorusmeTarih}
  onChange={setGorusmeTarih}
  label="Görüşme Zamanı"
/>
```

- [ ] **Step 3: Manuel doğrulama**

Yeni görüşme oluştur, tarih+saat seç, kaydet, listede doğru görün.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add src/screens/YeniGorusmeScreen.js src/screens/GorusmeDetayScreen.js
git commit -m "feat(gorusme): görüşme zamanı için TarihSaatSec"
```

---

### Task A7: Demo formları — veriliş ve iade tarihleri

**Files:**
- Modify: `crm-mobile/src/screens/YeniDemoZimmetScreen.js`

- [ ] **Step 1: Veriliş ve beklenen iade alanlarını bul**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile && grep -n -E "verisTarih|beklenenIade|iadeTarih" src/screens/YeniDemoZimmetScreen.js
```

- [ ] **Step 2: TarihSec ile değiştir**

```js
import TarihSec from '../components/TarihSec'

<TarihSec value={verisTarih} onChange={setVerisTarih} label="Veriliş Tarihi" />
<TarihSec value={beklenenIade} onChange={setBeklenenIade} label="Beklenen İade Tarihi" minDate={verisTarih ?? new Date()} />
```

`minDate={verisTarih}` veriliş'ten önceki bir iade tarihi seçimini engeller.

- [ ] **Step 3: DemoSureyiUzat akışında da güncelle**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile && grep -rn "yeniIadeTarih\|sureyiUzat" src/screens/DemoCihazDetayScreen.js src/components/ 2>/dev/null
```

İlgili modal/inline alanı `<TarihSec />` ile değiştir.

- [ ] **Step 4: Manuel doğrulama**

Yeni demo zimmet aç → her iki tarihi seç → "iade tarihi < veriliş" deneyince picker buna izin vermesin → kaydet, detayda doğru görünsün → süreyi uzat akışında da pickeri kullan.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add src/screens/YeniDemoZimmetScreen.js src/screens/DemoCihazDetayScreen.js
git commit -m "feat(demo): zimmet ve uzatma tarihleri için TarihSec"
```

---

### Task A8: YeniTeklifScreen — geçerlilik tarihi

**Files:**
- Modify: `crm-mobile/src/screens/YeniTeklifScreen.js`

- [ ] **Step 1: Geçerlilik alanını bul**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile && grep -n -E "gecerlilik|gecerli_son" src/screens/YeniTeklifScreen.js
```

- [ ] **Step 2: TarihSec ile değiştir**

```js
import TarihSec from '../components/TarihSec'

<TarihSec
  value={gecerlilikTarih}
  onChange={setGecerlilikTarih}
  label="Geçerlilik Tarihi"
  minDate={new Date()}
/>
```

- [ ] **Step 3: Manuel doğrulama**

Yeni teklif oluştur, geçerlilik tarihi seç, kaydet, detayda doğru görünsün.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add src/screens/YeniTeklifScreen.js
git commit -m "feat(teklif): geçerlilik tarihi için TarihSec"
```

---

### Task A9: SECTION A duman testi

- [ ] **Step 1: Tüm formları sırayla test et**

Cihaz/simulator'da:
1. Yeni Görev → son tarih + hatırlatma (varsa) → kaydet
2. Yeni Servis → planlanan ziyaret → kaydet
3. Yeni Görüşme → görüşme zamanı → kaydet
4. Yeni Demo Zimmet → veriliş + iade → kaydet
5. Yeni Teklif → geçerlilik → kaydet

Hepsinde:
- Modal Türkçe açılıyor (`Seç` / `Vazgeç`)
- Seçili değer Türkçe formatla görünüyor
- Boş bırakınca placeholder görünüyor

- [ ] **Step 2: Hata yoksa A bölümü tamamlandı.**

---

## SECTION B — PULL-TO-REFRESH STANDARDİZASYONU

### Task B1: useRefresh hook

**Files:**
- Create: `crm-mobile/src/hooks/useRefresh.js`

- [ ] **Step 1: Hook'u yaz**

```js
// crm-mobile/src/hooks/useRefresh.js
// Tek pattern pull-to-refresh.
// Kullanım:
//   const { yenileniyor, refreshControl } = useRefresh(yukle)
//   <FlatList refreshControl={refreshControl} ... />

import { useState, useCallback } from 'react'
import { RefreshControl } from 'react-native'
import { useTheme } from '../context/ThemeContext'

export function useRefresh(yukleFn) {
  const [yenileniyor, setYenileniyor] = useState(false)
  const { colors } = useTheme()

  const onRefresh = useCallback(async () => {
    setYenileniyor(true)
    try { await yukleFn() }
    finally { setYenileniyor(false) }
  }, [yukleFn])

  const refreshControl = (
    <RefreshControl
      refreshing={yenileniyor}
      onRefresh={onRefresh}
      tintColor={colors.textPrimary}
      colors={[colors.primary]}
    />
  )

  return { yenileniyor, refreshControl, yenile: onRefresh }
}
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add src/hooks/useRefresh.js
git commit -m "feat(hook): useRefresh — uniform pull-to-refresh pattern"
```

---

### Task B2: Eksik ekranları tespit et

- [ ] **Step 1: refreshControl olmayan FlatList/ScrollView'ları bul**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile && grep -rln "FlatList\|ScrollView" src/screens/ > /tmp/screens-with-list.txt
cd /c/Users/MSI-LAPTOP/crm-mobile && grep -rln "refreshControl" src/screens/ > /tmp/screens-with-refresh.txt
diff /tmp/screens-with-list.txt /tmp/screens-with-refresh.txt
```

- [ ] **Step 2: Eksik liste oluştur**

Yukarıdaki diff'in çıkardığı dosyaları, ana liste ekranlarına filtrele:
- `GorevlerScreen.js`
- `ServisTalepleriScreen.js`
- `GorusmelerScreen.js`
- `TekliflerScreen.js`
- `MusterilerScreen.js` (eksikse)
- `MusteriDetayScreen.js` (alt sekmeler)

- [ ] **Step 3: Commit (sadece taramayı kayıt için, isteğe bağlı atla)**

Bu task çıktıyı sonraki task'lara aktarır, kendisi commit etmez.

---

### Task B3: GorevlerScreen — refresh ekle

**Files:**
- Modify: `crm-mobile/src/screens/GorevlerScreen.js`

- [ ] **Step 1: Mevcut yükleme fonksiyonunu bul**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile && grep -n -E "useCallback|yukle|yuklen" src/screens/GorevlerScreen.js | head -20
```

- [ ] **Step 2: useRefresh ekle**

İmport:
```js
import { useRefresh } from '../hooks/useRefresh'
```

Component içinde `yukle` fonksiyonunun yakınına:
```js
const { refreshControl } = useRefresh(yukle)
```

`<FlatList>` (veya `<ScrollView>`) prop'larına:
```js
refreshControl={refreshControl}
```

Mevcut elle yazılmış `RefreshControl` varsa silip hook'a delege et.

- [ ] **Step 3: Manuel doğrulama**

Görevler ekranını aç → aşağı çek → spinner görün → veri yenilensin.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add src/screens/GorevlerScreen.js
git commit -m "feat(gorevler): pull-to-refresh"
```

---

### Task B4: ServisTalepleriScreen — refresh ekle

**Files:**
- Modify: `crm-mobile/src/screens/ServisTalepleriScreen.js`

- [ ] **Step 1: useRefresh ile değiştir**

B3 ile aynı pattern:
```js
import { useRefresh } from '../hooks/useRefresh'
const { refreshControl } = useRefresh(yukle)
// FlatList prop'larına: refreshControl={refreshControl}
```

- [ ] **Step 2: Manuel doğrulama** — listeyi aşağı çek, yenilensin.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add src/screens/ServisTalepleriScreen.js
git commit -m "feat(servis): pull-to-refresh"
```

---

### Task B5: GorusmelerScreen — refresh ekle

**Files:**
- Modify: `crm-mobile/src/screens/GorusmelerScreen.js`

- [ ] **Step 1: useRefresh entegrasyonu**

```js
import { useRefresh } from '../hooks/useRefresh'
const { refreshControl } = useRefresh(yukle)
```

FlatList'e `refreshControl={refreshControl}` ekle.

- [ ] **Step 2: Manuel doğrulama**

- [ ] **Step 3: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add src/screens/GorusmelerScreen.js
git commit -m "feat(gorusmeler): pull-to-refresh"
```

---

### Task B6: TekliflerScreen — refresh ekle

**Files:**
- Modify: `crm-mobile/src/screens/TekliflerScreen.js`

- [ ] **Step 1: useRefresh entegrasyonu** — B3 ile aynı pattern.

- [ ] **Step 2: Manuel doğrulama**

- [ ] **Step 3: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add src/screens/TekliflerScreen.js
git commit -m "feat(teklifler): pull-to-refresh"
```

---

### Task B7: MusterilerScreen — varsa, refresh standardize et

**Files:**
- Modify: `crm-mobile/src/screens/MusterilerScreen.js`

- [ ] **Step 1: Mevcut refresh varsa useRefresh'e migrate et**

Manuel `RefreshControl` kodu varsa silip hook'a delege:
```js
const { refreshControl } = useRefresh(yukle)
```

Yoksa B3 pattern'i uygula.

- [ ] **Step 2: Manuel doğrulama**

- [ ] **Step 3: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add src/screens/MusterilerScreen.js
git commit -m "refactor(musteriler): useRefresh hook'una migrate"
```

---

### Task B8: MusteriDetayScreen alt sekmeler

**Files:**
- Modify: `crm-mobile/src/screens/MusteriDetayScreen.js`

- [ ] **Step 1: Alt sekmeleri (Kişiler/Lokasyonlar/Cihazlar/Servisler) bul**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile && grep -n "FlatList\|ScrollView" src/screens/MusteriDetayScreen.js
```

- [ ] **Step 2: Her sekme için useRefresh entegrasyonu**

Her sekmenin kendi yükleyicisi varsa ayrı `useRefresh(yukleSekmeX)`. Tek yükleyici varsa ortak hook çağrısı + her FlatList'e prop geçilir.

- [ ] **Step 3: Manuel doğrulama**

Müşteri detayını aç → her sekmeyi (kişiler, lokasyonlar, cihazlar, servisler) aşağı çek → yenilensin.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add src/screens/MusteriDetayScreen.js
git commit -m "feat(musteri-detay): alt sekmelerde pull-to-refresh"
```

---

### Task B9: Mevcut implementasyonları useRefresh'e migrate (opsiyonel)

**Files:**
- Modify: `crm-mobile/src/screens/BildirimlerScreen.js`
- Modify: `crm-mobile/src/screens/DemolarScreen.js`

- [ ] **Step 1: BildirimlerScreen migrate**

Mevcut state/handler:
```js
const [yenileniyor, setYenileniyor] = useState(false)
// ...
refreshControl={
  <RefreshControl
    refreshing={yenileniyor}
    onRefresh={() => { setYenileniyor(true); yukle() }}
    tintColor={colors.textPrimary}
  />
}
```

Yerine:
```js
import { useRefresh } from '../hooks/useRefresh'
const { refreshControl } = useRefresh(yukle)
// ...
refreshControl={refreshControl}
```

`yenileniyor` state'ini temizle (artık hook yönetiyor).

- [ ] **Step 2: DemolarScreen migrate** — aynı pattern.

- [ ] **Step 3: Manuel doğrulama** — her iki ekranda davranış aynı mı.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add src/screens/BildirimlerScreen.js src/screens/DemolarScreen.js
git commit -m "refactor(bildirim,demo): useRefresh hook'una migrate"
```

---

## SECTION C — SERVİS FORMU PDF ARŞİVİ

### Task C1: DB migration — servis_formu_arsivi tablosu

**Files:**
- Create: `crm-app/supabase_migrations/031_servis_formu_arsivi.sql`

- [ ] **Step 1: Migration SQL'i yaz**

```sql
-- 031_servis_formu_arsivi.sql
-- Servis formu PDF arşivi: her form üretimini kayıt altına alır.

create table public.servis_formu_arsivi (
  id bigserial primary key,
  servis_id bigint not null references public.servis_talepleri(id) on delete cascade,
  dosya_yolu text not null,
  olusturan_id bigint not null references public.kullanicilar(id),
  boyut_byte integer,
  olusturma_tarih timestamptz not null default now()
);

create index idx_servis_formu_arsivi_servis on public.servis_formu_arsivi(servis_id, olusturma_tarih desc);

alter table public.servis_formu_arsivi enable row level security;

-- Yetkili kullanıcılar (servisi görme yetkisi olanlar) arşive de erişir.
-- Basitçe authenticated rolü; daha sıkı kural gerekirse sonra eklenir.
create policy "auth_select_arsiv" on public.servis_formu_arsivi
  for select to authenticated using (true);

create policy "auth_insert_arsiv" on public.servis_formu_arsivi
  for insert to authenticated with check (true);

-- PostgREST schema cache reload
notify pgrst, 'reload schema';
```

- [ ] **Step 2: Migration'ı uygula (Supabase dashboard SQL editor'da çalıştır)**

Beklenen: Tablo + index + RLS policy oluşur, hata yok.

- [ ] **Step 3: Doğrula**

Supabase SQL editor'da:
```sql
select count(*) from public.servis_formu_arsivi;
```
Beklenen: `0` (tablo boş).

- [ ] **Step 4: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-app
git add supabase_migrations/031_servis_formu_arsivi.sql
git commit -m "db(servis): servis_formu_arsivi tablosu + RLS"
```

---

### Task C2: Storage bucket setup

- [ ] **Step 1: Supabase dashboard → Storage → New bucket**

Ayarlar:
- Name: `servis-formlari`
- Public: **NO** (private)
- File size limit: `5 MB`
- Allowed MIME types: `application/pdf`

- [ ] **Step 2: RLS policy ekle (Storage → Policies)**

`servis-formlari` bucket'ı için:

**SELECT (authenticated user dosyaları görsün):**
```sql
create policy "auth_select_servis_formlari" on storage.objects
  for select to authenticated
  using (bucket_id = 'servis-formlari');
```

**INSERT (authenticated user dosya yüklesin):**
```sql
create policy "auth_insert_servis_formlari" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'servis-formlari');
```

- [ ] **Step 3: Doğrula**

Dashboard'da bucket görünür, policy'ler aktif.

- [ ] **Step 4: Commit (sadece SQL'i repo'ya kaydet)**

```bash
cd /c/Users/MSI-LAPTOP/crm-app
cat > supabase_migrations/032_servis_formlari_bucket.sql <<'EOF'
-- 032_servis_formlari_bucket.sql
-- Storage bucket setup (manuel dashboard'dan da yapılır, SQL referans için).

-- Bucket'ı oluştur (idempotent)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('servis-formlari', 'servis-formlari', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

create policy "auth_select_servis_formlari" on storage.objects
  for select to authenticated
  using (bucket_id = 'servis-formlari');

create policy "auth_insert_servis_formlari" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'servis-formlari');
EOF
git add supabase_migrations/032_servis_formlari_bucket.sql
git commit -m "db(storage): servis-formlari bucket + RLS"
```

---

### Task C3: servisFormuArsivService

**Files:**
- Create: `crm-mobile/src/services/servisFormuArsivService.js`

- [ ] **Step 1: Service'i yaz**

```js
// crm-mobile/src/services/servisFormuArsivService.js
// Servis formu PDF arşivi için CRUD + storage operasyonları.

import { supabase } from '../lib/supabase'
import * as FileSystem from 'expo-file-system/legacy'

const BUCKET = 'servis-formlari'

// PDF dosyasını storage'a yükle ve arşiv tablosuna kayıt at.
// Dönüş: { id, dosyaYolu } veya null.
export async function arsiveYukle({ servisId, lokalPdfUri, olusturanId }) {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const dosyaYolu = `servis_${servisId}/${ts}.pdf`

    // expo-file-system ile binary oku
    const base64 = await FileSystem.readAsStringAsync(lokalPdfUri, { encoding: FileSystem.EncodingType.Base64 })
    const arrayBuffer = decodeBase64ToArrayBuffer(base64)

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(dosyaYolu, arrayBuffer, { contentType: 'application/pdf', upsert: false })

    if (uploadErr) {
      console.warn('[arsiveYukle] upload fail:', uploadErr.message)
      return null
    }

    const info = await FileSystem.getInfoAsync(lokalPdfUri)
    const boyut = info.exists ? info.size : null

    const { data, error } = await supabase
      .from('servis_formu_arsivi')
      .insert({ servis_id: servisId, dosya_yolu: dosyaYolu, olusturan_id: olusturanId, boyut_byte: boyut })
      .select('id, dosya_yolu')
      .single()

    if (error) {
      console.warn('[arsiveYukle] insert fail:', error.message)
      return null
    }
    return { id: data.id, dosyaYolu: data.dosya_yolu }
  } catch (e) {
    console.warn('[arsiveYukle] catch:', e?.message)
    return null
  }
}

// Bir servisin arşivlenmiş tüm formlarını listele (yeni → eski).
export async function arsivListele(servisId) {
  const { data, error } = await supabase
    .from('servis_formu_arsivi')
    .select(`
      id,
      dosya_yolu,
      boyut_byte,
      olusturma_tarih,
      olusturan_id,
      kullanicilar:olusturan_id (ad, soyad)
    `)
    .eq('servis_id', servisId)
    .order('olusturma_tarih', { ascending: false })

  if (error) {
    console.warn('[arsivListele] fail:', error.message)
    return []
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    dosyaYolu: r.dosya_yolu,
    boyut: r.boyut_byte,
    olusturmaTarih: r.olusturma_tarih,
    olusturanAd: r.kullanicilar
      ? `${r.kullanicilar.ad ?? ''} ${r.kullanicilar.soyad ?? ''}`.trim()
      : '',
  }))
}

// Signed URL al (1 saat geçerli) — indirme/paylaşma için.
export async function arsivSignedUrl(dosyaYolu) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(dosyaYolu, 3600)
  if (error) {
    console.warn('[arsivSignedUrl] fail:', error.message)
    return null
  }
  return data.signedUrl
}

// base64 → ArrayBuffer helper (RN'de Buffer yok)
function decodeBase64ToArrayBuffer(base64) {
  const binaryString = global.atob ? global.atob(base64) : Buffer.from(base64, 'base64').toString('binary')
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i)
  return bytes.buffer
}
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add src/services/servisFormuArsivService.js
git commit -m "feat(servis-arsiv): servisFormuArsivService — upload/list/signed URL"
```

---

### Task C4: servisFormuService — üretim sonrası arşive yükle

**Files:**
- Modify: `crm-mobile/src/services/servisFormuService.js`

- [ ] **Step 1: Mevcut formuOlustur fonksiyonunu bul**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile && grep -n "formuOlustur\|Print\." src/services/servisFormuService.js | head -20
```

- [ ] **Step 2: PDF üretildikten sonra arşiv kaydı ekle**

`Print.printToFileAsync(...)` sonrası, `Sharing.shareAsync(...)` öncesi:

```js
import { arsiveYukle } from './servisFormuArsivService'

// ... PDF üretildi, uri elimizde
const lokalUri = pdfDosyasi.uri

// Arşive yükle (best-effort, fail olsa bile paylaş çalışır)
if (servisId && kullaniciId) {
  arsiveYukle({ servisId, lokalPdfUri: lokalUri, olusturanId: kullaniciId })
    .catch((e) => console.warn('[arşiv yükleme] yumuşak fail:', e?.message))
}

// Mevcut paylaş akışı devam eder
await Sharing.shareAsync(lokalUri, ...)
```

`servisId` ve `kullaniciId` parametre olarak fonksiyona geçirilir; çağıran taraf zaten biliyor (servis detay).

- [ ] **Step 3: Çağıran tarafları güncelle**

`ServisTalebiDetayScreen.js`'de `formuOlustur` çağrısını bul:
```bash
cd /c/Users/MSI-LAPTOP/crm-mobile && grep -n "formuOlustur" src/screens/ServisTalebiDetayScreen.js
```

Çağrıya servisId + kullaniciId parametrelerini ekle (zaten var muhtemelen).

- [ ] **Step 4: Manuel doğrulama**

Servis detayda "Form Üret" → PDF açılsın → Supabase dashboard → Storage → `servis-formlari` bucket → yeni dosya görün → SQL editor'da:
```sql
select * from servis_formu_arsivi order by olusturma_tarih desc limit 5;
```
Yeni satır görün.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add src/services/servisFormuService.js src/screens/ServisTalebiDetayScreen.js
git commit -m "feat(servis): form üretiminde otomatik arşive yükle"
```

---

### Task C5: ServisTalebiDetayScreen — Arşiv Bölümü UI

**Files:**
- Modify: `crm-mobile/src/screens/ServisTalebiDetayScreen.js`

- [ ] **Step 1: State ve yükleyici ekle**

```js
import { useState, useEffect, useCallback } from 'react'
import { arsivListele, arsivSignedUrl } from '../services/servisFormuArsivService'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

// ...component içinde
const [arsiv, setArsiv] = useState([])
const [arsivYukleniyor, setArsivYukleniyor] = useState(true)

const yukleArsiv = useCallback(async () => {
  if (!servisId) return
  setArsivYukleniyor(true)
  const data = await arsivListele(servisId)
  setArsiv(data)
  setArsivYukleniyor(false)
}, [servisId])

useEffect(() => { yukleArsiv() }, [yukleArsiv])
```

- [ ] **Step 2: Paylaş/indir handler**

```js
const arsivPaylas = async (item) => {
  try {
    const url = await arsivSignedUrl(item.dosyaYolu)
    if (!url) {
      Alert.alert('Hata', 'Dosya bağlantısı oluşturulamadı.')
      return
    }
    const lokal = `${FileSystem.cacheDirectory}arsiv_${item.id}.pdf`
    const indirme = await FileSystem.downloadAsync(url, lokal)
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(indirme.uri, { mimeType: 'application/pdf', dialogTitle: 'Servis Formu' })
    } else {
      Alert.alert('Bilgi', 'Cihazda paylaşım yok. URL kopyalandı.')
    }
  } catch (e) {
    Alert.alert('Hata', 'Form açılamadı: ' + (e?.message ?? 'bilinmeyen'))
  }
}
```

- [ ] **Step 3: Render bölümü ekle**

Detay sayfasında "Form Üret" butonunun ALTINA:
```jsx
<View style={{ marginTop: 16 }}>
  <Text style={{ color: colors.textMuted, fontWeight: '700', marginBottom: 8 }}>
    📎 Form Arşivi {arsiv.length > 0 ? `(${arsiv.length})` : ''}
  </Text>

  {arsivYukleniyor ? (
    <ActivityIndicator color={colors.textPrimary} />
  ) : arsiv.length === 0 ? (
    <Text style={{ color: colors.textFaded, fontStyle: 'italic', fontSize: 13 }}>
      Henüz form üretilmemiş.
    </Text>
  ) : (
    arsiv.map((item) => (
      <TouchableOpacity
        key={item.id}
        onPress={() => arsivPaylas(item)}
        style={{
          flexDirection: 'row', alignItems: 'center',
          padding: 10, borderRadius: 8,
          backgroundColor: colors.surface,
          marginBottom: 6,
        }}
      >
        <Text style={{ fontSize: 18, marginRight: 8 }}>📄</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
            {new Date(item.olusturmaTarih).toLocaleString('tr-TR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {item.olusturanAd || 'Bilinmeyen'}{item.boyut ? ` · ${Math.round(item.boyut / 1024)} KB` : ''}
          </Text>
        </View>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>Aç</Text>
      </TouchableOpacity>
    ))
  )}
</View>
```

- [ ] **Step 4: Yeni form üretildikten sonra arşivi yenile**

Mevcut `formuOlustur` çağrısının sonrasına:
```js
// PDF üretildi → kısa bekleme sonrası arşivi yenile (yükleme async)
setTimeout(() => yukleArsiv(), 2000)
```

- [ ] **Step 5: Manuel doğrulama**

1. Servis detay → Form Üret → PDF aç → kapat
2. 2 saniye sonra "Form Arşivi" bölümünde yeni satır görün
3. Satıra tıkla → PDF tekrar açılsın
4. Tekrar Form Üret → 2 satır olsun

- [ ] **Step 6: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add src/screens/ServisTalebiDetayScreen.js
git commit -m "feat(servis-detay): form arşivi bölümü"
```

---

## SECTION D — PUSH NOTIFICATION

### Task D1: Paket kurulumu ve app.json yapılandırma

**Files:**
- Modify: `crm-mobile/package.json`
- Modify: `crm-mobile/app.json`

- [ ] **Step 1: expo-notifications kur**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile && npx expo install expo-notifications expo-device
```

- [ ] **Step 2: app.json'a notifications config ekle**

`crm-mobile/app.json` içinde `"expo"` blokuna:
```json
{
  "expo": {
    "plugins": [
      // ... mevcut pluginler ...
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#0176D3"
        }
      ]
    ],
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#0176D3",
      "iosDisplayInForeground": true
    },
    "ios": {
      "bundleIdentifier": "...",
      "infoPlist": {
        // Mevcut + push entitlement EAS Build sırasında otomatik
      }
    },
    "android": {
      "package": "...",
      "googleServicesFile": "./google-services.json",
      "useNextNotificationsApi": true
    }
  }
}
```

**Not:** `notification-icon.png` 96x96 beyaz transparan PNG (Android requirements). Yoksa varsayılan ikon kullanılır, sonradan eklenir.

- [ ] **Step 3: EAS Build credentials kontrolü**

Push notification gerçek cihazda test için EAS Build (development veya production profile) gerekir. Expo Go push'a sınırlı destek var.

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile && eas credentials
```

iOS için "Push Key" yoksa Expo otomatik oluşturmayı önerir → kabul et. Android için FCM Server Key gerekiyor — kullanıcıya açıklamak için: Firebase Console'da proje yoksa oluşturulur, `google-services.json` indirilir.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add package.json package-lock.json app.json
git commit -m "deps: expo-notifications + push config"
```

---

### Task D2: DB migration — kullanici_push_tokenlari

**Files:**
- Create: `crm-app/supabase_migrations/033_push_tokenlari.sql`

- [ ] **Step 1: Migration SQL'i yaz**

```sql
-- 033_push_tokenlari.sql
-- Cihaz başına Expo push token kaydı.

create table public.kullanici_push_tokenlari (
  id bigserial primary key,
  kullanici_id bigint not null references public.kullanicilar(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  son_gorulen timestamptz not null default now(),
  olusturma_tarih timestamptz not null default now(),
  unique (kullanici_id, token)
);

create index idx_push_tokenlari_kullanici on public.kullanici_push_tokenlari(kullanici_id);

alter table public.kullanici_push_tokenlari enable row level security;

create policy "auth_select_own_tokens" on public.kullanici_push_tokenlari
  for select to authenticated using (true);

create policy "auth_insert_tokens" on public.kullanici_push_tokenlari
  for insert to authenticated with check (true);

create policy "auth_update_own_tokens" on public.kullanici_push_tokenlari
  for update to authenticated using (true) with check (true);

create policy "auth_delete_own_tokens" on public.kullanici_push_tokenlari
  for delete to authenticated using (true);

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Migration'ı uygula** (Supabase dashboard SQL editor)

- [ ] **Step 3: Doğrula**

```sql
select count(*) from public.kullanici_push_tokenlari;
```
Beklenen: `0`.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-app
git add supabase_migrations/033_push_tokenlari.sql
git commit -m "db(push): kullanici_push_tokenlari tablosu + RLS"
```

---

### Task D3: pushBildirimKayit lib

**Files:**
- Create: `crm-mobile/src/lib/pushBildirimKayit.js`

- [ ] **Step 1: Lib'i yaz**

```js
// crm-mobile/src/lib/pushBildirimKayit.js
// Expo push token'ını al ve Supabase'e kaydet/sil.

import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// Foreground'da bildirim nasıl gösterilsin
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

let _kayitliToken = null

// Login sonrası çağrılır.
export async function pushTokenKaydet(kullaniciId) {
  if (!Device.isDevice) {
    console.log('[pushTokenKaydet] simulator — push devre dışı')
    return null
  }

  try {
    // İzin durumunu kontrol et
    const { status: mevcut } = await Notifications.getPermissionsAsync()
    let final = mevcut
    if (mevcut !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      final = status
    }
    if (final !== 'granted') {
      console.log('[pushTokenKaydet] izin verilmedi')
      return null
    }

    // Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Bildirimler',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0176D3',
      })
    }

    // Token al
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID || undefined,
    })
    const token = tokenData.data
    if (!token) return null

    _kayitliToken = token

    // Supabase'e upsert
    const { error } = await supabase
      .from('kullanici_push_tokenlari')
      .upsert(
        {
          kullanici_id: kullaniciId,
          token,
          platform: Platform.OS,
          son_gorulen: new Date().toISOString(),
        },
        { onConflict: 'kullanici_id,token' }
      )

    if (error) {
      console.warn('[pushTokenKaydet] supabase fail:', error.message)
      return null
    }

    console.log('[pushTokenKaydet] OK', token.slice(0, 25) + '...')
    return token
  } catch (e) {
    console.warn('[pushTokenKaydet] catch:', e?.message)
    return null
  }
}

// Logout sırasında çağrılır.
export async function pushTokenSil(kullaniciId) {
  if (!_kayitliToken) return
  try {
    await supabase
      .from('kullanici_push_tokenlari')
      .delete()
      .eq('kullanici_id', kullaniciId)
      .eq('token', _kayitliToken)
    _kayitliToken = null
  } catch (e) {
    console.warn('[pushTokenSil] catch:', e?.message)
  }
}
```

- [ ] **Step 2: AuthContext'e bağla**

`crm-mobile/src/context/AuthContext.js` (veya benzer dosyada login/logout):

```js
import { pushTokenKaydet, pushTokenSil } from '../lib/pushBildirimKayit'

// Login sonrasında, kullanıcı set edildiğinde:
useEffect(() => {
  if (kullanici?.id) {
    pushTokenKaydet(kullanici.id)
  }
}, [kullanici?.id])

// cikisYap fonksiyonunda await supabase.auth.signOut() ÖNCESİ:
await pushTokenSil(kullanici?.id)
```

- [ ] **Step 3: EXPO_PUBLIC_PROJECT_ID env varsa kontrol et**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile && cat eas.json | grep projectId
```

`projectId` `app.json`'da `expo.extra.eas.projectId` altında olmalı. Yoksa:
```bash
cd /c/Users/MSI-LAPTOP/crm-mobile && eas init
```

- [ ] **Step 4: Manuel doğrulama (gerçek cihazda)**

1. EAS dev build veya internal distribution build çek
2. Cihazda login ol
3. Permission dialog görün → kabul et
4. Supabase dashboard → SQL editor:
   ```sql
   select * from kullanici_push_tokenlari where kullanici_id = <senin_id>;
   ```
   Token görün.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add src/lib/pushBildirimKayit.js src/context/AuthContext.js
git commit -m "feat(push): expo push token kayıt/silme"
```

---

### Task D4: Edge Function — push-gonder

**Files:**
- Create: `crm-app/supabase/functions/push-gonder/index.ts`

- [ ] **Step 1: Klasör yapısını hazırla**

```bash
cd /c/Users/MSI-LAPTOP/crm-app
mkdir -p supabase/functions/push-gonder
```

- [ ] **Step 2: Function kodunu yaz**

```ts
// crm-app/supabase/functions/push-gonder/index.ts
// Yeni bildirim eklendiğinde çağrılır, hedef kullanıcının tüm cihazlarına push atar.
//
// Çağrı: POST { bildirimId: number }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

serve(async (req) => {
  try {
    const { bildirimId } = await req.json()
    if (!bildirimId) return new Response('bildirimId gerekli', { status: 400 })

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE)

    // Bildirimi al
    const { data: bildirim, error: bErr } = await supa
      .from('bildirimler')
      .select('id, kullanici_id, baslik, mesaj, tip')
      .eq('id', bildirimId)
      .single()

    if (bErr || !bildirim) {
      return new Response('Bildirim bulunamadı', { status: 404 })
    }

    // Hedef kullanıcının token'larını al
    const { data: tokenler, error: tErr } = await supa
      .from('kullanici_push_tokenlari')
      .select('id, token')
      .eq('kullanici_id', bildirim.kullanici_id)

    if (tErr) return new Response('Token sorgu hatası: ' + tErr.message, { status: 500 })
    if (!tokenler || tokenler.length === 0) {
      return new Response('Token yok', { status: 200 })
    }

    // Okunmamış sayısını al (badge için)
    const { count: okunmamis } = await supa
      .from('bildirimler')
      .select('id', { count: 'exact', head: true })
      .eq('kullanici_id', bildirim.kullanici_id)
      .eq('okundu', false)

    // Expo Push API'ye batch
    const messages = tokenler.map((t) => ({
      to: t.token,
      sound: 'default',
      title: bildirim.baslik ?? 'Bildirim',
      body: bildirim.mesaj ?? '',
      badge: okunmamis ?? undefined,
      data: { bildirimId: bildirim.id, tip: bildirim.tip },
    }))

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    })
    const sonuc = await res.json()

    // Geçersiz token'ları temizle
    if (Array.isArray(sonuc?.data)) {
      const silinecek: number[] = []
      sonuc.data.forEach((row: any, i: number) => {
        if (row.status === 'error' && row.details?.error === 'DeviceNotRegistered') {
          silinecek.push(tokenler[i].id)
        }
      })
      if (silinecek.length > 0) {
        await supa.from('kullanici_push_tokenlari').delete().in('id', silinecek)
      }
    }

    return new Response(JSON.stringify({ ok: true, gonderildi: tokenler.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response('Hata: ' + (e?.message ?? 'bilinmeyen'), { status: 500 })
  }
})
```

- [ ] **Step 3: Deploy**

```bash
cd /c/Users/MSI-LAPTOP/crm-app
npx supabase functions deploy push-gonder --no-verify-jwt
```

`--no-verify-jwt` çünkü function DB trigger'dan çağrılacak (service role kullanıyor).

- [ ] **Step 4: Test (manuel POST)**

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/push-gonder" \
  -H "Content-Type: application/json" \
  -d '{"bildirimId": <test_bildirim_id>}'
```

Beklenen: `{"ok":true,"gonderildi":1}` (token'ı olan test kullanıcı için).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-app
git add supabase/functions/push-gonder/
git commit -m "feat(push): edge function push-gonder"
```

---

### Task D5: DB trigger — bildirim eklenince push tetikle

**Files:**
- Create: `crm-app/supabase_migrations/034_bildirim_push_trigger.sql`

- [ ] **Step 1: Migration yaz**

```sql
-- 034_bildirim_push_trigger.sql
-- bildirimler tablosuna her INSERT sonrası push-gonder edge function'ı çağır.

-- pg_net extension (Supabase'de default aktif değilse)
create extension if not exists pg_net;

-- Edge function URL'i runtime config'den oku
-- Project ref: dashboard → Settings → API
-- (Hardcoded URL gerek yoksa pg_net.http_post net.http_post kullanır)

create or replace function public.bildirim_push_trigger()
returns trigger
language plpgsql
security definer
as $$
declare
  url text := current_setting('app.settings.push_function_url', true);
  service_key text := current_setting('app.settings.service_role_key', true);
begin
  if url is null or service_key is null then
    return new;  -- config yok, sessiz geç
  end if;

  perform net.http_post(
    url := url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('bildirimId', new.id)
  );
  return new;
end;
$$;

drop trigger if exists tr_bildirim_push on public.bildirimler;
create trigger tr_bildirim_push
  after insert on public.bildirimler
  for each row
  execute function public.bildirim_push_trigger();

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Database settings'i ayarla**

Supabase Dashboard → Settings → Database → Custom Postgres Config (veya SQL):

```sql
alter database postgres set "app.settings.push_function_url" = 'https://<PROJECT_REF>.supabase.co/functions/v1/push-gonder';
alter database postgres set "app.settings.service_role_key" = '<SERVICE_ROLE_KEY>';
```

**Önemli:** `<PROJECT_REF>` ve `<SERVICE_ROLE_KEY>` gerçek değerler. Service role key gizli — sadece Postgres config'te durur, kod tarafına sızdırılmaz.

- [ ] **Step 3: Migration'ı uygula** (SQL editor'da çalıştır)

- [ ] **Step 4: Manuel doğrulama**

1. Mobile app'te login ol (token kaydı düşsün)
2. Web/admin'den o kullanıcıya bildirim oluştur (örn. yeni görev ata)
3. Cihazın kilit ekranında push görün

Hata varsa Edge Function loglarına bak:
- Supabase Dashboard → Edge Functions → push-gonder → Logs

- [ ] **Step 5: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-app
git add supabase_migrations/034_bildirim_push_trigger.sql
git commit -m "db(push): bildirim insert trigger → edge function"
```

---

### Task D6: Bildirim tıklama davranışı

**Files:**
- Modify: `crm-mobile/App.js` (veya kök navigation dosyası)

- [ ] **Step 1: Notification listener ekle**

`App.js` veya `RootNavigator.js`'de:

```js
import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'

// component içinde
const responseListener = useRef()

useEffect(() => {
  // Kullanıcı bildirime dokunduğunda
  responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
    // Spec: özel deep link yok — app açılıyor ve son ekranda kalıyor.
    // İleride deep link istenirse: response.notification.request.content.data.bildirimId
  })

  // Foreground'da bildirim geldiğinde de badge güncel kalsın
  return () => {
    if (responseListener.current) {
      Notifications.removeNotificationSubscription(responseListener.current)
    }
  }
}, [])
```

- [ ] **Step 2: Badge sync**

`bildirimService` veya `BildirimlerScreen` her güncellendiğinde okunmamış sayısını badge'e yansıt:

```js
import * as Notifications from 'expo-notifications'

// okunmamis sayısı değiştiğinde
useEffect(() => {
  Notifications.setBadgeCountAsync(okunmamisSayisi).catch(() => {})
}, [okunmamisSayisi])
```

- [ ] **Step 3: Manuel doğrulama**

1. Cihaza push gelsin → ikon üstünde badge "1" görün
2. Push'a tıkla → app açılsın → çan ikonunda yeni bildirim sayısı görünsün
3. Bildirimi okundu işaretle → badge sıfırlansın

- [ ] **Step 4: Commit**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
git add App.js src/screens/BildirimlerScreen.js
git commit -m "feat(push): tıklama listener + iOS badge sync"
```

---

### Task D7: SECTION D uçtan uca test

- [ ] **Step 1: EAS Build (development veya internal)**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
eas build --profile development --platform ios   # veya android
```

(Yeni paket eklendiği için JS-only EAS Update yetmez, native build gerekir.)

- [ ] **Step 2: Cihaza yükle, login ol** — token DB'de görün.

- [ ] **Step 3: Test bildirimi tetikle**

Web admin panelinden veya doğrudan SQL ile:
```sql
insert into bildirimler (kullanici_id, baslik, mesaj, tip)
values (<test_kullanici>, 'Push test', 'Bu bir test bildirimidir', 'bilgi');
```

- [ ] **Step 4: 3 senaryoyu test et**

1. **App kapalı** → push gelsin → tıkla → app açılsın
2. **App arka planda** → push gelsin → tıkla → app açılsın
3. **App foreground** → push üst banner olarak görünsün → çan ikonunda badge artsın

- [ ] **Step 5: Logout test**

Logout ol → token DB'den silinsin:
```sql
select * from kullanici_push_tokenlari where kullanici_id = <test>;  -- 0 satır
```

---

## SECTION E — FİNAL

### Task E1: Spec coverage doğrulama

- [ ] **Step 1: Spec'in tüm alt başlıklarını gözden geçir**

`docs/superpowers/specs/2026-05-09-mobile-iyilestirmeler-design.md`'deki her madde:
- Push notification → Section D ✓
- PDF arşivi → Section C ✓
- Pull-to-refresh → Section B ✓
- Tarih picker → Section A ✓

- [ ] **Step 2: Smoke checklist (tüm cihazda)**

- [ ] Yeni görev oluştur → tarih picker çalışıyor
- [ ] Yeni servis → planlanan ziyaret datetime
- [ ] Yeni demo zimmet → tarih picker'lar
- [ ] Görevler/servis/görüşme/teklifler liste → pull-to-refresh
- [ ] Müşteri detay alt sekmeler → refresh
- [ ] Servis form üret → arşivde görün → tekrar aç
- [ ] Push token DB'de kayıtlı
- [ ] Test bildirim push olarak gelir
- [ ] Logout → token siler

### Task E2: EAS Update yayınla

- [ ] **Step 1: Native paket değişti, BUILD gerekir** (sadece JS Update yetmez!)

Push notification için yeni native paket (`expo-notifications`, `expo-device`) eklendi. EAS Build şart.

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile
eas build --profile production --platform all
```

- [ ] **Step 2: Build tamamlanınca TestFlight + Play submit**

```bash
eas submit --platform ios --latest
eas submit --platform android --latest
```

- [ ] **Step 3: Daha sonra yapılan JS-only düzeltmeler için Update**

```bash
eas update --branch production --message "Mobil iyileştirmeler: push, arşiv, refresh, tarih picker"
```

### Task E3: Final commit ve push

- [ ] **Step 1: Tüm değişiklikleri pushla**

```bash
cd /c/Users/MSI-LAPTOP/crm-mobile && git push origin main
cd /c/Users/MSI-LAPTOP/crm-app && git push origin main
```

- [ ] **Step 2: Kullanıcıya bildir** — TestFlight'a yeni build düştü, deploy süreci başladı.

---

## Self-Review Notları

**Spec coverage:** Tüm 4 alt özellik (Push, Arşiv, Refresh, Tarih) ayrı section'larla planda yer alıyor. Out-of-scope öğeler (TR/EN, deep link, geriye dönük migrasyon) plana DAHIL EDİLMEDİ.

**Type tutarlılığı:** `arsiveYukle({ servisId, lokalPdfUri, olusturanId })` parametre adları `arsivListele(servisId)` ile uyumlu. `pushTokenKaydet(kullaniciId)` ↔ `pushTokenSil(kullaniciId)` simetrik.

**Manuel test bağımlılığı:** Repo'da otomatik test framework olmadığı için her task sonunda "manuel doğrulama" adımı koyuldu. Kritik akışlar (Section D push) gerçek cihaz gerektirir.

**Sıralama mantığı:** A→B→C→D, kolaydan zora. A ve B JS-only (EAS Update yeter), C JS-only ama Storage setup ister, D native build gerektirir. D'yi sona koymak EAS Update gönderim sayısını minimize eder.
