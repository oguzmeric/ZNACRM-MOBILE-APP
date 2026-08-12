// Servis faturası kalem hesabı — TEK kaynak.
//
// ⚠️ Web'deki src/lib/teklifHesap.js ile AYNI kuralları izler; ikisi ayrı
// repoda olduğu için kod paylaşılamıyor, ama kurallar birebir aynı olmalı:
//   • Her adım kuruşa yuvarlanır (r2) — brüt → iskonto → net → KDV
//   • KDV, oran grubunun YUVARLANMIŞ matrahından hesaplanır; satır satır
//     yuvarlanmış KDV'leri toplamak kuruş kırıntısı biriktirir ve belge
//     kendi içinde tutmaz (web tarafında TEK-0672 vakası).
//   • toLocaleString'de maximumFractionDigits yazılmazsa Intl 3 ondalık basar.
//
// Kural değişirse İKİ dosya birden güncellenmeli.

export const sayi = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v ?? '').trim()
  if (!s) return 0
  // TR giriş: "1.250,50" / "1250,50" / "1250.50"
  const n = parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s)
  return Number.isFinite(n) ? n : 0
}

export const r2 = (n) => Math.round((sayi(n) + Number.EPSILON) * 100) / 100

// KDV oranı: null/undefined/'' → 20, açık 0 → 0 (0'ı %20'ye çevirmek yasak)
const kdvOraniCoz = (v) => (v === null || v === undefined || v === '' ? 20 : sayi(v))

export const satirHesapla = (s) => {
  const miktar = sayi(s?.miktar)
  const birimFiyat = sayi(s?.birimFiyat)
  const net = r2(miktar * birimFiyat)
  const kdvOran = kdvOraniCoz(s?.kdvOran)
  const kdvTutar = r2(net * (kdvOran / 100))
  return { miktar, birimFiyat, net, kdvOran, kdvTutar, toplam: r2(net + kdvTutar) }
}

export const faturaHesapla = (kalemler) => {
  const satirlar = (kalemler || []).map(satirHesapla)
  const araToplam = r2(satirlar.reduce((t, s) => t + s.net, 0))

  // KDV oran grubunun yuvarlanmış matrahından — bkz. yukarıdaki kural
  const matrah = {}
  for (const s of satirlar) matrah[s.kdvOran] = (matrah[s.kdvOran] || 0) + s.net
  const kdvKirilimi = {}
  for (const [oran, tutar] of Object.entries(matrah)) {
    kdvKirilimi[oran] = r2(r2(tutar) * (Number(oran) / 100))
  }
  const kdvToplam = r2(Object.values(kdvKirilimi).reduce((a, b) => a + b, 0))

  return {
    satirlar,
    araToplam,
    kdvKirilimi,
    kdvToplam,
    genelToplam: r2(araToplam + kdvToplam),
    fiyatsizSatir: satirlar.filter((s) => s.net <= 0).length,
  }
}

export const tutarMetni = (n) =>
  sayi(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const paraMetni = (n) => `₺${tutarMetni(n)}`

/** fatura_talepleri.kalemler jsonb şeması — web ile aynı alan adları */
export const kalemPayload = (k) => {
  const h = satirHesapla(k)
  return {
    stokKodu: k.stokKodu || '',
    urunAdi: k.urunAdi || '',
    aciklama: k.aciklama || '',
    miktar: h.miktar,
    birim: k.birim || 'Adet',
    birimFiyat: h.birimFiyat,
    iskontoOran: 0,
    kdvOran: h.kdvOran,
    araToplam: h.net,
    kdvTutar: h.kdvTutar,
    satirToplam: h.toplam,
  }
}
