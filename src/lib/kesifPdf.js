// Keşif raporu PDF üret + paylaş — bilgiler + malzeme + krokiler + fotoğraflar.
// Görseller base64 gömülür (print anında internet gerekmesin); expo-print → expo-sharing.
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system/legacy'
import { Alert, Platform } from 'react-native'
import {
  krokiSembolBilgi, kesifFotoEtiketBilgi, KESIF_TURLERI, KESIF_ONCELIKLERI, KESIF_DURUMLARI,
  KROKI_KATEGORILER, KROKI_SEMBOLLERI, sembolleriSay,
} from '../services/kesifService'
import { ZNA_LOGO_B64 } from './znaLogo'

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

// Rapor HTML üreticisi — hem WebView önizleme hem PDF için (görseller base64 gömülü)
export async function kesifRaporHtml({ kesif, kalemler = [], krokiler = [], fotolar = [], fotoUrls = {} }) {
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
      // Fotoya yerleştirilen semboller — kroki gibi lejant
      const fLejant = (f.cizimVeri?.sekiller || []).filter(s => s.tip === 'sembol').map(s => {
        const b = krokiSembolBilgi(s.sembol)
        return `<span class="lj"><b style="background:${b.renk}">${b.kod}${s.no}</b>${esc(b.ad)}</span>`
      }).join('')
      return `<div class="foto"><img src="${fotoB64[i]}"><div class="fm"><b>${esc(f.baslik || 'Fotoğraf')}</b>${f.cizimYolu ? ' <span class="ciz">✏ çizimli</span>' : ''}${alt ? `<div>${alt}</div>` : ''}${fLejant ? `<div class="ljs">${fLejant}</div>` : ''}</div></div>`
    }).join('')

    // Sembol Özeti — kroki + foto ikonları kaynak bazlı + genel toplam (web raporuyla aynı)
    const sSay = (sk) => {
      const m = new Map()
      for (const s of (sk || [])) if (s.tip === 'sembol' && s.sembol) m.set(s.sembol, (m.get(s.sembol) || 0) + 1)
      return m
    }
    const sListe = (m) => KROKI_SEMBOLLERI.filter(s => m.has(s.id)).map(s => ({ ...s, adet: m.get(s.id) }))
    const sKaynak = []
    krokiler.forEach((k, i) => {
      const m = sSay(k.veri?.sekiller)
      if (m.size) sKaynak.push({ baslik: `Kroki — ${k.baslik || `Kroki ${i + 1}`}`, semboller: sListe(m), toplam: [...m.values()].reduce((a, b) => a + b, 0) })
    })
    fotolar.forEach((f, i) => {
      const m = sSay(f.cizimVeri?.sekiller)
      if (m.size) sKaynak.push({ baslik: `Foto — ${f.baslik || f.mahal || `Fotoğraf ${i + 1}`}`, semboller: sListe(m), toplam: [...m.values()].reduce((a, b) => a + b, 0) })
    })
    const sToplamM = sembolleriSay(krokiler, fotolar)
    const sToplam = [...sToplamM.values()].reduce((a, b) => a + b, 0)
    const katAd = (id) => KROKI_KATEGORILER.find(x => x.id === id)?.ad || ''
    const sembolOzetBlok = sToplam ? `<h2>SEMBOL ÖZETİ — KROKİ + FOTOĞRAF (${sToplam} ADET)</h2><table><tr><th>Konum</th><th>Ürün</th><th>Sistem</th><th>Adet</th></tr>${
      sKaynak.map(ka =>
        `<tr><td rowspan="${ka.semboller.length}"><b>${esc(ka.baslik)}</b><div class="mut">${ka.toplam} adet</div></td><td>${esc(ka.semboller[0].ad)}</td><td>${esc(katAd(ka.semboller[0].kategori))}</td><td class="sag">${ka.semboller[0].adet}</td></tr>` +
        ka.semboller.slice(1).map(s => `<tr><td>${esc(s.ad)}</td><td>${esc(katAd(s.kategori))}</td><td class="sag">${s.adet}</td></tr>`).join('')
      ).join('')
    }<tr><td colspan="4" style="background:#eef3f8;font-weight:800;color:#014486">GENEL TOPLAM · ${sToplam} ADET</td></tr>${
      sListe(sToplamM).map(s => `<tr><td></td><td>${esc(s.ad)}</td><td>${esc(katAd(s.kategori))}</td><td class="sag"><b>${s.adet}</b></td></tr>`).join('')
    }</table>` : ''

    const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=794">
<style>
  *{box-sizing:border-box;margin:0}
  body{font:12px/1.55 -apple-system,system-ui,sans-serif;color:#1a2332;padding:22px 24px}
  .antet{display:flex;align-items:center;gap:12px;border-bottom:3px solid #014486;padding-bottom:11px}
  .antet img{height:42px;width:auto}
  .marka{flex:1}.marka b{display:block;font-size:17px;font-weight:800;color:#014486;letter-spacing:.3px}
  .marka span{font-size:10px;font-weight:700;color:#64748b;letter-spacing:2.5px}
  .rt{text-align:right;font-size:10.5px;color:#64748b}.rt b{display:block;font-size:14px;color:#1a2332;font-weight:800}
  h1{font-size:15px;margin:13px 0 1px;color:#1a2332}
  .alt{color:#64748b;font-size:11px}
  h2{font-size:12px;margin:16px 0 7px;padding:5px 9px;background:#eef3f8;border-left:4px solid #014486;color:#014486;font-weight:800}
  .mut{color:#64748b}
  .bilgi{display:grid;grid-template-columns:1fr 1fr;gap:4px 20px}
  .bilgi>div{border-bottom:1px dotted #dbe2ea;padding:2px 0;font-size:11px}
  .bilgi b{color:#475569}
  .metin{white-space:pre-wrap;padding:9px 11px;background:#f8fafc;border:1px solid #e5e9ef;border-radius:6px;font-size:11px}
  .tur{margin-bottom:5px;font-size:11px}
  table{width:100%;border-collapse:collapse;margin-top:2px;font-size:11px}
  th,td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left;vertical-align:top}
  th{background:#eef3f8;color:#334155;font-weight:700}.sag{text-align:right;white-space:nowrap}
  .blk{margin-bottom:13px;break-inside:avoid;page-break-inside:avoid}
  .blk>b{font-size:12px}
  .blk img{width:100%;max-height:400px;object-fit:contain;border:1px solid #d5dde6;border-radius:7px;margin-top:4px;background:#fff}
  .ljs{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:5px;font-size:10.5px}
  .lj{display:inline-flex;align-items:center;gap:5px}.lj b{color:#fff;font-size:9px;padding:2px 6px;border-radius:9px}
  .fgrid{margin-top:2px}
  .foto{display:inline-block;width:49%;vertical-align:top;margin:0 0 10px;border:1px solid #d5dde6;border-radius:7px;overflow:hidden;break-inside:avoid;page-break-inside:avoid}
  .foto:nth-child(odd){margin-right:1.4%}
  .foto img{width:100%;max-height:210px;object-fit:contain;background:#f6f8fb;display:block}
  .fm{padding:6px 8px;font-size:10.5px}.fm b{font-size:11px}.ciz{color:#16a34a;font-weight:700}
  .imza{display:flex;justify-content:space-between;gap:48px;margin-top:40px;break-inside:avoid;page-break-inside:avoid}
  .imza>div{flex:1;border-top:1.5px solid #334155;padding-top:6px;font-size:11px;color:#64748b;text-align:center}
  .foot{margin-top:20px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8;text-align:center;line-height:1.5}
  .foot b{color:#014486}
  .sheet{width:100%;border-collapse:collapse}
  .sheet>thead>tr>td,.sheet>tbody>tr>td,.sheet>tfoot>tr>td{padding:0;border:none;vertical-align:top}
  .top-space{height:0}
  @media print{
    @page{margin:0}
    body{padding:0}
    /* Antetli kağıt: kenar boşlukları tablo yapısından; üst boşluk (thead) + footer (tfoot) HER sayfada tekrarlar */
    .sheet>tbody>tr>td{padding:0 12mm}
    .top-space{height:12mm}
    .foot{margin-top:0;padding:4mm 12mm 6mm;background:#fff}
  }
</style></head><body>
<table class="sheet">
<thead><tr><td><div class="top-space"></div></td></tr></thead>
<tbody><tr><td>
<div class="antet">
  <img src="${ZNA_LOGO_B64}" alt="ZNA">
  <div class="marka"><b>ZNA TEKNOLOJİ</b><span>SAHA KEŞİF RAPORU</span></div>
  <div class="rt"><b>${esc(kesif.kesifNo || '')}</b>${kesif.kesifTarihi ? `Keşif: ${esc(trTarih(kesif.kesifTarihi))}` : ''}</div>
</div>
<h1>${esc(kesif.kesifBasligi || kesif.firmaAdi || 'Keşif')}</h1>
${kesif.kesifBasligi && kesif.firmaAdi ? `<div class="alt">${esc(kesif.firmaAdi)}</div>` : ''}
<h2>MÜŞTERİ VE PROJE BİLGİLERİ</h2>
<div class="bilgi">${bilgi.map(([a, v]) => `<div><b>${esc(a)}:</b> ${esc(v)}</div>`).join('')}</div>
${turBlok ? `<h2>KEŞİF TÜRLERİ VE TEKNİK DETAYLAR</h2>${turBlok}` : ''}
${kesif.genelNot ? `<h2>KEŞİF AÇIKLAMASI</h2><div class="metin">${esc(kesif.genelNot)}</div>` : ''}
${kesif.ozelTalepler ? `<h2>MÜŞTERİ ÖZEL TALEPLERİ</h2><div class="metin">${esc(kesif.ozelTalepler)}</div>` : ''}
${kesif.mevcutSistem ? `<h2>MEVCUT SİSTEM BİLGİSİ</h2><div class="metin">${esc(kesif.mevcutSistem)}</div>` : ''}
${kalemler.length ? `<h2>MALZEME LİSTESİ (${kalemler.length})</h2><table><tr><th>Ürün</th><th>Miktar</th><th>Not</th></tr>${kalemSatir}</table>` : ''}
${sembolOzetBlok}
${krokiBlok ? `<h2>KROKİLER (${krokiler.length})</h2>${krokiBlok}` : ''}
${fotoBlok ? `<h2>FOTOĞRAFLAR (${fotolar.length})</h2><div class="fgrid">${fotoBlok}</div>` : ''}
<div class="imza">
  <div>Keşfi Yapan${kesif.kesfiYapan ? `<br><b style="color:#1a2332">${esc(kesif.kesfiYapan)}</b>` : ''}</div>
  <div>Müşteri Yetkilisi${kesif.musteriYetkilisi ? `<br><b style="color:#1a2332">${esc(kesif.musteriYetkilisi)}</b>` : ''}</div>
</div>
</td></tr></tbody>
<tfoot><tr><td>
<div class="foot"><b>ZNA TEKNOLOJİ BİLİŞİM HİZ. SAN. VE TİC. LTD. ŞTİ.</b> · znateknoloji.com<br>Bu rapor ZNA Teknoloji CRM sistemi üzerinden oluşturulmuştur.</div>
</td></tr></tfoot>
</table>
</body></html>`
    return html
}

// Hazır HTML'i PDF'e çevir + cihaz paylaş menüsü (önizleme modalı bu HTML'i verir)
export async function htmlPdfPaylas(html, kesif) {
  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false, width: 595, height: 842 })
    const ad = `${String(kesif?.kesifNo || 'kesif').replace(/[^\w-]+/g, '')}-ZNA.pdf`
    const yeniUri = `${FileSystem.cacheDirectory}${ad}`
    try {
      await FileSystem.deleteAsync(yeniUri, { idempotent: true })
      await FileSystem.copyAsync({ from: uri, to: yeniUri })
    } catch { /* orijinal uri kullanılır */ }
    const paylasUri = (await FileSystem.getInfoAsync(yeniUri)).exists ? yeniUri : uri
    if (Platform.OS === 'web') { Alert.alert('PDF', 'PDF oluşturuldu.'); return { ok: true, uri: paylasUri } }
    if (!(await Sharing.isAvailableAsync())) { Alert.alert('Paylaşım', 'Cihazda paylaşım modülü yok.'); return { ok: true, uri: paylasUri } }
    await Sharing.shareAsync(paylasUri, {
      mimeType: 'application/pdf', dialogTitle: 'Keşif Raporunu Paylaş', UTI: 'com.adobe.pdf',
    })
    return { ok: true, uri: paylasUri }
  } catch (err) {
    console.error('[kesifPdf] paylaş hata:', err)
    Alert.alert('PDF oluşturulamadı', String(err?.message ?? err))
    return { ok: false, hata: err }
  }
}

// Geriye uyumlu: HTML üret + doğrudan paylaş (önizleme kullanmayan çağrı)
export async function kesifPdfUretVePaylas(params) {
  try {
    const html = await kesifRaporHtml(params)
    return await htmlPdfPaylas(html, params.kesif)
  } catch (err) {
    console.error('[kesifPdf] hata:', err)
    Alert.alert('PDF oluşturulamadı', String(err?.message ?? err))
    return { ok: false, hata: err }
  }
}
