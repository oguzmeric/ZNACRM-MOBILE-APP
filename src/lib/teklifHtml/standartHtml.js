// Standart teklif HTML — tek sayfa, ZNA logolu klasik mektup formatı
import { fmtPara, fmtTarih, escapeHtml, toplamHesapla, sayfaFooterHtml, ortakStil } from './ortak'

export const standartHtml = ({ teklif, gorseller }) => {
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

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <style>${ortakStil()}</style></head><body>
    <div class="teklif-sayfa">
      <img class="zna-logo-sol" src="${gorseller.znaLogo}" />

      <div class="meta-satir">
        <span><strong>Tarih :</strong> ${fmtTarih(teklif.tarih)}</span>
        <span><strong>Hazırlayan :</strong> ${escapeHtml(teklif.hazirlayan || '—')}</span>
      </div>

      <h2 class="baslik">Fiyat Teklifi</h2>

      <div style="margin-bottom:14px;font-size:12px;">
        <strong>Sayın ${escapeHtml(teklif.firmaAdi || '')}</strong>
      </div>

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
    </body></html>`
}
