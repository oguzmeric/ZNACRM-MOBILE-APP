// Teklif yönetici onayı — bildirim tarafı (web'deki
// crm-app/src/services/teklifOnayService.js → teklifOnayaDustuBildir portu).
//
// ⚠️ NEDEN VAR: Mobilden oluşturulan teklifler yönetici onay yetkililerine
// HİÇ haber vermiyordu (04.08 tespiti). Web tarafı teklifi kaydettikten sonra
// bu bildirimi gönderiyor (TeklifDetay.jsx), mobilde karşılığı yoktu:
// teklif onay listesine düşüyor ama kimsenin haberi olmuyordu.
//
// Karar veren ekran webde (/teklif-onaylari) — burada yalnız HABER VERİLİR.

import { supabase } from '../lib/supabase'
import { bildirimEkleDb } from './bildirimService'
import { smsGonder } from './smsService'

// TR karakter → ASCII (SMS-friendly). Web ile birebir aynı.
const trAsciify = (s) => String(s || '')
  .replace(/İ/g, 'I').replace(/ı/g, 'i')
  .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
  .replace(/Ş/g, 'S').replace(/ş/g, 's')
  .replace(/Ç/g, 'C').replace(/ç/g, 'c')
  .replace(/Ö/g, 'O').replace(/ö/g, 'o')
  .replace(/Ü/g, 'U').replace(/ü/g, 'u')

/**
 * Teklif "Yönetici Onayı Bekliyor"a düşünce onay yetkililerine bildirim + SMS.
 * Best-effort: hata teklif kaydını BOZMAZ (teklif zaten kaydedilmiş olur).
 * Gönderen kişi yetkililerden biriyse kendisine gitmez.
 */
export async function teklifOnayaDustuBildir(teklif, { gonderenAd, gonderenId } = {}) {
  if (!teklif?.id) return
  try {
    const { data: yetkiler, error } = await supabase
      .from('kullanicilar')
      .select('id, ad, cep_telefon')
      .eq('teklif_onay_yetkilisi', true)
      .eq('tip', 'zna')
      .neq('durum', 'pasif')
    if (error) { console.warn('[teklifOnayaDustuBildir] yetkili çekilemedi:', error.message); return }
    if (!yetkiler?.length) { console.warn('[teklifOnayaDustuBildir] teklif_onay_yetkilisi=true kullanıcı yok'); return }

    const teklifNo = teklif.teklifNo || teklif.teklif_no || `#${teklif.id}`
    const firma = teklif.firmaAdi || teklif.firma_adi || 'Müşteri —'
    const kim = gonderenAd || 'Bir personel'

    await Promise.all(yetkiler
      .filter(y => String(y.id) !== String(gonderenId ?? ''))
      .map(async (y) => {
        // Bildirim = push zinciri: bildirimler INSERT → trigger → Expo push
        bildirimEkleDb({
          aliciId: y.id,
          baslik: 'Yeni Teklif — Onay Bekliyor',
          mesaj: `${firma} için "${teklifNo}" teklifi ${kim} tarafından oluşturuldu — Teklif Onayı ekranında onayınızı bekliyor.`,
          tip: 'teklif',
          link: '/teklif-onaylari',
        }).catch(e => console.warn('[bildirim] teklif onay:', e?.message))

        if (y.cep_telefon) {
          const mesaj = `ZNA CRM: Yeni teklif onay bekliyor.\n${trAsciify(firma)}\nNo: ${teklifNo}\nHazirlayan: ${trAsciify(kim)}\ntalep.znateknoloji.com`
          smsGonder(y.cep_telefon, mesaj)
            .catch(e => console.warn('[sms] teklif onay:', e?.message))
        }
      }))
  } catch (e) {
    console.warn('[teklifOnayaDustuBildir] hata:', e?.message)
  }
}
