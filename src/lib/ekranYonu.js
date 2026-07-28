// Ekran yönü kontrolü — SADECE çizim/kroki ekranı yatay olabilsin diye.
//
// Uygulamanın tamamı dikey (app.json orientation: "default" + App.js'te global
// dikey kilit). Keşif çizim modalı açılınca kilit gevşetilir, kapanınca geri
// alınır. Böylece listeler/formlar sahada elde tutarken dönmeye devam etmez.
//
// ⚠ OTA GÜVENLİĞİ: expo-screen-orientation NATIVE bir modüldür. Bu dosya EAS
// Update ile mevcut (portrait olarak derlenmiş) uygulamaya da iner; orada
// native taraf YOKTUR. O yüzden modül `require` ile lazy alınır ve HER çağrı
// try/catch içindedir — eksikse sessizce hiçbir şey yapmaz, uygulama çökmez.
// Gerçek rotasyon yeni build ile devreye girer; o zamana kadar modaldaki
// "Yatay" butonu (yazılımsal 90° döndürme) devrede kalır.

// Native modül KAYITLI MI? Bunu ÖNCE sormak şart: paketi require etmek bile
// eski build'de "Cannot find native module 'ExpoScreenOrientation'" hatasını
// fırlatıyor (28.07 canlı çökme — try/catch yetmedi, hata modülün kendi
// içindeki bir promise'ten geldiği için yakalanamadı).
function nativeKayitliMi() {
  try {
    const g = globalThis
    return !!(
      g?.expo?.modules?.ExpoScreenOrientation ||
      g?.ExpoModules?.ExpoScreenOrientation ||
      g?.__turboModuleProxy?.('ExpoScreenOrientation')
    )
  } catch {
    return false
  }
}

let _modul
function modulAl() {
  if (_modul !== undefined) return _modul
  if (!nativeKayitliMi()) { _modul = null; return null }
  try {
    _modul = require('expo-screen-orientation')
  } catch {
    _modul = null   // native taraf yok (eski build) — sessiz geç
  }
  return _modul
}

// Cihaz gerçekten dönebiliyor mu? (yeni build + native modül var)
export function ekranDondurulebilir() {
  return !!modulAl()
}

// Uygulama genelinde dikey kilit — App.js açılışta bir kez çağırır
export async function dikeyKilitle() {
  const m = modulAl()
  if (!m) return
  try {
    await m.lockAsync(m.OrientationLock.PORTRAIT_UP)
  } catch { /* yok say */ }
}

// Çizim modalı açıldı — yatay serbest
export async function cizimYatayAc() {
  const m = modulAl()
  if (!m) return
  try {
    await m.unlockAsync()
  } catch { /* yok say */ }
}

// Çizim modalı kapandı — dikeye dön
export async function cizimYatayKapat() {
  const m = modulAl()
  if (!m) return
  try {
    await m.lockAsync(m.OrientationLock.PORTRAIT_UP)
  } catch { /* yok say */ }
}
