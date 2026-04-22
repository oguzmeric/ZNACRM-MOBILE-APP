// snake_case (DB) <-> camelCase (JS) dönüştürücü
// Web tarafıyla aynı semantiği korur.

export const toCamel = (row) => {
  if (!row || typeof row !== 'object') return row
  const result = {}
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase())
    result[camelKey] = value
  }
  return result
}

export const arrayToCamel = (arr) => (arr || []).map(toCamel)

export const toSnake = (obj) => {
  if (!obj || typeof obj !== 'object') return obj
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue
    const snakeKey = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`)
    result[snakeKey] = value
  }
  return result
}
