// Ortak yardımcılar: para format, satır hesabı, footer/header HTML
import { ZNA_FIRMA } from '../teklifTemplates'

export const fmtPara = (n, paraBirimi = 'TL') => {
  const sembol = paraBirimi === 'USD' ? '$' : paraBirimi === 'EUR' ? '€' : '₺'
  return `${sembol}${(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const fmtTarih = (t) => (t ? new Date(t).toLocaleDateString('tr-TR') : '—')

export const escapeHtml = (s) => {
  if (s == null) return ''
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export const toplamHesapla = (satirlar = []) => {
  const araToplam = satirlar.reduce((s, r) => {
    const ara = (Number(r.miktar) || 0) * (Number(r.birimFiyat) || 0)
    const isk = ara * ((Number(r.iskonto) || 0) / 100)
    return s + (ara - isk)
  }, 0)
  const kdvToplam = satirlar.reduce((s, r) => {
    const ara = (Number(r.miktar) || 0) * (Number(r.birimFiyat) || 0)
    const isk = ara * ((Number(r.iskonto) || 0) / 100)
    return s + (ara - isk) * ((Number(r.kdv) || 20) / 100)
  }, 0)
  return { araToplam, kdvToplam, genelToplam: araToplam + kdvToplam }
}

export const sayfaFooterHtml = () => `
  <div class="zna-footer">
    <div class="zna-footer-unvan">${ZNA_FIRMA.unvan}</div>
    <div class="zna-footer-satir">${escapeHtml(ZNA_FIRMA.adres)} &nbsp;&nbsp; ${escapeHtml(ZNA_FIRMA.vdNo)}</div>
    <div class="zna-footer-satir">
      Tel.: ${escapeHtml(ZNA_FIRMA.tel)} &nbsp;&nbsp;
      <span class="zna-footer-link">${escapeHtml(ZNA_FIRMA.email)}</span> &nbsp;&nbsp;
      <span class="zna-footer-link">${escapeHtml(ZNA_FIRMA.web)}</span>
    </div>
  </div>
`

export const ortakStil = () => `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4 portrait; margin: 0; }
  body { font-family: 'Helvetica', 'Arial', sans-serif; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .teklif-sayfa {
    width: 210mm; min-height: 297mm; padding: 20mm 20mm 35mm 20mm;
    position: relative; background: #fff; page-break-after: always;
  }
  .teklif-sayfa:last-child { page-break-after: auto; }
  .zna-footer {
    position: absolute; bottom: 10mm; left: 20mm; right: 20mm;
    text-align: center; border-top: 1px solid #cbd5e1; padding-top: 6px;
  }
  .zna-footer-unvan { font-size: 11px; font-weight: 700; color: #0176D3; margin-bottom: 2px; }
  .zna-footer-satir { font-size: 9px; color: #475569; margin-bottom: 1px; }
  .zna-footer-link { color: #0176D3; }
  .zna-logo-sol { position: absolute; top: 12mm; left: 14mm; height: 56px; object-fit: contain; }
  .karel-rozet {
    position: absolute; top: 12mm; right: 14mm;
    background: #fff; padding: 4px 8px; border-radius: 4px;
    box-shadow: 0 0 0 1px #e2e8f0;
  }
  .karel-rozet img { height: 36px; object-fit: contain; display: block; }
  .baslik {
    font-size: 22px; color: #0176D3; font-weight: 600;
    margin-bottom: 22px; text-align: center;
  }
  .meta-satir {
    display: flex; justify-content: space-between;
    margin-top: 50px; margin-bottom: 18px;
    font-size: 12px; color: #475569;
  }
  table.fiyat-tablo { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  table.fiyat-tablo thead tr { background: #0176D3; color: #fff; }
  table.fiyat-tablo th { padding: 8px; border: 1px solid #0176D3; }
  table.fiyat-tablo td { padding: 6px; border: 1px solid #cbd5e1; }
  table.fiyat-tablo tr.zebra { background: #f8fafc; }
  .toplam-blok { display: flex; justify-content: flex-end; margin-top: 18px; }
  .toplam-blok table { font-size: 13px; min-width: 280px; }
  .toplam-blok td { padding: 4px; }
  .toplam-blok td.label { padding-right: 16px; color: #475569; }
  .toplam-blok tr.genel td { padding: 8px; padding-right: 16px; border-top: 2px solid #0176D3; font-weight: 800; color: #0176D3; }
  .aciklama-kutu {
    margin-top: 28px; font-size: 12px; padding: 12px 16px;
    background: #f8fafc; border-left: 3px solid #0176D3; border-radius: 4px;
  }
  .aciklama-kutu strong { color: #0176D3; }
  .aciklama-kutu span { color: #475569; }
`
