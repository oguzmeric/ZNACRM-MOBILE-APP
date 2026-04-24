import { turBul, durumBul } from '../utils/servisConstants'

const DONEM_LABEL = {
  bugun: 'Bugün',
  hafta: 'Son 7 Gün',
  ay: 'Son 30 Gün',
  tum: 'Tüm Zamanlar',
}

const escapeHtml = (s) =>
  String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

export function raporHtml({ istatistik, donem, logoBase64 = null }) {
  if (!istatistik) return '<p>Veri yok.</p>'

  const durumRows = Object.entries(istatistik.durumSay)
    .sort(([, a], [, b]) => b - a)
    .map(([id, sayi]) => {
      const d = durumBul(id)
      const oran = (sayi / istatistik.toplam) * 100
      return `
      <tr>
        <td>${d?.ikon ?? ''} ${escapeHtml(d?.isim ?? id)}</td>
        <td class="right" style="color:${d?.renk ?? '#334155'};font-weight:700;">${sayi}</td>
        <td class="right">%${oran.toFixed(1)}</td>
      </tr>`
    })
    .join('')

  const turRows = Object.entries(istatistik.turSay)
    .sort(([, a], [, b]) => b - a)
    .map(([id, sayi]) => {
      const t = turBul(id)
      const oran = (sayi / istatistik.toplam) * 100
      return `
      <tr>
        <td>${t?.ikon ?? ''} ${escapeHtml(t?.isim ?? id)}</td>
        <td class="right" style="color:${t?.renk ?? '#334155'};font-weight:700;">${sayi}</td>
        <td class="right">%${oran.toFixed(1)}</td>
      </tr>`
    })
    .join('')

  const personelRows = istatistik.topPersonel
    .map((p, i) => {
      const medal = ['🥇', '🥈', '🥉', '4.', '5.'][i]
      return `
      <tr>
        <td>${medal} ${escapeHtml(p.ad)}</td>
        <td class="right" style="font-weight:700;">${p.sayi}</td>
      </tr>`
    })
    .join('')

  const simdi = new Date()
  const tarihStr = simdi.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
  const saatStr = simdi.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=794" />
<title>Rapor - ${DONEM_LABEL[donem] ?? donem}</title>
<style>
  @page { size: A4; margin: 28px; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #0f172a;
    font-size: 12px;
    margin: 0;
    position: relative;
  }
  .watermark {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    font-size: 200px;
    font-weight: 900;
    color: rgba(15, 23, 42, 0.05);
    z-index: 0;
    letter-spacing: 24px;
    white-space: nowrap;
  }
  .content { position: relative; z-index: 1; }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px solid #2563eb;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  .logo-wrap img { height: 50px; }
  .baslik { text-align: right; }
  .baslik h1 { margin: 0; font-size: 20px; font-weight: 800; color: #2563eb; letter-spacing: 1.5px; }
  .baslik .alt { font-size: 11px; color: #64748b; margin-top: 4px; }

  .toplam-kart {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 10px;
    padding: 16px;
    margin-bottom: 20px;
    text-align: center;
  }
  .toplam-sayi { font-size: 42px; font-weight: 900; color: #1d4ed8; }
  .toplam-alt { font-size: 12px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }

  h2 {
    font-size: 13px;
    font-weight: 800;
    color: #0f172a;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin: 18px 0 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #cbd5e1;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
    font-size: 11px;
  }
  th {
    background: #f1f5f9;
    text-align: left;
    padding: 8px 10px;
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 700;
    color: #334155;
    border: 1px solid #cbd5e1;
  }
  td {
    padding: 7px 10px;
    border: 1px solid #e2e8f0;
  }
  td.right { text-align: right; }

  footer {
    margin-top: 30px;
    padding-top: 10px;
    border-top: 1px solid #cbd5e1;
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #64748b;
  }
</style>
</head>
<body>
  <div class="watermark">ZNA</div>
  <div class="content">
    <header>
      <div class="logo-wrap">
        ${logoBase64 ? `<img src="${logoBase64}" />` : '<div style="font-size:24px;font-weight:900;color:#0f172a;">ZNA</div>'}
      </div>
      <div class="baslik">
        <h1>YÖNETİM RAPORU</h1>
        <div class="alt">${DONEM_LABEL[donem] ?? donem} · ${tarihStr} ${saatStr}</div>
      </div>
    </header>

    <div class="toplam-kart">
      <div class="toplam-sayi">${istatistik.toplam}</div>
      <div class="toplam-alt">Toplam Servis Talebi</div>
    </div>

    <h2>Durum Dağılımı</h2>
    ${durumRows
      ? `<table>
          <thead><tr><th>Durum</th><th class="right">Adet</th><th class="right">Oran</th></tr></thead>
          <tbody>${durumRows}</tbody>
        </table>`
      : '<p style="color:#94a3b8;font-style:italic;">Kayıt yok.</p>'}

    <h2>Servis Türü Dağılımı</h2>
    ${turRows
      ? `<table>
          <thead><tr><th>Tür</th><th class="right">Adet</th><th class="right">Oran</th></tr></thead>
          <tbody>${turRows}</tbody>
        </table>`
      : '<p style="color:#94a3b8;font-style:italic;">Kayıt yok.</p>'}

    <h2>🏆 En Çok İş Alan Personel</h2>
    ${personelRows
      ? `<table>
          <thead><tr><th>Personel</th><th class="right">Atanan Servis</th></tr></thead>
          <tbody>${personelRows}</tbody>
        </table>`
      : '<p style="color:#94a3b8;font-style:italic;">Atanmış iş yok.</p>'}

    <footer>
      <div>ZNA Teknoloji · Yönetim Raporu</div>
      <div>Oluşturulma: ${tarihStr} ${saatStr}</div>
    </footer>
  </div>
</body>
</html>`
}
