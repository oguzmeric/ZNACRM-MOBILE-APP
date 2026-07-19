// Keşif raporu PDF üret + paylaş — bilgiler + malzeme + krokiler + fotoğraflar.
// Görseller base64 gömülür (print anında internet gerekmesin); expo-print → expo-sharing.
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system/legacy'
import { Alert, Platform } from 'react-native'
import { krokiSembolBilgi, kesifFotoEtiketBilgi, KESIF_TURLERI, KESIF_ONCELIKLERI, KESIF_DURUMLARI } from '../services/kesifService'

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const trTarih = (t) => (t ? String(t).slice(0, 10).split('-').reverse().join('.') : '—')

// Signed URL → data:image base64 (indir, oku, sil)
const url2base64 = async (url) => {
  if (!url) return null
  try {
    const hedef = `${FileSystem.cacheDirectory}kp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.img`
    const { uri } = await FileSystem.downloadAsync(url, hedef)
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })
    FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})
    return `data:image/*;base64,${b64}`
  } catch { return null }
}

export async function kesifPdfUretVePaylas({ kesif, kalemler = [], krokiler = [], fotolar = [], fotoUrls = {} }) {
  try {
    // Görselleri paralel base64'e çevir
    const [krokiB64, fotoB64] = await Promise.all([
      Promise.all(krokiler.map(k => url2base64(fotoUrls[k.gorselYolu]))),
      Promise.all(fotolar.map(f => url2base64(fotoUrls[f.cizimYolu] || fotoUrls[f.dosyaYolu]))),
    ])

    const oncelikAd = KESIF_ONCELIKLERI.find(o => o.id === (kesif.oncelik || 'normal'))?.ad
    const durumAd = KESIF_DURUMLARI.find(d => d.id === kesif.durum)?.ad
    const bilgi = [
      ['Müşteri', kesif.firmaAdi], ['Proje', kesif.projeAdi], ['Keşif Adresi', kesif.lokasyon],
      ['Müşteri Yetkilisi', kesif.musteriYetkilisi], ['Yetkili Telefon', kesif.yetkiliTelefon],
      ['Yetkili E-posta', kesif.yetkiliEmail], ['İlgili Satış Personeli', kesif.satisPersoneli],
      ['Keşfi Yapan', kesif.kesfiYapan], ['Keşif Tarihi', kesif.kesifTarihi ? trTarih(kesif.kesifTarihi) : ''],
      ['Tahmini Proje Tarihi', kesif.tahminiProjeTarihi ? trTarih(kesif.tahminiProjeTarihi) : ''],
      ['Öncelik', oncelikAd], ['Durum', durumAd],
    ].filter(([, v]) => v)
    const turBlok = (kesif.turler || []).map(tid => {
      const t = KESIF_TURLERI.find(x => x.id === tid)
      const detay = (kesif.teknikDetaylar || {})[tid]
      return `<div class="tur"><b>${esc(t?.ad || tid)}</b>${detay ? `<div class="mut">${esc(detay)}</div>` : ''}</div>`
    }).join('')

    const kalemSatir = kalemler.map(k =>
      `<tr><td>${esc(k.urunAdi)}${k.marka ? ` <i>(${esc(k.marka)})</i>` : ''}</td><td class="sag">${esc(k.miktar)} ${esc(k.birim)}</td><td>${esc(k.notlar || '')}</td></tr>`
    ).join('')

    const krokiBlok = krokiler.map((k, i) => {
      if (!krokiB64[i]) return ''
      const semboller = (k.veri?.sekiller || []).filter(s => s.tip === 'sembol')
      const lejant = semboller.map(s => {
        const b = krokiSembolBilgi(s.sembol)
        const kalem = s.kalemId ? kalemler.find(x => String(x.id) === String(s.kalemId)) : null
        return `<span class="lj"><b style="background:${b.renk}">${b.kod}${s.no}</b>${esc(b.ad)}${kalem ? ` → ${esc(kalem.urunAdi)}` : ''}</span>`
      }).join('')
      return `<div class="blk"><b>${esc(k.baslik)}</b><img src="${krokiB64[i]}">${lejant ? `<div class="ljs">${lejant}</div>` : ''}</div>`
    }).join('')

    const fotoBlok = fotolar.map((f, i) => {
      if (!fotoB64[i]) return ''
      const alt = [
        f.aciklama && esc(f.aciklama),
        f.montajNotu && `Montaj: ${esc(f.montajNotu)}`,
        [f.mahal, f.katBolum].filter(Boolean).length && `Yer: ${esc([f.mahal, f.katBolum].filter(Boolean).join(' / '))}`,
        kesifFotoEtiketBilgi(f.etiket) && `Etiket: ${esc(kesifFotoEtiketBilgi(f.etiket).ad)}`,
      ].filter(Boolean).join(' · ')
      return `<div class="foto"><img src="${fotoB64[i]}"><div class="fm"><b>${esc(f.baslik || 'Fotoğraf')}</b>${f.cizimYolu ? ' <span class="ciz">✏ çizimli</span>' : ''}${alt ? `<div>${alt}</div>` : ''}</div></div>`
    }).join('')

    const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8">
<style>
  *{box-sizing:border-box;margin:0}
  body{font:12px/1.5 -apple-system,system-ui,sans-serif;color:#111;padding:22px}
  .antet{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #014486;padding-bottom:10px;margin-bottom:4px}
  .marka{font-size:19px;font-weight:800;color:#014486;letter-spacing:.5px}
  .marka small{display:block;font-size:9px;font-weight:600;color:#555;letter-spacing:2px}
  .rt{text-align:right;font-size:11px;color:#555}.rt b{display:block;font-size:14px;color:#111}
  h1{font-size:16px;margin:12px 0 1px}
  h2{font-size:13px;margin:16px 0 6px;border-bottom:2px solid #014486;padding-bottom:3px;color:#014486}
  .mut{color:#555}
  .bilgi{display:grid;grid-template-columns:1fr 1fr;gap:3px 20px;margin-top:8px}
  .bilgi>div{border-bottom:1px dotted #ddd;padding-bottom:2px}
  .metin{white-space:pre-wrap;padding:8px 10px;background:#f7f9fb;border:1px solid #e5e9ef;border-radius:5px}
  .tur{margin-bottom:5px}
  table{width:100%;border-collapse:collapse;margin-top:4px}
  th,td{border:1px solid #bbb;padding:5px 7px;text-align:left;vertical-align:top}
  th{background:#eef3f8;font-size:11px}.sag{text-align:right;white-space:nowrap}
  .blk{break-inside:avoid;margin-bottom:12px}
  .blk img,.foto img{width:100%;max-height:430px;object-fit:contain;border:1px solid #ccc;border-radius:6px;margin-top:4px;background:#fff}
  .ljs{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:5px;font-size:11px}
  .lj{display:inline-flex;align-items:center;gap:5px}
  .lj b{color:#fff;font-size:9px;padding:2px 6px;border-radius:9px}
  .fgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .foto{border:1px solid #ccc;border-radius:6px;overflow:hidden;break-inside:avoid}
  .foto img{border:0;border-radius:0;margin:0;max-height:280px}
  .fm{padding:6px 8px;font-size:11px}.ciz{color:#16a34a;font-weight:700}
  .imza{display:flex;justify-content:space-between;gap:40px;margin-top:38px;break-inside:avoid}
  .imza>div{flex:1;border-top:1px solid #333;padding-top:5px;font-size:11px;color:#555;text-align:center}
  .foot{margin-top:22px;padding-top:8px;border-top:1px solid #ddd;font-size:10px;color:#888;text-align:center}
</style></head><body>
<div class="antet">
  <div class="marka">ZNA TEKNOLOJİ<small>SAHA KEŞİF RAPORU</small></div>
  <div class="rt"><b>${esc(kesif.kesifNo || '')}</b>${kesif.kesifTarihi ? `Keşif: ${esc(trTarih(kesif.kesifTarihi))}` : ''}</div>
</div>
<h1>${esc(kesif.kesifBasligi || kesif.firmaAdi || 'Keşif')}</h1>
<h2>Müşteri ve Proje Bilgileri</h2>
<div class="bilgi">${bilgi.map(([a, v]) => `<div><b>${esc(a)}:</b> ${esc(v)}</div>`).join('')}</div>
${turBlok ? `<h2>Keşif Türleri ve Teknik Detaylar</h2>${turBlok}` : ''}
${kesif.genelNot ? `<h2>Keşif Açıklaması</h2><div class="metin">${esc(kesif.genelNot)}</div>` : ''}
${kesif.ozelTalepler ? `<h2>Müşteri Özel Talepleri</h2><div class="metin">${esc(kesif.ozelTalepler)}</div>` : ''}
${kesif.mevcutSistem ? `<h2>Mevcut Sistem Bilgisi</h2><div class="metin">${esc(kesif.mevcutSistem)}</div>` : ''}
${kalemler.length ? `<h2>Malzeme Listesi (${kalemler.length})</h2><table><tr><th>Ürün</th><th>Miktar</th><th>Not</th></tr>${kalemSatir}</table>` : ''}
${krokiBlok ? `<h2>Krokiler (${krokiler.length})</h2>${krokiBlok}` : ''}
${fotoBlok ? `<h2>Fotoğraflar (${fotolar.length})</h2><div class="fgrid">${fotoBlok}</div>` : ''}
<div class="imza">
  <div>Keşfi Yapan${kesif.kesfiYapan ? `<br><b style="color:#111">${esc(kesif.kesfiYapan)}</b>` : ''}</div>
  <div>Müşteri Yetkilisi${kesif.musteriYetkilisi ? `<br><b style="color:#111">${esc(kesif.musteriYetkilisi)}</b>` : ''}</div>
</div>
<div class="foot">Bu rapor ZNA Teknoloji CRM sistemi üzerinden oluşturulmuştur.</div>
</body></html>`

    const { uri } = await Print.printToFileAsync({ html, base64: false, width: 595, height: 842 })

    // Anlamlı dosya adı
    const ad = `${String(kesif.kesifNo || 'kesif').replace(/[^\w-]+/g, '')}-ZNA.pdf`
    const yeniUri = `${FileSystem.cacheDirectory}${ad}`
    try {
      await FileSystem.deleteAsync(yeniUri, { idempotent: true })
      await FileSystem.copyAsync({ from: uri, to: yeniUri })
    } catch { /* kopyalama başarısızsa orijinal uri paylaşılır */ }
    const paylasUri = (await FileSystem.getInfoAsync(yeniUri)).exists ? yeniUri : uri

    if (Platform.OS === 'web') { Alert.alert('PDF', 'PDF oluşturuldu.'); return { ok: true, uri: paylasUri } }
    if (!(await Sharing.isAvailableAsync())) { Alert.alert('Paylaşım', 'Cihazda paylaşım modülü yok.'); return { ok: true, uri: paylasUri } }

    await Sharing.shareAsync(paylasUri, {
      mimeType: 'application/pdf', dialogTitle: 'Keşif Raporunu Paylaş', UTI: 'com.adobe.pdf',
    })
    return { ok: true, uri: paylasUri }
  } catch (err) {
    console.error('[kesifPdf] hata:', err)
    Alert.alert('PDF oluşturulamadı', String(err?.message ?? err))
    return { ok: false, hata: err }
  }
}
