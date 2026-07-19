// Basit no-undef taraması: dosyayı parse et, kapsam analizi ile tanımsız
// global referansları bul (babel traverse ile). RN globalleri whitelist'te.
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import { readFileSync } from 'fs'

const traverse = _traverse.default || _traverse
const BILINEN = new Set([
  'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'Promise', 'Date', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number',
  'Boolean', 'Set', 'Map', 'RegExp', 'Error', 'isNaN', 'parseInt', 'parseFloat',
  'undefined', 'NaN', 'Infinity', 'atob', 'btoa', 'fetch', 'FormData',
  'requestAnimationFrame', 'alert', 'globalThis', 'require', 'process', '__DEV__',
  'Intl', 'encodeURIComponent', 'decodeURIComponent', 'Symbol', 'Proxy', 'Reflect',
  'Uint8Array', 'ArrayBuffer', 'Float32Array', 'Int32Array', 'DataView', 'TextEncoder', 'TextDecoder',
  'AbortController', 'URL', 'URLSearchParams', 'Blob', 'structuredClone', 'queueMicrotask',
  'WeakMap', 'WeakSet', 'URL', 'AbortController', 'structuredClone', 'queueMicrotask',
])

for (const dosya of process.argv.slice(2)) {
  const kod = readFileSync(dosya, 'utf8')
  const ast = parse(kod, { sourceType: 'module', plugins: ['jsx'] })
  const bulunan = new Map()
  traverse(ast, {
    Identifier(path) {
      if (!path.isReferencedIdentifier()) return
      const ad = path.node.name
      if (BILINEN.has(ad)) return
      if (path.scope.hasBinding(ad, true)) return
      if (!bulunan.has(ad)) bulunan.set(ad, path.node.loc?.start?.line)
    },
    JSXIdentifier(path) {
      if (!path.isReferencedIdentifier()) return
      const ad = path.node.name
      if (BILINEN.has(ad) || /^[a-z]/.test(ad)) return  // html/native etiketleri
      if (path.scope.hasBinding(ad, true)) return
      if (!bulunan.has(ad)) bulunan.set(ad, path.node.loc?.start?.line)
    },
  })
  if (bulunan.size === 0) {
    console.log(`TEMIZ ${dosya}`)
  } else {
    console.log(`TANIMSIZ ${dosya}:`)
    for (const [ad, satir] of bulunan) console.log(`  ${ad} (satır ${satir})`)
    process.exitCode = 1
  }
}
