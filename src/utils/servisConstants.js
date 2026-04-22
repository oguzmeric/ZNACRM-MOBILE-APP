// Web tarafı (ServisTalebiContext) ile aynı sabitler

export const ANA_TURLER = [
  { id: 'ariza', isim: 'Arıza', ikon: '🔧', renk: '#ef4444', prefix: 'ARZ' },
  { id: 'talep', isim: 'Talep', ikon: '📋', renk: '#3b82f6', prefix: 'TLP' },
  { id: 'montaj', isim: 'Montaj', ikon: '🧰', renk: '#8b5cf6', prefix: 'MTJ' },
  { id: 'kurulum', isim: 'Kurulum', ikon: '⚙️', renk: '#0ea5e9', prefix: 'KRL' },
  { id: 'bakim', isim: 'Bakım', ikon: '🛠️', renk: '#f59e0b', prefix: 'BKM' },
  { id: 'degisim', isim: 'Değişim', ikon: '🔁', renk: '#f97316', prefix: 'DGS' },
  { id: 'sokum', isim: 'Söküm', ikon: '🪛', renk: '#a855f7', prefix: 'SKM' },
  { id: 'kesif', isim: 'Keşif', ikon: '🔍', renk: '#014486', prefix: 'KSF' },
  { id: 'egitim', isim: 'Eğitim', ikon: '🎓', renk: '#06b6d4', prefix: 'EGT' },
  { id: 'teklif', isim: 'Teklif', ikon: '💼', renk: '#10b981', prefix: 'TKF' },
]

export const turPrefix = (turId) =>
  ANA_TURLER.find((t) => t.id === turId)?.prefix ?? 'TLP'

export const ALT_KATEGORILER = {
  ariza: [
    { id: 'kamera_gorunum_yok', isim: 'Kamera görüntü yok' },
    { id: 'kamera_kayit_yok', isim: 'Kamera kayıt yok' },
    { id: 'nvr_arizasi', isim: 'NVR / Kayıt cihazı arızası' },
    { id: 'disk_arizasi', isim: 'Disk arızası' },
    { id: 'pdks_calismiyor', isim: 'PDKS çalışmıyor' },
    { id: 'kart_okuyucu', isim: 'Kart okuyucu çalışmıyor' },
    { id: 'turnike_arizasi', isim: 'Turnike arızası' },
    { id: 'yangin_alarm', isim: 'Yangın alarm arızası' },
    { id: 'ag_baglanti', isim: 'Ağ / Bağlantı sorunu' },
    { id: 'diger_ariza', isim: 'Diğer arıza' },
  ],
  talep: [
    { id: 'yeni_kullanici', isim: 'Yeni kullanıcı açılması' },
    { id: 'yetki_degisikligi', isim: 'Yetki değişikliği' },
    { id: 'sifre_sifirlama', isim: 'Şifre sıfırlama' },
    { id: 'cihaz_tasima', isim: 'Cihaz taşıma' },
    { id: 'sistem_revizyonu', isim: 'Sistem revizyonu' },
    { id: 'rapor_talebi', isim: 'Rapor talebi' },
    { id: 'yedek_parca', isim: 'Yedek parça talebi' },
    { id: 'entegrasyon', isim: 'Entegrasyon talebi' },
    { id: 'diger_talep', isim: 'Diğer talep' },
  ],
  kesif: [
    { id: 'yeni_proje', isim: 'Yeni proje keşfi' },
    { id: 'ilave_kamera', isim: 'İlave kamera keşfi' },
    { id: 'pdks_kesif', isim: 'PDKS keşfi' },
    { id: 'yangin_kesif', isim: 'Yangın alarm keşfi' },
    { id: 'network_kesif', isim: 'Network altyapı keşfi' },
    { id: 'diger_kesif', isim: 'Diğer keşif' },
  ],
  bakim: [
    { id: 'periyodik_bakim', isim: 'Periyodik bakım' },
    { id: 'kamera_bakimi', isim: 'Kamera bakımı' },
    { id: 'yangin_sistemi_bakimi', isim: 'Yangın sistemi bakımı' },
    { id: 'pdks_bakimi', isim: 'PDKS bakımı' },
    { id: 'network_bakimi', isim: 'Network bakımı' },
    { id: 'diger_bakim', isim: 'Diğer bakım' },
  ],
  teklif: [
    { id: 'guvenlik_sistemi', isim: 'Güvenlik sistemi teklifi' },
    { id: 'pdks_teklif', isim: 'PDKS teklifi' },
    { id: 'yangin_teklif', isim: 'Yangın sistemi teklifi' },
    { id: 'network_teklif', isim: 'Network altyapı teklifi' },
    { id: 'bakim_sozlesmesi', isim: 'Bakım sözleşmesi teklifi' },
    { id: 'diger_teklif', isim: 'Diğer teklif' },
  ],
  egitim: [
    { id: 'kullanici_egitimi', isim: 'Kullanıcı eğitimi' },
    { id: 'sistem_egitimi', isim: 'Sistem eğitimi' },
    { id: 'yazilim_egitimi', isim: 'Yazılım eğitimi' },
    { id: 'diger_egitim', isim: 'Diğer eğitim' },
  ],
  montaj: [
    { id: 'kamera_montaji', isim: 'Kamera montajı' },
    { id: 'nvr_montaji', isim: 'NVR montajı' },
    { id: 'turnike_montaji', isim: 'Turnike montajı' },
    { id: 'pdks_montaji', isim: 'PDKS montajı' },
    { id: 'yangin_detektor_montaji', isim: 'Yangın detektörü montajı' },
    { id: 'kart_okuyucu_montaji', isim: 'Kart okuyucu montajı' },
    { id: 'diger_montaj', isim: 'Diğer montaj' },
  ],
  kurulum: [
    { id: 'sistem_kurulumu', isim: 'Sistem kurulumu' },
    { id: 'yazilim_kurulumu', isim: 'Yazılım kurulumu' },
    { id: 'lisans_kurulumu', isim: 'Lisans kurulumu' },
    { id: 'entegrasyon_kurulumu', isim: 'Entegrasyon kurulumu' },
    { id: 'diger_kurulum', isim: 'Diğer kurulum' },
  ],
  degisim: [
    { id: 'kamera_degisimi', isim: 'Kamera değişimi' },
    { id: 'disk_degisimi', isim: 'Disk değişimi' },
    { id: 'nvr_degisimi', isim: 'NVR değişimi' },
    { id: 'kart_okuyucu_degisimi', isim: 'Kart okuyucu değişimi' },
    { id: 'sensor_degisimi', isim: 'Sensör değişimi' },
    { id: 'diger_degisim', isim: 'Diğer değişim' },
  ],
  sokum: [
    { id: 'kamera_sokumu', isim: 'Kamera sökümü' },
    { id: 'nvr_sokumu', isim: 'NVR sökümü' },
    { id: 'sistem_demontaji', isim: 'Sistem demontajı' },
    { id: 'diger_sokum', isim: 'Diğer söküm' },
  ],
}

export const ACILIYET_SEVIYELERI = [
  { id: 'dusuk', isim: 'Düşük', renk: '#6b7280', ikon: '🟢' },
  { id: 'normal', isim: 'Normal', renk: '#3b82f6', ikon: '🔵' },
  { id: 'yuksek', isim: 'Yüksek', renk: '#f59e0b', ikon: '🟡' },
  { id: 'acil', isim: 'Acil', renk: '#ef4444', ikon: '🔴' },
]

export const DURUM_LISTESI = [
  { id: 'bekliyor', isim: 'Bekliyor', renk: '#6b7280', ikon: '⏳' },
  { id: 'inceleniyor', isim: 'İnceleniyor', renk: '#3b82f6', ikon: '🔍' },
  { id: 'atandi', isim: 'Atandı', renk: '#014486', ikon: '👤' },
  { id: 'devam_ediyor', isim: 'Devam Ediyor', renk: '#f59e0b', ikon: '🔄' },
  { id: 'tamamlandi', isim: 'Tamamlandı', renk: '#10b981', ikon: '✅' },
  { id: 'onaylandi', isim: 'Onaylandı', renk: '#059669', ikon: '🟢' },
  { id: 'reddedildi', isim: 'Reddedildi', renk: '#dc2626', ikon: '⛔' },
  { id: 'iptal', isim: 'İptal', renk: '#ef4444', ikon: '❌' },
]

export const turBul = (id) => ANA_TURLER.find((t) => t.id === id)
export const aciliyetBul = (id) => ACILIYET_SEVIYELERI.find((a) => a.id === id)
export const durumBul = (id) => DURUM_LISTESI.find((d) => d.id === id)
