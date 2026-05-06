// Trassir teklif HTML — 5 sayfalık marka-yoğun sunum
import { TRASSIR_KARSILAMA, ZNA_HAKKINDA, HIZMETLERIMIZ } from '../teklifTemplates'
import { fmtPara, fmtTarih, escapeHtml, toplamHesapla, sayfaFooterHtml, ortakStil } from './ortak'

const trassirEkStil = `
  .kapak {
    width: 210mm; min-height: 297mm; padding: 0;
    position: relative; background: #fff; page-break-after: always;
    overflow: hidden;
  }
  .kapak img.cover { width: 100%; height: 297mm; object-fit: cover; }

  .anlati { font-size: 12px; line-height: 1.75; }
  .anlati .firma-ad { font-weight: 700; margin-bottom: 12px; }
  .anlati p.metin { text-align: justify; white-space: pre-line; margin-bottom: 28px; }
  .alt-baslik {
    font-size: 18px; color: #0176D3; font-weight: 700;
    margin-top: 24px; margin-bottom: 10px;
    padding-bottom: 4px; border-bottom: 2px solid #0176D3;
  }
  .anlati ul { font-size: 12px; line-height: 1.9; padding-left: 22px; }

  .merkez-baslik {
    font-size: 24px; color: #0176D3; font-weight: 600;
    text-align: center; margin-top: 30px; margin-bottom: 36px;
  }
  .ortak-resim {
    display: flex; justify-content: center;
  }
  .ortak-resim img { max-width: 100%; max-height: 210mm; object-fit: contain; }
`

export const trassirHtml = ({ teklif, gorseller }) => {
  const { araToplam, kdvToplam, genelToplam } = toplamHesapla(teklif.satirlar)

  const satirlarHtml = (teklif.satirlar || [])
    .map((s, i) => {
      const ara = (Number(s.miktar) || 0) * (Number(s.birimFiyat) || 0)
      const isk = ara * ((Number(s.iskonto) || 0) / 100)
      const top = ara - isk
      return `
        <tr class="${i % 2 ? 'zebra' : ''}">
          <td style="font-weight:600;">${escapeHtml(s.marka || (s.stokKodu ? '—' : 'ZNA'))}</td>
          <td>${escapeHtml(s.stokAdi)}</td>
          <td style="text-align:right;">${Number(s.miktar) || 0} ${escapeHtml(s.birim || '')}</td>
          <td style="text-align:right;">${fmtPara(s.birimFiyat, teklif.paraBirimi)}</td>
          <td style="text-align:right;font-weight:700;">${fmtPara(top, teklif.paraBirimi)}</td>
        </tr>`
    })
    .join('')

  const hizmetSatirlari = HIZMETLERIMIZ.map((h) => `<li>${escapeHtml(h)}</li>`).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <style>${ortakStil()}${trassirEkStil}</style></head><body>

    <!-- Sayfa 1: Kapak -->
    <div class="kapak">
      <img class="cover" src="${gorseller.znaCover}" />
    </div>

    <!-- Sayfa 2: Anlatı -->
    <div class="teklif-sayfa">
      <img class="zna-logo-sol" src="${gorseller.znaLogo}" />
      <h1 class="baslik" style="font-size:26px;margin-top:50px;">Fiyat Teklifi</h1>
      <div class="anlati">
        <p class="firma-ad">Sayın ${escapeHtml(teklif.firmaAdi || '')}</p>
        <p class="metin">${escapeHtml(TRASSIR_KARSILAMA)}</p>
        <h2 class="alt-baslik">ZNA Hakkında</h2>
        <p style="text-align:justify;margin-bottom:24px;">${escapeHtml(ZNA_HAKKINDA)}</p>
        <h2 class="alt-baslik">Hizmetlerimiz</h2>
        <ul>${hizmetSatirlari}</ul>
      </div>
      ${sayfaFooterHtml()}
    </div>

    <!-- Sayfa 3: Fiyatlandırma -->
    <div class="teklif-sayfa">
      <img class="zna-logo-sol" src="${gorseller.znaLogo}" />
      <div class="meta-satir">
        <span><strong>Tarih :</strong> ${fmtTarih(teklif.tarih)}</span>
        <span><strong>Hazırlayan :</strong> ${escapeHtml(teklif.hazirlayan || '—')}</span>
      </div>
      <h2 class="baslik">Fiyatlandırma</h2>
      <table class="fiyat-tablo">
        <thead><tr>
          <th style="text-align:left;width:15%;">Marka</th>
          <th style="text-align:left;">Açıklama</th>
          <th style="text-align:right;width:13%;">Ad./Mt.</th>
          <th style="text-align:right;width:15%;">Birim Fiyat</th>
          <th style="text-align:right;width:17%;">Toplam Fiyat</th>
        </tr></thead>
        <tbody>${satirlarHtml}</tbody>
      </table>
      <div class="toplam-blok">
        <table>
          <tr><td class="label">Ara Tutar :</td><td style="text-align:right;">${fmtPara(araToplam, teklif.paraBirimi)}</td></tr>
          <tr><td class="label">Kdv % 20 :</td><td style="text-align:right;">${fmtPara(kdvToplam, teklif.paraBirimi)}</td></tr>
          <tr class="genel"><td>Genel Toplam :</td><td style="text-align:right;">${fmtPara(genelToplam, teklif.paraBirimi)}</td></tr>
        </table>
      </div>
      ${teklif.aciklama ? `<div class="aciklama-kutu"><strong>Açıklama : </strong><span>${escapeHtml(teklif.aciklama)}</span></div>` : ''}
      ${sayfaFooterHtml()}
    </div>

    <!-- Sayfa 4: İş Ortakları -->
    <div class="teklif-sayfa">
      <img class="zna-logo-sol" src="${gorseller.znaLogo}" />
      <h2 class="merkez-baslik">İş Ortaklarımız</h2>
      <div class="ortak-resim"><img src="${gorseller.isOrtaklari}" /></div>
      ${sayfaFooterHtml()}
    </div>

    <!-- Sayfa 5: Referanslar -->
    <div class="teklif-sayfa">
      <img class="zna-logo-sol" src="${gorseller.znaLogo}" />
      <h2 class="merkez-baslik">Bazı Referanslarımız</h2>
      <div class="ortak-resim"><img src="${gorseller.referanslar}" /></div>
      ${sayfaFooterHtml()}
    </div>

    </body></html>`
}
