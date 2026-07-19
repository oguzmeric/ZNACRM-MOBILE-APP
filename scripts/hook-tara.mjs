// Rules of Hooks konum tarayıcısı — "Rendered more hooks" çökmesinin kök sebebi:
// bileşen gövdesinde ERKEN RETURN'den (if (loading) return ...) SONRA hook çağrısı.
// Bu hata projede 4 kez tekrarladı (GorevDetay beyaz sayfa x3, KesifDetayScreen çökme).
// Kullanım: node scripts/hook-tara.mjs <dosya...>   — EAS/build öncesi undef-tara ile birlikte ZORUNLU.
import { readFileSync } from 'fs'
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
const traverse = _traverse.default || _traverse

const dosyalar = process.argv.slice(2)
if (!dosyalar.length) { console.error('kullanım: node scripts/hook-tara.mjs <dosya...>'); process.exit(1) }

// Bir top-level statement kendi içinde ReturnStatement barındırıyor mu (fonksiyon gövdelerine inmeden)?
function returnIceriyor(node) {
  if (!node || typeof node.type !== 'string') return false
  if (node.type === 'ReturnStatement') return true
  if (/Function/.test(node.type)) return false // iç fonksiyonların return'ü sayılmaz
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue
    const v = node[key]
    if (Array.isArray(v)) { if (v.some(returnIceriyor)) return true }
    else if (v && typeof v.type === 'string') { if (returnIceriyor(v)) return true }
  }
  return false
}

let toplamHata = 0
for (const dosya of dosyalar) {
  const kod = readFileSync(dosya, 'utf8')
  let ast
  try {
    ast = parse(kod, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true })
  } catch (e) {
    console.error(`PARSE HATASI ${dosya}: ${e.message}`)
    toplamHata++
    continue
  }

  // Her fonksiyon için: gövdesindeki İLK erken-return satırı (son statement hariç)
  const erkenReturn = new Map() // fnNode -> satır
  const fnListe = []
  traverse(ast, {
    'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression'(path) {
      const govde = path.node.body
      if (!govde || govde.type !== 'BlockStatement') return
      fnListe.push(path.node)
      const stmts = govde.body
      for (let i = 0; i < stmts.length - 1; i++) { // son statement (final return) hariç
        if (returnIceriyor(stmts[i])) {
          erkenReturn.set(path.node, stmts[i].loc?.start?.line ?? 0)
          break
        }
      }
    },
  })

  const bulgular = []
  traverse(ast, {
    CallExpression(path) {
      const ad = path.node.callee?.name
      if (!ad || !/^use[A-Z]/.test(ad)) return
      // Hook'un render sırasında çalıştığı fonksiyon = en yakın saran fonksiyon
      const fn = path.getFunctionParent()?.node
      if (!fn) return
      const sinir = erkenReturn.get(fn)
      const satir = path.node.loc?.start?.line ?? 0
      if (sinir && satir > sinir) {
        bulgular.push(`  ${ad} (satır ${satir}) — erken return satır ${sinir}'den SONRA`)
      }
    },
  })

  if (bulgular.length) {
    console.error(`HOOK SIRASI HATALI ${dosya}:`)
    for (const b of bulgular) console.error(b)
    toplamHata += bulgular.length
  } else {
    console.log(`TEMIZ ${dosya}`)
  }
}
process.exit(toplamHata ? 1 : 0)
