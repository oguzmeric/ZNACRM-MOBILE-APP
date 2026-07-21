// Servis Formu HTML — web src/pages/servisCikti/ServisFormu.jsx ile BIREBIR ayni
// duzen. expo-print icin HTML string uretir. Cikti her iki platformda da ayni.
//
// talep alanlari (camelCase): firmaAdi, ilgiliKisi, telefon, email, konu, aciklama,
//   cozumAciklamasi, servisTipi/yukumluluk/servisYeri (virgullu string),
//   seriNumarasi, marka, model, kunyeNumarasi, cihazTuru, sube, adres, ilIlce,
//   lokasyon, yedekParcalar[], musteriImza, olusturmaTarihi, talepNo
// bannerBase64: "data:image/png;base64,..." (ZNA servis raporu banner'i)

const SIRKET_BILGI = {
  zna: {
    firmaAdi: 'ZNA TEKNOLOJİ BİLİŞİM HİZMETLERİ SANAYİ VE TİCARET LİMİTED ŞİRKETİ',
    adres: 'İ.O.S.B. KERESTECİLER SANAYİ SİTESİ 3B BLOK KAT:3 NO:3 BAŞAKŞEHİR/İSTANBUL',
    iletisim: 'İLETİŞİM: (212) 549-9494 · FAX: (212) 671-7454',
    accent: '#16365D',
    accentBg: '#DCE6F1',
    bannerYukseklik: 90,
    showText: false,
  },
  anadolunet: {
    firmaAdi: 'ANADOLUNET DİJİTAL YAPI A.Ş.',
    adres: 'İ.O.S.B. KERESTECİLER SANAYİ SİTESİ 3B BLOK KAT:3 NO:3 BAŞAKŞEHİR/İSTANBUL',
    iletisim: 'İLETİŞİM: (212) 549-9494 · FAX: (212) 671-7454',
    accent: '#1A1A1A',
    accentBg: '#F0F0F0',
    bannerYukseklik: 80,
    showText: true, // Anadolunet logosunda 'SERVIS RAPORU' yok — yazi ekle
  },
}

const KUTU_BOS = '☐'
const KUTU_DOLU = '☒'

const escapeHtml = (s) =>
  String(s ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const nl2br = (s) => escapeHtml(s).replaceAll('\n', '<br/>')

function tarihFmt(s) {
  if (!s) return ''
  const d = new Date(s); if (isNaN(d)) return s
  const g = String(d.getDate()).padStart(2, '0')
  const a = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${g}/${a}/${d.getFullYear()} ${hh}:${mm}`
}

// Form profili — web ServisFormu ile ayni form, tum tipler icin
export function formProfiliBelirle() {
  return { tip: 'servis', baslik: 'SERVİS RAPORU' }
}

export function servisFormuHtml({ talep = {}, bannerBase64 = null, fotograflar = [], sirket = 'zna', malzemeler = [] }) {
  const cfg = SIRKET_BILGI[sirket] || SIRKET_BILGI.zna
  const ACCENT = cfg.accent
  const ACCENT_BG = cfg.accentBg
  const BORDER = '#808080'

  const musteri = {
    no: talep.talepNo || talep.id || '—',
    kurum: talep.firmaAdi || talep.musteriAd || '—',
    ilIlce: talep.ilIlce || talep.lokasyon || '—',
    sube: talep.sube || '—',
    adres: talep.adres || '—',
    gsm: talep.telefon || '—',
    email: talep.email || '—',
  }

  const servisTipi = (talep.servisTipi || '').toLowerCase()
  const yukum = (talep.yukumluluk || '').toLowerCase()
  const yer = (talep.servisYeri || '').toLowerCase()
  const k = (str, key) => (str.includes(key) ? KUTU_DOLU : KUTU_BOS)

  const urunTanimi = talep.cihazTuru || talep.urunTanimi || '—'
  const seriNo = talep.seriNumarasi || '—'
  const markaModel = [talep.marka, talep.model].filter(Boolean).join(' / ') || '—'
  const kunye = talep.kunyeNumarasi || talep.servisNo || talep.id || '—'

  const ariza = talep.aciklama || ''
  const yapilan = talep.cozumAciklamasi || ''

  const yedekParcalar = Array.isArray(talep.yedekParcalar) ? talep.yedekParcalar : []
  const bf = (p) => Number(p.birim_fiyat ?? p.birimFiyat ?? 0)
  const genelToplam = yedekParcalar.reduce((s, p) => s + Number(p.tutar ?? 0), 0)

  const imzaMusteri = talep.musteriImza
    ? `<img src="${talep.musteriImza}" style="max-width:100%;max-height:90px;object-fit:contain;display:block;margin:2px 0;" />`
    : '<div style="height:64px;"></div>'

  // Personel imzası — servis kapatılırken kaydedilen snapshot (formu kapatan kişi)
  const imzaPersonel = talep.personelImza
    ? `<img src="${talep.personelImza}" style="max-width:100%;max-height:60px;object-fit:contain;display:block;margin:2px 0;" />`
    : '<div style="height:50px;"></div>'
  const personelAd = talep.personelImzaAd || talep.atananKullaniciAd || 'ZNA TEKNOLOJİ'

  // ── Stil tokenleri (web ile ayni) ──
  const cell = `border:1px dashed ${BORDER};padding:3px 6px;vertical-align:top;`
  const label = `${cell}font-weight:700;color:${ACCENT};width:110px;background:#fff;`
  const value = `${cell}color:${ACCENT};`
  const secHead = `background:${ACCENT_BG};color:${ACCENT};font-weight:800;font-size:10px;padding:4px 8px;text-align:left;letter-spacing:0.3px;`
  const tablo = `width:100%;border-collapse:collapse;border:1px dashed ${BORDER};margin-bottom:6px;`

  const parcaSatirlari = yedekParcalar.length > 0
    ? yedekParcalar.map((p, i) => `
      <tr>
        <td style="${cell}text-align:center;">${i + 1}</td>
        <td style="${cell}">${escapeHtml(p.aciklama ?? '')}</td>
        <td style="${cell}text-align:right;">${bf(p).toFixed(2)} ₺</td>
        <td style="${cell}text-align:right;">${Number(p.miktar ?? 0)}</td>
        <td style="${cell}text-align:right;">${Number(p.tutar ?? 0).toFixed(2)} ₺</td>
      </tr>`).join('')
    : [0, 1, 2].map(() => `<tr><td colspan="5" style="${cell}height:22px;">&nbsp;</td></tr>`).join('')

  const fotoSayfasi = Array.isArray(fotograflar) && fotograflar.length > 0 ? `
    <div class="foto-sayfa">
      <div class="foto-baslik">📷 SERVİS FOTOĞRAFLARI</div>
      <div class="foto-grid">${fotograflar.map((f, i) => `
        <div class="foto-item"><img src="${f.url}" />
          <div class="foto-alt">${escapeHtml(f.ad ?? 'Fotoğraf ' + (i + 1))}</div>
        </div>`).join('')}
      </div>
    </div>` : ''

  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=794, user-scalable=yes, maximum-scale=3" />
<style>
  @page { size: A4 portrait; margin: 6mm; }
  * { box-sizing: border-box; }
  body { font-family: "Microsoft Sans Serif", Arial, sans-serif; color:#000; margin:0; padding:0; font-size:9px; line-height:1.35; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .sayfa { padding:2mm 2mm; }
  .banner-wrap { text-align:center; margin-bottom:8px; }
  .banner-wrap img { max-width:100%; height:${cfg.bannerYukseklik || 90}px; object-fit:contain; }
  .banner-text { font-size:18px; font-weight:800; color:${ACCENT}; letter-spacing:2px; margin-top:4px; }
  table.f { ${tablo} }
  .sec { ${secHead} }
  .kutu-satir span { margin-right:14px; }
  .foto-sayfa { page-break-before: always; padding-top:4mm; }
  .foto-baslik { font-size:13px; font-weight:800; color:${ACCENT}; margin-bottom:10px; padding-bottom:6px; border-bottom:2px solid ${ACCENT}; }
  .foto-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .foto-item { border:1px solid #cbd5e1; border-radius:6px; overflow:hidden; page-break-inside:avoid; }
  .foto-item img { width:100%; height:180px; object-fit:cover; display:block; background:#f1f5f9; }
  .foto-alt { font-size:9px; color:#64748b; padding:4px 6px; border-top:1px solid #e2e8f0; }
</style></head><body>
  <div class="sayfa">
    <div class="banner-wrap">
      ${bannerBase64 ? `<img src="${bannerBase64}" alt="${escapeHtml(cfg.firmaAdi)}" />` : ''}
      ${cfg.showText ? '<div class="banner-text">SERVİS RAPORU</div>' : ''}
      ${!bannerBase64 && !cfg.showText ? '<div class="banner-text">SERVİS RAPORU</div>' : ''}
    </div>

    <!-- MÜŞTERİ BİLGİLERİ -->
    <table class="f"><tbody>
      <tr><td colspan="4" class="sec"><div style="display:flex;justify-content:space-between;"><span>MÜŞTERİ BİLGİLERİ</span><span style="font-size:9px;">${escapeHtml(musteri.no)}</span></div></td></tr>
      <tr><td style="${label}">Kurum/Kuruluş</td><td style="${value}" colspan="3">${escapeHtml(musteri.kurum)}</td></tr>
      <tr><td style="${label}">İl/İlçe</td><td style="${value}">${escapeHtml(musteri.ilIlce)}</td><td style="${label}">Şube</td><td style="${value}">${escapeHtml(musteri.sube)}</td></tr>
      <tr><td style="${label}">Adres</td><td style="${value}" colspan="3">${escapeHtml(musteri.adres)}</td></tr>
      <tr><td style="${label}">Gsm</td><td style="${value}">${escapeHtml(musteri.gsm)}</td><td style="${label}">E-mail</td><td style="${value}">${escapeHtml(musteri.email)}</td></tr>
      <tr><td style="${label}">Servis Tipi</td><td style="${value}" colspan="3" class="kutu-satir">
        <span>${k(servisTipi, 'ariza')} Arıza Tespiti</span><span>${k(servisTipi, 'bakim')} Bakım</span><span>${k(servisTipi, 'urun')} Ürün Alımı</span><span>${k(servisTipi, 'kurulum')} Kurulum</span><span>${k(servisTipi, 'teslimat')} Teslimat</span>
      </td></tr>
      <tr><td style="${label}">Yükümlülük</td><td style="${value}" colspan="3" class="kutu-satir">
        <span>${k(yukum, 'garanti')} Garanti Kapsamında</span><span>${k(yukum, 'servis')} Servis Sözleşmeli</span><span>${k(yukum, 'bakim')} Bakım Sözleşmeli</span>
      </td></tr>
      <tr><td style="${label}">Servis Yeri</td><td style="${value}" colspan="3" class="kutu-satir">
        <span>${k(yer, 'teknik')} ZNA Teknik Servis</span><span>${k(yer, 'yerinde')} Müşteri Yerinde</span><span>${k(yer, 'online')} Online</span><span>${k(yer, 'diger')} Diğer</span>
      </td></tr>
    </tbody></table>

    <!-- SERVİS TALEP BİLGİLERİ -->
    <table class="f"><tbody>
      <tr><td colspan="4" class="sec">SERVİS TALEP BİLGİLERİ</td></tr>
      <tr><td style="${label}">Adı ve Soyadı</td><td style="${value}">${escapeHtml(talep.ilgiliKisi || '—')}</td><td style="${label}">Servis Talep Tarihi / Saati</td><td style="${value}">${escapeHtml(tarihFmt(talep.olusturmaTarihi || talep.tarih))}</td></tr>
      <tr><td style="${label}">Servis İsteği</td><td style="${value}" colspan="3">${escapeHtml(talep.konu || '—')}</td></tr>
    </tbody></table>

    <!-- SERVİS VERİLEN SİSTEM BİLGİLERİ -->
    <table class="f"><tbody>
      <tr><td colspan="4" class="sec">SERVİS VERİLEN SİSTEM BİLGİLERİ</td></tr>
      <tr><td style="${label}">Ürün Tanımı</td><td style="${value}">${escapeHtml(urunTanimi)}</td><td style="${label}">Seri Numarası</td><td style="${value}">${escapeHtml(seriNo)}</td></tr>
      <tr><td style="${label}">Marka / Model</td><td style="${value}">${escapeHtml(markaModel)}</td><td style="${label}">Künye Numarası</td><td style="${value}">${escapeHtml(kunye)}</td></tr>
    </tbody></table>

    <!-- ARIZA AÇIKLAMASI -->
    <table class="f"><tbody>
      <tr><td class="sec">ARIZA AÇIKLAMASI</td></tr>
      <tr><td style="${value}min-height:60px;padding:8px 10px;">${nl2br(ariza) || '&nbsp;'}</td></tr>
    </tbody></table>

    <!-- YAPILAN İŞLEMLER -->
    <table class="f"><tbody>
      <tr><td class="sec">YAPILAN İŞLEMLER</td></tr>
      <tr><td style="${value}min-height:60px;padding:8px 10px;">${nl2br(yapilan) || '&nbsp;'}</td></tr>
    </tbody></table>

    <!-- YEDEK PARÇALAR -->
    <table class="f">
      <thead><tr>
        <th class="sec" style="width:28px;text-align:center;">#</th>
        <th class="sec">Yedek Parçalar ve/veya Hizmetler</th>
        <th class="sec" style="width:80px;text-align:right;">Birim Fiyat</th>
        <th class="sec" style="width:60px;text-align:right;">Miktar</th>
        <th class="sec" style="width:90px;text-align:right;">Tutar</th>
      </tr></thead>
      <tbody>
        ${parcaSatirlari}
        <tr><td colspan="4" style="${cell}text-align:right;font-weight:700;color:${ACCENT};">Genel Toplam</td><td style="${cell}text-align:right;font-weight:700;color:${ACCENT};">${genelToplam.toFixed(2)} ₺</td></tr>
      </tbody>
    </table>

    ${malzemeler.length > 0 ? `
    <!-- KULLANILAN MALZEMELER (ENVANTER) — servis_malzemeleri 'kullanildi' -->
    <table class="f">
      <thead><tr>
        <th class="sec" style="width:28px;text-align:center;">#</th>
        <th class="sec">Kullanılan Malzeme / Cihaz (Envanter)</th>
        <th class="sec" style="width:140px;">Seri No</th>
        <th class="sec" style="width:70px;text-align:right;">Miktar</th>
      </tr></thead>
      <tbody>
        ${malzemeler.map((m, i) => `
        <tr>
          <td style="${cell}text-align:center;">${i + 1}</td>
          <td style="${cell}">${escapeHtml(m.urunAdi ?? '')}${m.stokKodu ? ` (${escapeHtml(m.stokKodu)})` : ''}</td>
          <td style="${cell}">${escapeHtml(m.seriNo ?? '—')}</td>
          <td style="${cell}text-align:right;">${m.miktar ?? 1} ${escapeHtml(m.birim ?? 'Adet')}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : ''}

    <!-- SERVİS KOŞULLARI -->
    <table class="f"><tbody>
      <tr><td class="sec">SERVİS KOŞULLARI</td></tr>
      <tr><td style="${value}font-size:8px;line-height:1.4;color:#333;">
        - Garanti dışı arıza müdahalelerinde, sistemin çalışır durumda teslim edilmesinden sonra gerçekleşen arızaların giderilmesi ayrıca ücretlendirilecektir.<br/>
        - Servis Formunda belirtilen değiştirilmesi tespit edilmiş ve kurum yetkilisi tarafından imzalanarak onaylanmış parçaların değiştirilmemesinden kaynaklanan her türlü arızalara müdahale ayrıca ücretlendirilecektir.<br/>
        - Servis Formunda belirtilen bilgiler doğrultusunda yapılan tüm işlemler müşteri onayı imzasını takiben geçerlilik kazanır.
      </td></tr>
    </tbody></table>

    <!-- İMZA ALANLARI -->
    <table class="f">
      <thead><tr>
        <th class="sec">MÜŞTERİ YETKİLİSİ</th><th class="sec">YETKİLİ KURUM/KURULUŞ</th><th class="sec">YETKİLİ SERVİS PERSONELİ</th>
      </tr></thead>
      <tbody><tr>
        <td style="${cell}width:33.3%;">
          <div style="font-size:8px;color:${ACCENT};font-weight:600;">Servis İstemini Onaylayan</div>
          <div style="font-size:8px;color:#666;">${escapeHtml(talep.teslimAlanAd || talep.ilgiliKisi || '')}</div>
          ${imzaMusteri}
          <div style="border-top:1px solid ${BORDER};padding-top:4px;font-size:8px;color:${ACCENT};font-weight:600;">ONAY / İMZA</div>
        </td>
        <td style="${cell}width:33.3%;">
          <div style="font-size:8px;color:${ACCENT};font-weight:600;">Servis İstemini Onaylayan</div>
          <div style="font-size:8px;color:#666;">Kurum/Kuruluş Yetkilisi</div>
          <div style="height:50px;"></div>
          <div style="border-top:1px solid ${BORDER};padding-top:4px;font-size:8px;color:${ACCENT};font-weight:600;">ONAY / İMZA</div>
        </td>
        <td style="${cell}width:33.3%;">
          <div style="font-size:8px;color:${ACCENT};font-weight:600;">${escapeHtml(personelAd)}</div>
          ${imzaPersonel}
          <div style="border-top:1px solid ${BORDER};padding-top:4px;font-size:8px;color:${ACCENT};font-weight:600;">TEKNİK İNCELEME</div>
        </td>
      </tr></tbody>
    </table>

    <div style="margin-top:8px;font-size:8px;color:${ACCENT};text-align:center;line-height:1.5;">
      <div style="font-weight:700;">${escapeHtml(cfg.firmaAdi)}</div>
      <div>${escapeHtml(cfg.adres)}</div>
      <div>${escapeHtml(cfg.iletisim)}</div>
    </div>

    ${fotoSayfasi}
  </div>
</body></html>`
}
