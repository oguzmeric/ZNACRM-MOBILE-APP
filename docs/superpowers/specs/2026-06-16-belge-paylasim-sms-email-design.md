# Belge Paylaşımı — SMS / E-posta Gönderimi (Teklif & Servis Formu)

**Tarih:** 2026-06-16
**Durum:** Tasarım onayı bekliyor

## Amaç

Teklifleri ve servis formlarını (raporlarını) müşteriye **SMS** ve/veya **e-posta**
ile, **tokenli public link** olarak gönderebilmek. Müşteri linke tıklayıp belgeyi
auth olmadan görüntüler/yazdırır.

## Backend (hazır — bu işin kapsamı dışında)

SMS/mail gönderimi Supabase Edge Function `belge-paylas` üzerinden yapılır. NetGSM
auth, hata çevirisi, tokenli link üretimi, Resend ile mail — hepsi server-side.

`belge-paylas` argümanları:
- `belge_tipi`: `'teklif' | 'servis_raporu'`
- `belge_id`: number (teklif → teklif.id, servis → talep.id)
- `kanal`: `'mail' | 'sms' | 'her_ikisi'`
- `email`: mail/her_ikisi ise zorunlu
- `gsm`: sms/her_ikisi ise zorunlu (edge function normalize ediyor: `5XXXXXXXXX`, `0...`, `+90...` hepsi geçer)
- `sure_gun`: opsiyonel, default 30
- `sablon`: `'standart' | 'karel'` — **yalnızca teklif** için
- `ozel_mesaj`: opsiyonel, mail gövdesine ek not

Dönüş: `{ ok, token, link, son_kullanma, mail_durumu, sms_durumu, kismi }`
Hata: `{ ok: false, hata, netgsmCode? }`

Public link formatı: `https://talep.znateknoloji.com/p/<token>`

## Kapsam (mobilde yapılacaklar)

### 1. `src/services/smsService.js` (yeni)
Handoff'taki iki fonksiyon birebir:
- `smsGonder(gsm, mesaj)` — `sms-gonder` invoke (şimdilik UI'a bağlanmayacak ama serviste dursun)
- `belgePaylas(args)` — `belge-paylas` invoke

### 2. `src/components/BelgePaylasModal.js` (yeni)
Hem teklif hem servis ekranının kullandığı ortak modal.

**Props:** `visible`, `onClose`, `belgeTipi` (`'teklif'|'servis_raporu'`),
`belgeId`, `formatSecimi` (bool — teklifte true), `prefillGsm`, `prefillEmail`,
`baslikMetni` (örn. firma adı, modal başlığında gösterilir).

**Akış / alanlar:**
1. **Kanal** segmenti: `SMS` · `E-posta` · `Her ikisi`
2. **Format** (yalnız `formatSecimi` true ise): `Trassir` · `Karel`
   → `sablon` olarak gönderilir (`trassir` | `karel`)
3. **Alıcı alanları** (kanala göre koşullu görünür):
   - GSM input (sms/her_ikisi) — `prefillGsm` ile dolu, düzenlenebilir
   - E-posta input (mail/her_ikisi) — `prefillEmail` ile dolu, düzenlenebilir
4. **Özel mesaj** (opsiyonel, çok satırlı) → `ozel_mesaj`
5. **Gönder** butonu:
   - Validasyon: sms varsa gsm dolu, mail varsa email dolu olmalı (boşsa uyarı)
   - `belgePaylas(...)` çağrılır, sırasında spinner
   - Başarılı: link gösterilir (seçilebilir metin) + "Linki Paylaş" (RN `Share.share`)
     + `sms_durumu`/`mail_durumu` özetlenir; `kismi` true ise kısmî başarı uyarısı
   - Hata: `hata` mesajı Alert ile gösterilir

**Yeni bağımlılık yok:** link kopyalama yerine RN'in yerleşik `Share` API'si kullanılır.

### 3. Ekran bağlantıları
- **`TeklifDetayScreen.js`**: mevcut placeholder "Email Gönder" butonu (şu an sadece
  mailto açıyor) → `BelgePaylasModal`'ı açacak şekilde değiştirilir.
  `belgeTipi='teklif'`, `formatSecimi=true`, prefill teklif kaydından.
  Buton etiketi "Müşteriye Gönder" olur.
- **`ServisTalebiDetayScreen.js`**: yeni "📤 Müşteriye Gönder" butonu → modal,
  `belgeTipi='servis_raporu'`, `belgeId=talep.id`, `formatSecimi=false`,
  prefill `talep.telefon` (ve varsa email).

## Karar kayıtları
- Format listesi: **yalnızca Trassir + Karel** (Standart/ZNA hariç).
- Gönderim **link** ile (PDF eki değil).
- Yalnızca **belge gönderimi**; doğrudan serbest-metin SMS UI'ı bu kapsamda yok.

## Hata / kenar durumlar
- Geçersiz GSM → edge function `{ ok:false, hata }` döner, Alert ile gösterilir.
- Kontör bitmiş olabilir: edge function `jobid` dönse de SMS gitmeyebilir (NetGSM
  panelinden manuel kontrol — uygulama bunu bilemez, bu beklenen bir sınırlama).
- Kısmî başarı (`kismi: true`, örn. mail gitti SMS gitmedi) → kullanıcıya net mesaj.
- Ağ hatası → invoke `error` → Alert.

## Test
- Teklif detay → Gönder → Karel + SMS → kendi numarana gönder → link gelsin, açılsın.
- Servis detay → Gönder → Her ikisi → link hem SMS hem mail ile gelsin.
- Boş alıcı, geçersiz numara → uyarı görünsün.
