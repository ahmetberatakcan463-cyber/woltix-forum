/**
 * Woltix Forum - Güvenlik Yardımcı Fonksiyonları
 * 
 * Bu modül şunları sağlar:
 * - Token oluşturma ve doğrulama
 * - Veri şifreleme/şifre çözme
 * - Güvenli rastgele değer üretimi
 * - Audit log yardımcıları
 */

const crypto = require('crypto');

// ============================================================
// ŞİFRELEME
// ============================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * AES-256-GCM ile veri şifrele
 * @param {string} plainText - Şifrelenecek metin
 * @param {string} key - Şifreleme anahtarı (32 byte)
 * @returns {string} Şifrelenmiş veri (hex)
 */
function encrypt(plainText, key) {
  if (!plainText || !key) return null;
  
  try {
    const derivedKey = crypto.scryptSync(key, 'woltix-salt', KEY_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
    
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    // IV + Auth Tag + Encrypted Data
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('[CRYPTO] Encryption error:', err.message);
    return null;
  }
}

/**
 * AES-256-GCM ile şifrelenmiş veriyi çöz
 * @param {string} encryptedData - Şifrelenmiş veri (iv:authTag:encrypted)
 * @param {string} key - Şifreleme anahtarı
 * @returns {string|null} Çözülmüş metin
 */
function decrypt(encryptedData, key) {
  if (!encryptedData || !key) return null;
  
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return null;
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const derivedKey = crypto.scryptSync(key, 'woltix-salt', KEY_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error('[CRYPTO] Decryption error:', err.message);
    return null;
  }
}

// ============================================================
// GÜVENLİ TOKEN ÜRETİMİ
// ============================================================

/**
 * Güvenli rastgele token oluştur
 * @param {number} bytes - Token boyutu (byte)
 * @returns {string} Hex token
 */
function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * API anahtarı oluştur (woltix_ ile başlar)
 * @returns {string} API anahtarı
 */
function generateApiKey() {
  const random = crypto.randomBytes(32).toString('base64url');
  return `woltix_${random}`;
}

/**
 * Session ID oluştur
 * @returns {string} Session ID
 */
function generateSessionId() {
  return `sess_${crypto.randomBytes(24).toString('base64url')}`;
}

// ============================================================
// HASH İŞLEMLERİ
// ============================================================

/**
 * Verinin SHA-256 hash'ini hesapla
 * @param {string} data - Hash'lenecek veri
 * @returns {string} Hex hash
 */
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Verinin HMAC-SHA256 imzasını oluştur
 * @param {string} data - İmzalanacak veri
 * @param {string} key - İmza anahtarı
 * @returns {string} Hex imza
 */
function hmacSign(data, key) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

/**
 * HMAC imzasını doğrula
 */
function hmacVerify(data, key, signature) {
  const expected = hmacSign(data, key);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// ============================================================
// VERİ DOĞRULAMA
// ============================================================

/**
 * URL güvenli mi kontrol et (SSRF koruması)
 */
function isSafeUrl(url) {
  if (!url) return false;
  
  try {
    const parsed = new URL(url);
    
    // Sadece http ve https protokollerine izin ver
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    
    // Private IP aralıklarını engelle (SSRF)
    const hostname = parsed.hostname.toLowerCase();
    
    const blockedPatterns = [
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^0\./,
      /^localhost$/i,
      /^::$/,
      /^::1$/,
      /^0:0:0:0:0:0:0:1$/,
      /^169\.254\./,
      /^fc00:/,
      /^fe80:/,
    ];
    
    for (const pattern of blockedPatterns) {
      if (pattern.test(hostname)) {
        return false;
      }
    }
    
    // İzin verilen domain'ler
    const allowedDomains = [
      'i.imgur.com',
      'imgur.com',
      'images.unsplash.com',
      'cdn.discordapp.com',
      'media.discordapp.net',
    ];
    
    if (allowedDomains.some(d => hostname === d || hostname.endsWith('.' + d))) {
      return true;
    }
    
    // Genel domain kontrolü
    if (hostname.includes('.')) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * HTML içeriğini temizle (XSS koruması)
 * Sadece güvenli etiketlere izin ver
 */
function sanitizeHtml(html) {
  if (!html) return '';
  
  const allowedTags = [
    'b', 'i', 'u', 's', 'em', 'strong', 'a', 'code', 'pre',
    'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'span', 'div', 'sup', 'sub',
  ];
  
  // Tehlikeli etiketleri kaldır
  const dangerousTags = [
    'script', 'style', 'iframe', 'object', 'embed', 'form', 'input',
    'button', 'select', 'textarea', 'meta', 'link', 'base', 'frame',
    'frameset', 'applet', 'marquee', 'svg', 'math',
  ];
  
  let sanitized = html;
  
  // Tehlikeli etiketleri kaldır
  for (const tag of dangerousTags) {
    const regex = new RegExp(`<${tag}[\\s>]|<\\/${tag}>`, 'gi');
    sanitized = sanitized.replace(regex, '');
  }
  
  // Sadece izin verilen etiketleri bırak
  // (Bu basit bir yaklaşım, production'da DOMPurify kullanılmalı)
  
  return sanitized;
}

// ============================================================
// AUDIT LOG
// ============================================================

/**
 * Güvenlik audit log'u oluştur
 */
function auditLog(action, userId, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    userId: userId || 'anonymous',
    ...details,
  };
  
  // Audit log'u formatla
  const logLine = `[AUDIT] ${JSON.stringify(logEntry)}`;
  
  // Konsola yaz
  console.log(logLine);
  
  // İleride dosyaya veya veritabanına yazılabilir
  return logEntry;
}

/**
 * Güvenlik olayı log'u (tehlikeli aktiviteler için)
 */
function securityEvent(eventType, severity, details = {}) {
  const event = {
    timestamp: new Date().toISOString(),
    eventType,
    severity, // 'low', 'medium', 'high', 'critical'
    ...details,
  };
  
  const logLine = `[SECURITY] [${severity.toUpperCase()}] ${JSON.stringify(event)}`;
  
  if (severity === 'critical' || severity === 'high') {
    console.error(logLine);
  } else {
    console.warn(logLine);
  }
  
  return event;
}

// ============================================================
// IP VE RATE LIMITING YARDIMCILARI
// ============================================================

/**
 * IP adresini normalize et (IPv6 -> IPv4 mapping)
 */
function normalizeIp(ip) {
  if (!ip) return 'unknown';
  
  // ::ffff:127.0.0.1 -> 127.0.0.1
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  
  return ip;
}

/**
 * İstekten güvenlik skoru hesapla (0-100)
 * Yüksek skor = daha güvenli
 */
function calculateRequestSecurityScore(req) {
  let score = 50; // Başlangıç skoru
  
  // User-Agent kontrolü
  const ua = req.headers['user-agent'] || '';
  if (ua.length < 10) score -= 10;
  if (!ua.includes('/')) score -= 5;
  
  // Accept header kontrolü
  const accept = req.headers['accept'] || '';
  if (!accept) score -= 5;
  
  // Referrer kontrolü
  const referer = req.headers['referer'] || '';
  if (referer && !referer.includes(process.env.FRONTEND_URL || '')) {
    score -= 10;
  }
  
  // Content-Type kontrolü (POST istekleri için)
  if (req.method === 'POST') {
    const ct = req.headers['content-type'] || '';
    if (!ct) score -= 10;
    if (ct.includes('text/plain')) score -= 5;
  }
  
  // Normalize et
  return Math.max(0, Math.min(100, score));
}

module.exports = {
  encrypt,
  decrypt,
  generateSecureToken,
  generateApiKey,
  generateSessionId,
  sha256,
  hmacSign,
  hmacVerify,
  isSafeUrl,
  sanitizeHtml,
  auditLog,
  securityEvent,
  normalizeIp,
  calculateRequestSecurityScore,
};
