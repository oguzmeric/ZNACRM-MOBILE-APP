import * as XLSX from 'xlsx'
import * as FileSystem from 'expo-file-system/legacy'

// Tek-ürün Excel: ilk sütun seri_no (opsiyonel başlık atlanır), 2. sütun barkod.
// Dönüş: string[] (seri listesi, ham — normalize çağıran tarafta yapılır).
const BASLIK_KELIMELER = ['seri', 'serino', 'seri_no', 'serial', 'sn', 's/n', 'barkod', 'barcode']

export async function seriListesiOku(uri) {
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
  const wb = XLSX.read(b64, { type: 'base64' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  // header:1 → satırları dizi-dizi al
  const satirlar = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' })
  const seriler = []
  satirlar.forEach((satir, i) => {
    const hucre = String(satir?.[0] ?? '').trim()
    if (!hucre) return
    // İlk satır başlıksa atla
    if (i === 0 && BASLIK_KELIMELER.includes(hucre.toLocaleLowerCase('tr').replace(/\s/g, ''))) return
    seriler.push(hucre)
  })
  return seriler
}
