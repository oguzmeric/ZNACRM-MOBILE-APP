import { supabase, tumSayfalariCek } from '../lib/supabase'
import { toCamel, arrayToCamel } from '../lib/mapper'

// Web ile aynı: kullanici_adi + sifre ile direkt sorgu (custom auth)
export const kullaniciGirisKontrol = async (kullaniciAdi, sifre) => {
  const { data, error } = await supabase
    .from('kullanicilar')
    .select('*')
    .eq('kullanici_adi', kullaniciAdi)
    .eq('sifre', sifre)
    .single()
  if (error) return null
  if (data?.hesap_silindi) return null
  return toCamel(data) || null
}

export const kullanicilariGetir = async () => {
  const data = await tumSayfalariCek('kullanicilar', (q) => q.order('id'))
  return arrayToCamel(data)
}

export const kullaniciDurumGuncelle = async (id, durum) => {
  await supabase.from('kullanicilar').update({ durum }).eq('id', id)
}

// Admin: yeni kullanıcı ekle
export const kullaniciEkle = async (veri) => {
  // Kullanıcı adı benzersiz olmalı
  const { data: mevcut } = await supabase
    .from('kullanicilar')
    .select('id')
    .eq('kullanici_adi', veri.kullaniciAdi)
    .maybeSingle()
  if (mevcut) return { ok: false, hata: 'Bu kullanıcı adı zaten var.' }

  const { data, error } = await supabase
    .from('kullanicilar')
    .insert({
      ad: veri.ad,
      kullanici_adi: veri.kullaniciAdi,
      sifre: veri.sifre,
      unvan: veri.unvan ?? null,
      telefon: veri.telefon ?? null,
      email: veri.email ?? null,
      durum: 'cevrimdisi',
    })
    .select()
    .single()
  if (error) {
    console.error('kullaniciEkle hata:', error.message)
    return { ok: false, hata: error.message }
  }
  return { ok: true, kullanici: toCamel(data) }
}

// Admin: kullanıcıyı pasife al / tekrar aktif et
export const kullaniciAktiflikGuncelle = async (id, aktif) => {
  const { error } = await supabase
    .from('kullanicilar')
    .update({
      hesap_silindi: !aktif,
      silinme_tarihi: aktif ? null : new Date().toISOString(),
    })
    .eq('id', id)
  return !error
}

// Şifre değiştir — önce mevcut şifre doğrula, sonra yenisini yaz
export const sifreDegistir = async (id, mevcutSifre, yeniSifre) => {
  const { data: kullanici, error: e1 } = await supabase
    .from('kullanicilar')
    .select('sifre')
    .eq('id', id)
    .single()
  if (e1 || !kullanici) return { ok: false, hata: 'Kullanıcı bulunamadı.' }
  if (kullanici.sifre !== mevcutSifre) {
    return { ok: false, hata: 'Mevcut şifre yanlış.' }
  }
  const { error: e2 } = await supabase
    .from('kullanicilar')
    .update({ sifre: yeniSifre })
    .eq('id', id)
  if (e2) return { ok: false, hata: 'Şifre güncellenemedi.' }
  return { ok: true }
}

// Profil fotoğrafı yükle — local URI'yi Supabase Storage'a gönderir, public URL döner
// Web'in kullandığı mevcut "urun-gorselleri" bucket'ını profiller/ alt klasörüyle
// paylaşıyoruz (yeni bucket sorunu olduğu için).
const BUCKET = 'urun-gorselleri'
const KLASOR = 'profiller'

export const profilFotosuYukle = async (kullaniciId, uri) => {
  try {
    const uzanti = (uri.match(/\.(\w+)(?:\?|$)/)?.[1] || 'jpg').toLowerCase()
    const mimeType = uzanti === 'png' ? 'image/png' : 'image/jpeg'
    const dosyaAdi = `${KLASOR}/${kullaniciId}-${Date.now()}.${uzanti}`

    const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
    const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

    const formData = new FormData()
    formData.append('file', {
      uri,
      name: dosyaAdi.split('/').pop(),
      type: mimeType,
    })

    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${dosyaAdi}`
    const resp = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'x-upsert': 'true',
      },
      body: formData,
    })

    if (!resp.ok) {
      const metin = await resp.text()
      console.error('Foto yükleme hatası:', resp.status, metin)
      return { ok: false, hata: `Upload ${resp.status}: ${metin}` }
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${dosyaAdi}`

    const { error: dbErr } = await supabase
      .from('kullanicilar')
      .update({ foto_url: publicUrl })
      .eq('id', kullaniciId)

    if (dbErr) {
      console.error('foto_url kaydedilemedi:', dbErr.message)
      return { ok: false, hata: dbErr.message }
    }

    return { ok: true, url: publicUrl }
  } catch (e) {
    console.error('profilFotosuYukle hata:', e)
    return { ok: false, hata: e?.message ?? 'Bilinmeyen hata' }
  }
}

// Profil fotoğrafını kaldır
export const profilFotosuKaldir = async (kullaniciId) => {
  const { error } = await supabase
    .from('kullanicilar')
    .update({ foto_url: null })
    .eq('id', kullaniciId)
  return !error
}

// Hesabı sil — App Store/Play Store zorunlu gereksinim
// Soft-delete: kişisel veriler temizlenir, kayıt devre dışı bırakılır
// Böylece servis/görev geçmişi gibi bağlı veriler bütünlüğünü korur
export const hesabiSil = async (kullaniciId) => {
  if (!kullaniciId) return { ok: false, hata: 'Kullanıcı yok.' }
  const rastgeleSifre = `silindi_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const { error } = await supabase
    .from('kullanicilar')
    .update({
      hesap_silindi: true,
      silinme_tarihi: new Date().toISOString(),
      foto_url: null,
      sifre: rastgeleSifre,
      durum: 'pasif',
    })
    .eq('id', kullaniciId)
  if (error) {
    console.error('hesabiSil hata:', error.message)
    return { ok: false, hata: error.message }
  }
  return { ok: true }
}

// Kendi profilini güncelle (unvan değil, kişisel bilgiler)
export const kendiProfilGuncelle = async (id, guncellenmis) => {
  const izinliAlanlar = ['ad'] // şimdilik sadece ad
  const temiz = {}
  for (const k of izinliAlanlar) {
    if (guncellenmis[k] !== undefined) temiz[k] = guncellenmis[k]
  }
  const { data, error } = await supabase
    .from('kullanicilar')
    .update(temiz)
    .eq('id', id)
    .select()
    .single()
  if (error) return null
  return toCamel(data)
}
