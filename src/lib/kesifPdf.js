// Keşif raporu PDF üret + paylaş — bilgiler + malzeme + krokiler + fotoğraflar.
// Görseller base64 gömülür (print anında internet gerekmesin); expo-print → expo-sharing.
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system/legacy'
import { Alert, Platform } from 'react-native'
import { krokiSembolBilgi, kesifFotoEtiketBilgi } from '../services/kesifService'

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

    const bilgi = [
      ['Müşteri', kesif.firmaAdi], ['Proje', kesif.projeAdi], ['Adres', kesif.lokasyon],
      ['Yetkili', [kesif.musteriYetkilisi, kesif.yetkiliTelefon].filter(Boolean).join(' · ')],
      ['Keşif Tarihi', kesif.kesifTarihi ? trTarih(kesif.kesifTarihi) : ''], ['Keşfi Yapan', kesif.kesfiYapan],
    ].filter(([, v]) => v)

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
  h1{font-size:18px}h2{font-size:14px;margin:18px 0 6px;border-bottom:2px solid #111;padding-bottom:3px}
  .mut{color:#555}
  .bilgi{display:grid;grid-template-columns:1fr 1fr;gap:2px 20px;margin-top:8px}
  table{width:100%;border-collapse:collapse;margin-top:4px}
  th,td{border:1px solid #bbb;padding:5px 7px;text-align:left;vertical-align:top}
  th{background:#f1f1f1;font-size:11px}.sag{text-align:right;white-space:nowrap}
  .blk{break-inside:avoid;margin-bottom:12px}
  .blk img,.foto img{width:100%;max-height:430px;object-fit:contain;border:1px solid #ccc;border-radius:6px;margin-top:4px;background:#fff}
  .ljs{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:5px;font-size:11px}
  .lj{display:inline-flex;align-items:center;gap:5px}
  .lj b{color:#fff;font-size:9px;padding:2px 6px;border-radius:9px}
  .fgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .foto{border:1px solid #ccc;border-radius:6px;overflow:hidden;break-inside:avoid}
  .foto img{border:0;border-radius:0;margin:0;max-height:280px}
  .fm{padding:6px 8px;font-size:11px}.ciz{color:#16a34a;font-weight:700}
</style></head><body>
<h1>${esc(kesif.kesifNo || 'Keşif Raporu')}</h1>
<div class="mut">${esc(kesif.kesifBasligi || '')}</div>
<div class="bilgi">${bilgi.map(([a, v]) => `<div><b>${esc(a)}:</b> ${esc(v)}</div>`).join('')}</div>
${kesif.genelNot ? `<h2>Açıklama</h2><div>${esc(kesif.genelNot)}</div>` : ''}
${kalemler.length ? `<h2>Malzeme Listesi (${kalemler.length})</h2><table><tr><th>Ürün</th><th>Miktar</th><th>Not</th></tr>${kalemSatir}</table>` : ''}
${krokiBlok ? `<h2>Krokiler (${krokiler.length})</h2>${krokiBlok}` : ''}
${fotoBlok ? `<h2>Fotoğraflar (${fotolar.length})</h2><div class="fgrid">${fotoBlok}</div>` : ''}
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
