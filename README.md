# Veil Chat

Uçtan uca şifreli (AES-GCM 256, tarayıcıda) sohbet odaları. Node.js + Express + WebSocket.

## Yerelde çalıştır
    npm install && npm start      # http://localhost:3000

## Ortam değişkenleri
| Değişken | Varsayılan | Açıklama |
|---|---|---|
| PORT | 3000 | Dinlenecek port (platformlar otomatik verir) |
| HOST | 0.0.0.0 | Bind adresi |
| DATA_DIR | ./data | Kalıcı klasör (data.json + uploads/) |

## Deploy
- **Docker / VPS:** `docker compose up -d --build`
- **Render:** repo kökünde `render.yaml` var → New → Blueprint. (Disk ücretli planda gerekir.)
- **Fly.io:** `fly launch --copy-config` ; `fly volumes create veil_data --size 1` ; `fly deploy`
- **Railway:** repoyu bağla, `/data` yoluna Volume ekle, `DATA_DIR=/data` ayarla.
- **Heroku / Procfile destekleyenler:** `Procfile` hazır (disk geçicidir, mesajlar kalıcı olmaz).

Önemli: WebSocket (`/ws`) destekleyen, sürekli çalışan bir Node ortamı gerekir
(Vercel/Netlify gibi serverless yerlerde çalışmaz). Mesaj kalıcılığı için `DATA_DIR` bir
volume'a bağlı olmalı. Tek instance çalıştır (durum bellekte/dosyada tutulur).
