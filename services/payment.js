// ===== PayTR Ödeme Servisi =====
// PayTR IFrame API entegrasyonu
// https://dev.paytr.com/odeme-formu/iframe-genel

const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');

/**
 * PayTR ödeme formu token'ı oluştur
 * @param {Object} env - Ortam değişkenleri
 * @param {Object} siparis - Sipariş bilgisi
 * @returns {Promise<Object>} { token, url }
 */
function createPaymentToken(env, siparis) {
  return new Promise((resolve, reject) => {
    const merchantId = env.PAYTR_MERCHANT_ID;
    const merchantKey = env.PAYTR_MERCHANT_KEY;
    const merchantSalt = env.PAYTR_MERCHANT_SALT;

    if (!merchantId || !merchantKey || !merchantSalt) {
      return reject(new Error('PayTR ayarları yapılmamış'));
    }

    // PayTR'a gönderilecek parametreler
    const userIp = '85.95.213.175'; // Gerçek IP sonra alınacak
    const userAddress = 'Gazipaşa, Antalya';
    const userPhone = siparis.phone;

    const params = {
      merchant_id: merchantId,
      user_ip: userIp,
      merchant_oid: siparis.id,
      email: 'musteri@gazipasaotocekici.com.tr',
      payment_amount: parseInt(siparis.price.replace(/[^0-9]/g, '')) * 100,
      currency: 'TL',
      user_name: 'Müşteri',
      user_address: userAddress,
      user_phone: userPhone,
      merchant_ok_url: 'https://gazipasaotocekici.com.tr/api/payment/success',
      merchant_fail_url: 'https://gazipasaotocekici.com.tr/api/payment/fail',
      user_basket: JSON.stringify([
        ['Oto Çekici Hizmeti', siparis.price.replace(/[^0-9]/g, ''), 1]
      ]),
      debug_on: 1,
      no_installment: 1,
      max_installment: 0,
      lang: 'tr',
      test_mode: 1  // Test modunda, canlıda 0 yapılacak
    };

    // Hash oluştur
    const hashStr = `${params.merchant_id}${params.user_ip}${params.merchant_oid}${params.email}${params.payment_amount}${params.user_basket}${params.no_installment}${params.max_installment}${params.currency}${params.test_mode}${merchantSalt}`;
    params.paytr_token = crypto.createHash('sha256').update(hashStr + merchantSalt).digest('base64');
    params.merchant_key = merchantKey;

    // PayTR API'ye gönder
    const postData = querystring.stringify(params);
    const options = {
      hostname: 'www.paytr.com',
      path: '/odeme/api/get-token',
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
          if (result.status === 'success') {
            resolve({ token: result.token, iframeUrl: `https://www.paytr.com/odeme/guvenli/${result.token}` });
          } else {
            reject(new Error(result.err_msg || 'PayTR hatası'));
          }
        } catch (e) {
          reject(new Error('PayTR yanıt ayrıştırma hatası'));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = {
  createPaymentToken
};
