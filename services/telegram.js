// ===== Telegram Bildirim Servisi =====
// HTTPS kullanarak Telegram Bot API'ye direkt istek

const https = require('https');
const querystring = require('querystring');

/**
 * Telegram Bot API'ye mesaj gonderen temel fonksiyon
 */
function sendTelegramMessage(env, message) {
  return new Promise((resolve) => {
    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;

    if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
      console.log('[TELEGRAM] Yapilandirilmamis, mesaj atlaniyor');
      return resolve(false);
    }

    if (!chatId || chatId === 'YOUR_CHAT_ID_HERE') {
      chatId = '@Gazipasaotocekicibot';
    }

    const postData = querystring.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });

    const options = {
      hostname: 'api.telegram.org',
      path: '/bot' + token + '/sendMessage',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.ok) {
            console.log('[TELEGRAM] Mesaj gonderildi');
            resolve(true);
          } else {
            console.log('[TELEGRAM] Hata: ' + result.description);
            resolve(false);
          }
        } catch (e) {
          console.log('[TELEGRAM] Yanit okuma hatasi: ' + e.message);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.log('[TELEGRAM] Baglanti hatasi: ' + err.message);
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Yeni siparis bildirimi
 */
async function sendOrderNotification(env, siparis) {
  const destLabels = {
    gazipasa_sanayi: 'Gazipasa Sanayi (2.000 TL)',
    alanya_sanayi: 'Alanya Sanayi (2.500 TL)',
    alanya_ozel_servis: 'Alanya Ozel Servis (3.000 TL)',
    antalya: 'Antalya (6.000 TL)'
  };

  const konumBilgisi = (siparis.lat && siparis.lng)
    ? '📍 <a href="https://www.google.com/maps?q=' + siparis.lat + ',' + siparis.lng + '">Haritada Goster</a>'
    : '📍 Konum paylasilmadi';

  const message = [
    ' <b>YENI CEKICI TALEBI!</b>',
    '──────────────────────',
    '<b>Talep No:</b> ' + siparis.id,
    '<b>Telefon:</b> ' + siparis.phone,
    '<b>Gidilecek Yer:</b> ' + (destLabels[siparis.destination] || siparis.destination),
    '<b>Tahmini Ucret:</b> ' + siparis.price + ' TL',
    '<b>Durum:</b> ' + (siparis.status === 'paid' ? '[ODENDI]' : '[ODEME BEKLIYOR]'),
    konumBilgisi,
    '<b>Tarih:</b> ' + new Date(siparis.createdAt).toLocaleString('tr-TR'),
    '──────────────────────',
    '<i>Hemen musteriyi arayin!</i>'
  ].join('\n');

  await sendTelegramMessage(env, message);
}

/**
 * Odeme basarili bildirimi
 */
async function sendPaymentSuccessNotification(env, siparis) {
  const message = [
    '[ODEME ONAYLANDI]',
    '──────────────────────',
    '<b>Talep No:</b> ' + siparis.id,
    '<b>Telefon:</b> ' + siparis.phone,
    '<b>Tutar:</b> ' + siparis.price + ' TL',
    '<b>Odeme:</b> Kredi Karti ile odendi',
    '──────────────────────',
    '<i>Musteri odemeyi yapti, cekiciyi yonlendirin.</i>'
  ].join('\n');

  await sendTelegramMessage(env, message);
}

/**
 * Odeme basarisiz bildirimi
 */
async function sendPaymentFailedNotification(env, siparis, hata) {
  const message = [
    '[ODEME BASARISIZ]',
    '──────────────────────',
    '<b>Talep No:</b> ' + siparis.id,
    '<b>Telefon:</b> ' + siparis.phone,
    '<b>Tutar:</b> ' + siparis.price + ' TL',
    '<b>Hata:</b> ' + (hata || 'Bilinmeyen hata'),
    '──────────────────────',
    '<i>Musteri ile iletisime gecip alternatif odeme yontemi sunun.</i>'
  ].join('\n');

  await sendTelegramMessage(env, message);
}

/**
 * Kullanici aktivite takip bildirimi
 */
async function sendTrackingNotification(env, event, detail) {
  const eventLabels = {
    siteye_girdi: 'Siteye Girdi',
    konum_almaya_calisiyor: 'Konum Almaya Basladi',
    telefon_yaziyor: 'Telefon Yazmaya Basladi'
  };

  const message = [
    '[AKTIVITE TAKIP]',
    '──────────────────────',
    '<b>Olay:</b> ' + (eventLabels[event] || event),
    '<b>Detay:</b> ' + detail,
    '<b>Zaman:</b> ' + new Date().toLocaleString('tr-TR'),
    '──────────────────────'
  ].join('\n');

  await sendTelegramMessage(env, message);
}

module.exports = {
  sendTelegramMessage,
  sendOrderNotification,
  sendPaymentSuccessNotification,
  sendPaymentFailedNotification,
  sendTrackingNotification
};
