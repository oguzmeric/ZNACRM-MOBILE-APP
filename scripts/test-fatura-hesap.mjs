// src/lib/faturaHesap.js davranış testleri.
// Çalıştır: node scripts/test-fatura-hesap.mjs
import assert from 'node:assert/strict'
import {
  sayi, r2, satirHesapla, faturaHesapla, tutarMetni, paraMetni, kalemPayload,
} from '../src/lib/faturaHesap.js'

let gecen = 0
const kalan = []
const test = (ad, fn) => {
  try { fn(); gecen++ } catch (e) { kalan.push([ad, e]) }
}

// ─── Sayı çözümleme (sahada TR klavye ile girilecek) ────────────────────────
test('S1 · TR biçimli tutarlar doğru okunur', () => {
  assert.equal(sayi('1.250,50'), 1250.5)
  assert.equal(sayi('1250,50'), 1250.5)
  assert.equal(sayi('1250.50'), 1250.5)
  assert.equal(sayi('1250'), 1250)
  assert.equal(sayi(' 99,90 '), 99.9)
})

test('S2 · boş/bozuk giriş 0 döner — NaN sızmaz', () => {
  for (const g of ['', '  ', null, undefined, 'abc', {}, []]) assert.equal(sayi(g), 0)
})

// ─── Satır hesabı ───────────────────────────────────────────────────────────
test('H1 · net = miktar × birim fiyat, KDV net üzerinden', () => {
  const h = satirHesapla({ miktar: 3, birimFiyat: 100, kdvOran: 20 })
  assert.equal(h.net, 300)
  assert.equal(h.kdvTutar, 60)
  assert.equal(h.toplam, 360)
})

test('H2 · KDV oranı 0 GEÇERLİ — %20\'ye çevrilmez', () => {
  const h = satirHesapla({ miktar: 1, birimFiyat: 100, kdvOran: 0 })
  assert.equal(h.kdvOran, 0)
  assert.equal(h.kdvTutar, 0)
  assert.equal(h.toplam, 100)
})

test('H3 · KDV oranı boşsa %20 varsayılır', () => {
  for (const bos of [null, undefined, '']) {
    assert.equal(satirHesapla({ miktar: 1, birimFiyat: 100, kdvOran: bos }).kdvOran, 20)
  }
})

test('H4 · %18 KDV korunur (canlıda %18\'li teklifler var)', () => {
  const h = satirHesapla({ miktar: 2, birimFiyat: 150, kdvOran: 18 })
  assert.equal(h.net, 300)
  assert.equal(h.kdvTutar, 54)
})

test('H5 · ondalıklı miktar/fiyat kuruşa yuvarlanır', () => {
  const h = satirHesapla({ miktar: 1.5, birimFiyat: 33.33, kdvOran: 20 })
  assert.equal(h.net, 50)       // 49.995 → 50.00
  assert.equal(h.kdvTutar, 10)
})

// ─── Belge toplamı ──────────────────────────────────────────────────────────
test('T1 · ara toplam + KDV = genel toplam (belge içi aritmetik TUTAR)', () => {
  const h = faturaHesapla([
    { miktar: 2, birimFiyat: 1250.5, kdvOran: 20 },
    { miktar: 1, birimFiyat: 899.9, kdvOran: 20 },
  ])
  assert.equal(h.araToplam, 3400.9)
  assert.equal(h.kdvToplam, 680.18)
  assert.equal(h.genelToplam, 4081.08)
  assert.equal(r2(h.araToplam + h.kdvToplam), h.genelToplam)
})

test('T2 · karışık KDV oranları ayrı gruplanır', () => {
  const h = faturaHesapla([
    { miktar: 1, birimFiyat: 1000, kdvOran: 20 },
    { miktar: 1, birimFiyat: 1000, kdvOran: 18 },
    { miktar: 1, birimFiyat: 1000, kdvOran: 0 },
  ])
  assert.equal(h.araToplam, 3000)
  assert.equal(h.kdvKirilimi['20'], 200)
  assert.equal(h.kdvKirilimi['18'], 180)
  assert.equal(h.kdvKirilimi['0'], 0)
  assert.equal(h.kdvToplam, 380)
  assert.equal(h.genelToplam, 3380)
})

// ⚠️ Kritik: KDV oran grubunun yuvarlanmış matrahından hesaplanmalı.
// Satır satır yuvarlanmış KDV'leri toplamak kuruş kırıntısı biriktirir.
test('T3 · KDV grup matrahından — satır satır toplama kuruş kaçırır', () => {
  const kalemler = Array.from({ length: 3 }, () => ({ miktar: 1, birimFiyat: 0.33, kdvOran: 20 }))
  const h = faturaHesapla(kalemler)
  assert.equal(h.araToplam, 0.99)
  assert.equal(h.kdvToplam, 0.2)          // 0.99 × 0.20 = 0.198 → 0.20
  assert.equal(r2(h.araToplam + h.kdvToplam), h.genelToplam)
  // Satır bazlı toplasaydık: her satır 0.066 → 0.07, toplam 0.21 (1 kuruş fazla)
  const satirBazli = r2(h.satirlar.reduce((t, s) => t + s.kdvTutar, 0))
  assert.notEqual(satirBazli, h.kdvToplam)
})

test('T4 · fiyatı girilmemiş satır sayılır (Gönder kapısı bunu kullanır)', () => {
  const h = faturaHesapla([
    { miktar: 1, birimFiyat: 500, kdvOran: 20 },
    { miktar: 1, birimFiyat: 0, kdvOran: 20 },
    { miktar: 2, birimFiyat: '', kdvOran: 20 },
  ])
  assert.equal(h.fiyatsizSatir, 2)
})

test('T5 · boş/bozuk kalem listesi çökmez', () => {
  for (const g of [null, undefined, []]) {
    const h = faturaHesapla(g)
    assert.equal(h.araToplam, 0)
    assert.equal(h.genelToplam, 0)
  }
})

// ─── Biçimleme ──────────────────────────────────────────────────────────────
// ⚠️ maximumFractionDigits yazılmazsa Intl 3 ondalık basar (web'de ₺45.599,983)
test('B1 · tutar HER ZAMAN 2 ondalık', () => {
  // Web'de bu değer "₺45.599,983" basıyordu (maximumFractionDigits eksikti)
  assert.equal(tutarMetni(45599.983), '45.599,98')
  assert.equal(tutarMetni(1250.5), '1.250,50')
  assert.equal(tutarMetni(1000), '1.000,00')
  assert.equal(tutarMetni(0), '0,00')
  assert.equal(paraMetni(1250.5), '₺1.250,50')
})

// ─── DB payload'ı ───────────────────────────────────────────────────────────
test('P1 · kalemPayload web şemasıyla aynı alanları üretir', () => {
  const p = kalemPayload({
    stokKodu: 'STK001', urunAdi: 'Kamera', miktar: '2', birimFiyat: '1.250,50', kdvOran: 20,
  })
  assert.deepEqual(Object.keys(p).sort(), [
    'aciklama', 'araToplam', 'birim', 'birimFiyat', 'iskontoOran',
    'kdvOran', 'kdvTutar', 'miktar', 'satirToplam', 'stokKodu', 'urunAdi',
  ])
  assert.equal(p.araToplam, 2501)
  assert.equal(p.kdvTutar, 500.2)
  assert.equal(p.satirToplam, 3001.2)
  assert.equal(p.birim, 'Adet')
})

test('P2 · payload TR metin girişini sayıya çevirir', () => {
  const p = kalemPayload({ urunAdi: 'İşçilik', miktar: '1', birimFiyat: '2.500,00' })
  assert.equal(p.birimFiyat, 2500)
  assert.equal(p.kdvOran, 20)
})

if (kalan.length) {
  console.error(`\n✗ ${kalan.length} test kaldı (${gecen} geçti):\n`)
  for (const [ad, e] of kalan) console.error(`  • ${ad}\n    ${e.message}\n`)
  process.exit(1)
}
console.log(`✓ ${gecen} test geçti`)
