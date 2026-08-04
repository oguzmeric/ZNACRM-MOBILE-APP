// Galeriden foto seçimi — TEK KAPI (04.08 keşif 51 dersi).
//
// SORUN: iOS'un foto seçicisi (PHPicker) galeriden seçilen dosyayı ORİJİNAL
// formatında kopyalar. iPhone varsayılanı HEIC olduğu için seçilen fotolar
// HEIC olarak yükleniyordu; mobil galeri bunları gösterir ama WEB TARAYICISI
// GÖSTEREMEZ ("mobilde var, webde açılmıyor" şikayeti — keşif 51, 4 foto).
// quality parametresi bu yolda İŞLEMEZ; kameradan çekilenler JPEG çıktığı
// için yalnız galeriden seçilenler kırıktı.
//
// ÇÖZÜM: preferredAssetRepresentationMode='compatible' → iOS'a "uyumlu
// format ver" talimatı; sistem HEIC'i JPEG'e kendisi çevirir. Native modül
// değildir (expo-image-manipulator OTA tuzağına girmez), Android'de yok
// sayılır. TÜM galeri seçimleri bu sarıcıdan geçmeli — doğrudan
// ImagePicker.launchImageLibraryAsync ÇAĞIRMA.
import * as ImagePicker from 'expo-image-picker'

const MODLAR = ImagePicker.UIImagePickerPreferredAssetRepresentationMode
export const galeridenFotoSec = (secenekler = {}) =>
  ImagePicker.launchImageLibraryAsync({
    ...secenekler,
    preferredAssetRepresentationMode: (MODLAR && MODLAR.Compatible) || 'compatible',
  })
