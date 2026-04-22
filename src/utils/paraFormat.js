// Para birimi formatları
export const paraFormat = (tutar, paraBirimi = 'TL') => {
  const sayi = Number(tutar ?? 0)
  const formatli = sayi.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const sembol = paraBirimi === 'TL' ? '₺' : paraBirimi === 'USD' ? '$' : paraBirimi === 'EUR' ? '€' : paraBirimi
  return `${formatli} ${sembol}`
}
