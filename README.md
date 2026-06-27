# Gazipaşa Oto Çekici

Gazipaşa'da 7/24 oto çekici, yol yardım, yerinde lastik tamiri ve forklift kiralama hizmetleri.

## Özellikler

- 7/24 acil çekici çağırma
- Konum paylaşma (GPS)
- Telegram üzerinden anlık kullanıcı takibi
- 24 farklı operatör kodu seçeneği
- Mobil uyumlu tasarım

## Kurulum

```bash
git clone https://github.com/tolga123gazipasa-ops/gazipasaotocekici.com.tr.git
cd gazipasaotocekici.com.tr
echo "PORT=3000" > .env
echo "TELEGRAM_BOT_TOKEN=your_bot_token" >> .env
echo "TELEGRAM_CHAT_ID=your_chat_id" >> .env
node server.js
```

## Canlı

[gazipasaotocekici.com.tr](https://gazipasaotocekici.com.tr)
