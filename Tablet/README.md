# Müşteri Ziyaret Programı (APK'ye hazır)

Bu proje, tablete APK üretmek için GitHub Actions ile hazırdır.

## Hızlı Kullanım
1. ZIP'i açın, klasörü bir GitHub deposuna yükleyin (Git bilmiyorsanız: GitHub'da New Repository -> Upload files -> klasörü/ZIP içeriğini sürükleyip bırakın -> Commit).
2. Depoda **Actions** sekmesine gidin. `Build Android APK` çalışacak veya **Run workflow** deyin.
3. İş bitince sayfanın altındaki **Artifacts → app-debug.apk** dosyasını indirin.
4. APK'yı tablete kopyalayıp kurun (Ayarlar → Güvenlik → Bilinmeyen kaynaklara izin).

## Yerelde çalıştırma (opsiyonel)
```bash
npm install
npm run dev
# tarayıcıda aç: http://localhost:5173
```

## Notlar
- Konum izni istenir; konum alındığında harita ve navigasyon linki aktif olur.
- PWA olarak da kurulabilir (HTTPS altında). `public/manifest.json` ve `public/sw.js` hazırdır.
