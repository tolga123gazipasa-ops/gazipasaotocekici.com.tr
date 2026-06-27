const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Services
const telegram = require('./services/telegram');
const payment = require('./services/payment');

// .env yukle (basit)
const env = {};
try {
  const envFile = fs.readFileSync('.env', 'utf8');
  envFile.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    env[key] = val;
  });
} catch (e) {
  console.log('.env dosyasi bulunamadi, varsayilan degerler kullanilacak');
}

const PORT = process.env.PORT || env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME tipleri
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

// ===== API ROTALARI =====

// POST /api/order - Yeni siparis olustur
function handleCreateOrder(body, callback) {
  const { phone, lat, lng, destination, price } = body;

  if (!phone || !destination || !price) {
    return callback(400, { success: false, message: 'Eksik bilgi: telefon, teslim yeri ve fiyat zorunludur.' });
  }

  const siparis = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5).toUpperCase(),
    phone,
    lat: lat || null,
    lng: lng || null,
    destination,
    price,
    status: 'pending', // pending, paid, failed, cancelled
    createdAt: new Date().toISOString()
  };

  // Siparisi kaydet
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, siparis.id + '.json'), JSON.stringify(siparis, null, 2));

  // Telegram'a bildirim gonder
  telegram.sendOrderNotification(env, siparis);

  callback(200, { success: true, orderId: siparis.id, price });
}

// POST /api/payment/init - PayTR odeme baslat (sonra aktif)
function handlePaymentInit(body, callback) {
  callback(501, { success: false, message: 'Kredi karti odeme sistemi henuz aktif degil. Nakit odeme ile devam edin.' });
}

// POST /api/payment/callback - PayTR callback
function handlePaymentCallback(body, callback) {
  callback(501, { success: false, message: 'Henuz aktif degil.' });
}

// GET /api/health - Saglik kontrolu
function handleHealth(callback) {
  callback(200, {
    status: 'ok',
    time: new Date().toISOString(),
    paymentActive: false,
    telegramActive: env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_TOKEN !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE'
  });
}

// ===== STATIK DOSYA SERVISI =====
function serveStatic(reqPath, res) {
  // Guvenlik: dizin disina cikma
  const normalized = path.normalize(reqPath).replace(/^(\.\.(\/|\\|$))+/, '');
  let filePath = path.join(PUBLIC_DIR, normalized);

  // Dizin ise index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404 - Sayfa Bulunamadi</h1>');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
}

// ===== ANA SUNUCU =====
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // JSON body oku
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    let jsonBody = {};
    try { if (body) jsonBody = JSON.parse(body); } catch (e) {}

    // API rotalari
    if (pathname === '/api/order' && method === 'POST') {
      return handleCreateOrder(jsonBody, (status, data) => {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      });
    }

    if (pathname === '/api/payment/init' && method === 'POST') {
      return handlePaymentInit(jsonBody, (status, data) => {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      });
    }

    if (pathname === '/api/payment/callback' && method === 'POST') {
      return handlePaymentCallback(jsonBody, (status, data) => {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      });
    }

    // POST /api/track - Kullanici aktivite takibi
    if (pathname === '/api/track' && method === 'POST') {
      const event = jsonBody.event || 'bilinmeyen';
      const detail = jsonBody.detail || '';
      const phone = jsonBody.phone || '';
      const fullDetail = detail + (phone ? ' | Tel: ' + phone : '');
      // Async fire-and-forget
      telegram.sendTrackingNotification(env, event, fullDetail);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (pathname === '/api/health' && method === 'GET') {
      return handleHealth((status, data) => {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      });
    }

    // Statik dosya
    serveStatic(pathname === '/' ? '/index.html' : pathname, res);
  });
});

server.listen(PORT, () => {
  const msg = 'Gazipasa Oto Cekici sunucusu http://localhost:' + PORT + ' adresinde calisiyor';
  console.log(msg);
  console.log('   Telegram: ' + (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_TOKEN !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE' ? '[OK] Hazir' : '[!!] Yapilandirilmamis (.env)'));
  console.log('   Odeme:    [..] PayTR entegrasyonu bekliyor');
});
