/**
 * Woltix Forum - Gelişmiş Güvenlik Middleware'i
 *
 * Bu modül şunları sağlar:
 * - Input sanitization (XSS, NoSQL Injection, SQL Injection koruması)
 * - CSRF token doğrulama
 * - Request boyut limitleri
 * - Zararlı pattern tespiti
 * - Rate limiting yardımcıları
 * - IP ban listesi (brute force koruması)
 * - Güvenlik olayı loglama
 */

// ============================================================
// IP BAN LISTESİ (Brute Force Koruması)
// ============================================================

class IpBanList {
  constructor() {
    this.bannedIps = new Map(); // ip -> { reason, expiresAt, attempts }
    this.attempts = new Map();  // ip -> [{ timestamp, path }]
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000); // 1 dk
  }

  /**
   * Başarısız giriş denemesi kaydet
   * @returns {number} Son 15 dk'daki toplam deneme sayısı
   */
  recordAttempt(ip, path = '/') {
    const now = Date.now();
    if (!this.attempts.has(ip)) {
      this.attempts.set(ip, []);
    }
    const attempts = this.attempts.get(ip);
    attempts.push({ timestamp: now, path });
    
    // Sadece son 15 dk'yı tut
    const cutoff = now - 15 * 60 * 1000;
    const recent = attempts.filter(a => a.timestamp > cutoff);
    this.attempts.set(ip, recent);
    
    // 20+ deneme = 1 saat IP ban
    if (recent.length >= 20) {
      this.ban(ip, 'Brute force detection: Too many failed attempts', 60 * 60 * 1000);
    }
    // 10+ deneme = 15 dk IP ban
    else if (recent.length >= 10) {
      this.ban(ip, 'Rate limit: Excessive requests', 15 * 60 * 1000);
    }
    
    return recent.length;
  }

  /**
   * IP'yi banla
   */
  ban(ip, reason, duration = 15 * 60 * 1000) {
    this.bannedIps.set(ip, {
      reason,
      expiresAt: Date.now() + duration,
      attempts: (this.attempts.get(ip) || []).length,
    });
    console.warn(`[IP-BAN] IP banned: ${ip} - ${reason} (${duration / 60000}min)`);
  }

  /**
   * IP ban kontrolü
   */
  isBanned(ip) {
    const ban = this.bannedIps.get(ip);
    if (!ban) return false;
    if (Date.now() > ban.expiresAt) {
      this.bannedIps.delete(ip);
      return false;
    }
    return true;
  }

  /**
   * Ban kalan süre (ms)
   */
  getBanTimeRemaining(ip) {
    const ban = this.bannedIps.get(ip);
    if (!ban) return 0;
    return Math.max(0, ban.expiresAt - Date.now());
  }

  /**
   * Başarılı girişte denemeleri temizle
   */
  clearAttempts(ip) {
    this.attempts.delete(ip);
  }

  /**
   * Süresi dolmuş banları temizle
   */
  cleanup() {
    const now = Date.now();
    for (const [ip, ban] of this.bannedIps.entries()) {
      if (now > ban.expiresAt) {
        this.bannedIps.delete(ip);
      }
    }
    // 1 saatten eski attempt kayıtlarını temizle
    const cutoff = now - 60 * 60 * 1000;
    for (const [ip, attempts] of this.attempts.entries()) {
      const recent = attempts.filter(a => a.timestamp > cutoff);
      if (recent.length === 0) {
        this.attempts.delete(ip);
      } else {
        this.attempts.set(ip, recent);
      }
    }
  }

  /**
   * Ban listesi istatistikleri
   */
  getStats() {
    return {
      totalBanned: this.bannedIps.size,
      totalTracked: this.attempts.size,
      activeBans: Array.from(this.bannedIps.entries()).map(([ip, ban]) => ({
        ip,
        reason: ban.reason,
        remainingMs: Math.max(0, ban.expiresAt - Date.now()),
        totalAttempts: ban.attempts,
      })),
    };
  }
}

const ipBanList = new IpBanList();

// ============================================================
// GÜVENLİK OLAY LOGLAMA
// ============================================================

const { pool } = require('../config/database');

/**
 * Güvenlik olayını veritabanına logla
 */
async function logSecurityEvent(eventType, details, req) {
  try {
    await pool.query(
      `INSERT INTO security_events (event_type, user_id, ip_address, user_agent, details, path, method)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        eventType,
        req?.user?.id || null,
        req?.ip || 'unknown',
        req?.headers?.['user-agent']?.substring(0, 255) || 'unknown',
        JSON.stringify(details),
        req?.path || '/',
        req?.method || 'UNKNOWN',
      ]
    );
  } catch (err) {
    console.error('[SECURITY-LOG] Failed to log event:', err.message);
  }
}

// ============================================================
// ZARARLI PATTERN TESPİTİ (Gelişmiş)
// ============================================================

const SUSPICIOUS_PATTERNS = {
  sqlInjection: [
    /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b[\s\S]*?\b(FROM|INTO|SET|TABLE|DATABASE|VALUES|WHERE)\b)/i,
    /(\b(OR|AND)\b\s*[\s\S]*?=)/i,
    /('|")\s*(OR|AND)\s*('|")\s*(=|LIKE)/i,
    /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b)/i,
    /(--|#|\/\*|\*\/|;)/,
    /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
    /admin'?\s*--/i,
    /(\b(WAITFOR|DELAY|SLEEP|BENCHMARK)\b\s*\(.*\d)/i,
    /(\b(INFORMATION_SCHEMA|PG_CATALOG|MYSQL|SQLITE)\b)/i,
    /(\b(CHAR|CONCAT|GROUP_CONCAT|HEX|UNHEX)\b\s*\()/i,
  ],
  xss: [
    /<script[\s>]/i,
    /javascript\s*:/i,
    /onerror\s*=/i,
    /onload\s*=/i,
    /onclick\s*=/i,
    /onmouseover\s*=/i,
    /onfocus\s*=/i,
    /onblur\s*=/i,
    /onchange\s*=/i,
    /onsubmit\s*=/i,
    /onreset\s*=/i,
    /onselect\s*=/i,
    /onabort\s*=/i,
    /alert\s*\(/i,
    /prompt\s*\(/i,
    /confirm\s*\(/i,
    /document\.cookie/i,
    /document\.location/i,
    /window\.location/i,
    /fetch\s*\(/i,
    /XMLHttpRequest/i,
    /eval\s*\(/i,
    /<embed[\s>]/i,
    /<object[\s>]/i,
    /<iframe[\s>]/i,
    /<svg[\s>]/i,
    /<img[\s>][^>]*onerror/i,
    /<link[\s>]/i,
    /<style[\s>]/i,
    /<marquee[\s>]/i,
    /<details[\s>]/i,
    /src\s*=\s*['"]?\s*data:/i,
    /src\s*=\s*['"]?\s*javascript:/i,
    /&#x?\d+;/i,
    /\\x[0-9a-fA-F]{2}/i,
    /\\u[0-9a-fA-F]{4}/i,
    /<template[\s>]/i,
    /<slot[\s>]/i,
    /<import[\s>]/i,
    /<include[\s>]/i,
    /<annotation[\s>]/i,
    /<foreignObject[\s>]/i,
    /<math[\s>]/i,
    /<form[\s>][^>]*action/i,
    /<input[^>]*formaction/i,
    /<button[^>]*formaction/i,
    /<isindex[\s>]/i,
    /<base[\s>]/i,
    /<meta[\s>][^>]*http-equiv/i,
    /<meta[\s>][^>]*refresh/i,
  ],
  pathTraversal: [
    /\.\.\//,
    /\.\.\\/,
    /\.\.%2f/i,
    /\.\.%5c/i,
    /~root/i,
    /%00/,
    /\\0/,
    /etc\/passwd/i,
    /etc\/shadow/i,
    /boot\.ini/i,
    /windows\\system32/i,
    /\.env/i,
    /\.git\//i,
    /\.svn\//i,
    /composer\.json/i,
    /package\.json/i,
    /Procfile/i,
    /Dockerfile/i,
    /docker-compose/i,
    /\.aws\//i,
    /\.ssh\//i,
    /id_rsa/i,
    /id_dsa/i,
    /\.pem/i,
    /\.key/i,
  ],
  commandInjection: [
    /[;&|`$]/,
    /\|\|/,
    /&&/,
    />\s*\/dev\//,
    /\$\(/,
    /\$\{/,
    /`.*`/,
    /\%0[Aa]/,
    /\%0[Dd]/,
    /\n/,
    /\r/,
    /bin\/(bash|sh|zsh|dash)/i,
    /\/usr\/bin\//i,
    /\/etc\/init\.d\//i,
    /systemctl/i,
    /service\s+\w+\s+(start|stop|restart)/i,
    /wget\s+/i,
    /curl\s+/i,
    /nc\s+/i,
    /ncat\s+/i,
    /powershell/i,
    /cmd\.exe/i,
    /\/bin\/python/i,
    /\/usr\/bin\/python/i,
    /perl\s+/i,
    /ruby\s+/i,
  ],
  noSqlInjection: [
    /\$ne/,
    /\$gt/,
    /\$lt/,
    /\$gte/,
    /\$lte/,
    /\$regex/,
    /\$where/,
    /\$exists/,
    /\$in/,
    /\$nin/,
    /\$or/,
    /\$and/,
    /\$not/,
    /\$nor/,
    /\$all/,
    /\$elemMatch/,
    /\$text/,
    /\$search/,
    /\$near/,
    /\$geoWithin/,
    /\$mod/,
    /\$slice/,
    /\$comment/,
  ],
  prototypePollution: [
    /__proto__/,
    /prototype\s*\[/,
    /constructor\s*\[/,
    /\.constructor\s*=/,
    /\.__defineGetter__/i,
    /\.__defineSetter__/i,
    /\.__lookupGetter__/i,
    /\.__lookupSetter__/i,
  ],
};

// ============================================================
// INPUT SANITIZATION
// ============================================================

/**
 * String'deki potansiyel tehlikeli karakterleri temizler
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/\\/g, '&#x5C;')
    .replace(/`/g, '&#x60;')
    .replace(/\$/g, '&#x24;');
}

/**
 * Bir değerin içindeki tüm string'leri rekürsif olarak temizler
 */
function deepSanitize(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(item => deepSanitize(item));
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = deepSanitize(value);
    }
    return sanitized;
  }
  return obj;
}

// ============================================================
// ZARARLI İÇERİK TESPİTİ
// ============================================================

/**
 * Bir string'de zararlı pattern'leri kontrol eder
 * @returns {Array} Bulunan pattern tipleri
 */
function detectMaliciousPatterns(value, checkTypes = ['sqlInjection', 'xss', 'pathTraversal', 'commandInjection', 'noSqlInjection', 'prototypePollution']) {
  if (typeof value !== 'string') return [];
  
  const found = [];
  for (const type of checkTypes) {
    const patterns = SUSPICIOUS_PATTERNS[type];
    if (!patterns) continue;
    
    for (const pattern of patterns) {
      if (pattern.test(value)) {
        found.push(type);
        break;
      }
    }
  }
  return found;
}

/**
 * Bir obje içindeki tüm string değerlerde zararlı pattern ara
 */
function deepDetectMalicious(obj, checkTypes) {
  const results = [];
  
  function scan(value, path = '') {
    if (value === null || value === undefined) return;
    if (typeof value === 'string') {
      const found = detectMaliciousPatterns(value, checkTypes);
      if (found.length > 0) {
        results.push({ path, value: value.substring(0, 100), types: found });
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => scan(item, `${path}[${index}]`));
    } else if (typeof value === 'object') {
      for (const [key, val] of Object.entries(value)) {
        scan(val, path ? `${path}.${key}` : key);
      }
    }
  }
  
  scan(obj);
  return results;
}

// ============================================================
// CSRF KORUMASI
// ============================================================

const crypto = require('crypto');

// In-memory CSRF token store (production'da Redis kullanılmalı)
const csrfTokens = new Map();

// CSRF token temizliği (her 15 dakikada bir eski token'ları sil)
setInterval(() => {
  const now = Date.now();
  for (const [token, timestamp] of csrfTokens.entries()) {
    if (now - timestamp > 24 * 60 * 60 * 1000) { // 24 saat
      csrfTokens.delete(token);
    }
  }
}, 15 * 60 * 1000);

/**
 * Yeni bir CSRF token oluşturur
 */
function generateCsrfToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(token, Date.now());
  return token;
}

/**
 * CSRF token'ını doğrular
 */
function validateCsrfToken(token) {
  if (!token || !csrfTokens.has(token)) return false;
  const timestamp = csrfTokens.get(token);
  // 24 saat geçerli
  if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
    csrfTokens.delete(token);
    return false;
  }
  return true;
}

// ============================================================
// EXPRESS MIDDLEWARE'LER
// ============================================================

/**
 * Input sanitization middleware'i
 * Tüm request body, query ve params'ı temizler
 */
function inputSanitizer(req, res, next) {
  if (req.body) {
    req.body = deepSanitize(req.body);
  }
  if (req.query) {
    req.query = deepSanitize(req.query);
  }
  if (req.params) {
    req.params = deepSanitize(req.params);
  }
  next();
}

/**
 * Zararlı pattern dedektörü middleware'i
 * İstekte SQL injection, XSS vb. pattern'leri arar ve ENGELLER
 */
function maliciousPatternDetector(req, res, next) {
  const checkFields = [];
  
  // Body'yi kontrol et
  if (req.body && typeof req.body === 'object') {
    const bodyResults = deepDetectMalicious(req.body);
    checkFields.push(...bodyResults.map(r => ({ ...r, source: 'body' })));
  }
  
  // Query parametrelerini kontrol et
  if (req.query && typeof req.query === 'object') {
    const queryResults = deepDetectMalicious(req.query);
    checkFields.push(...queryResults.map(r => ({ ...r, source: 'query' })));
  }
  
  // URL parametrelerini kontrol et
  if (req.params && typeof req.params === 'object') {
    const paramResults = deepDetectMalicious(req.params);
    checkFields.push(...paramResults.map(r => ({ ...r, source: 'params' })));
  }
  
  // Header'ları kontrol et (User-Agent, Referer vb.)
  if (req.headers) {
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string' && !['x-csrf-token', 'authorization'].includes(key)) {
        const found = detectMaliciousPatterns(value);
        if (found.length > 0) {
          checkFields.push({ path: `headers.${key}`, value: value.substring(0, 100), types: found, source: 'headers' });
        }
      }
    }
  }
  
  if (checkFields.length > 0) {
    console.warn(`[SECURITY] Malicious patterns detected from ${req.ip}:`, {
      path: req.path,
      method: req.method,
      findings: checkFields,
      userAgent: req.headers['user-agent'],
    });
    
    // IP ban listesine ekle (brute force)
    ipBanList.recordAttempt(req.ip, req.path);
    
    // Güvenlik olayını logla (async - bekleme)
    logSecurityEvent('malicious_pattern', {
      findings: checkFields.map(f => ({ path: f.path, types: f.types, source: f.source })),
    }, req);
    
    // İsteği ENGELLE - güvenlik ihlali
    return res.status(403).json({
      error: 'Request blocked: Suspicious content detected',
      code: 'SUSPICIOUS_CONTENT',
      requestId: req.requestId,
    });
  }
  
  next();
}

/**
 * CSRF koruma middleware'i
 * POST, PUT, PATCH, DELETE isteklerinde CSRF token kontrolü
 */
function csrfProtection(req, res, next) {
  // Sadece state değiştiren method'ları kontrol et
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }
  
  // Auth endpoint'leri CSRF gerektirmez (token daha yeni alınıyor)
  if (req.path.startsWith('/api/auth/')) {
    return next();
  }
  
  const csrfToken = req.headers['x-csrf-token'];
  
  if (!csrfToken) {
    return res.status(403).json({ error: 'CSRF token required' });
  }
  
  if (!validateCsrfToken(csrfToken)) {
    return res.status(403).json({ error: 'Invalid or expired CSRF token' });
  }
  
  next();
}

/**
 * Request boyut limitleri
 * Body'deki string alanların maksimum uzunluğunu kontrol eder
 */
function requestSizeLimiter(req, res, next) {
  if (!req.body || typeof req.body !== 'object') return next();
  
  const MAX_FIELD_LENGTHS = {
    title: 200,
    content: 50000,
    bio: 500,
    website: 200,
    signature: 300,
    username: 30,
    password: 128,
    email: 254,
    avatar_url: 500,
    badge_name: 50,
    ban_reason: 500,
    message: 10000,
  };
  
  for (const [field, maxLen] of Object.entries(MAX_FIELD_LENGTHS)) {
    if (req.body[field] && typeof req.body[field] === 'string' && req.body[field].length > maxLen) {
      return res.status(400).json({
        error: `Field '${field}' exceeds maximum length of ${maxLen} characters`,
      });
    }
  }
  
  next();
}

/**
 * Rate limit aşıldığında IP loglama
 */
function rateLimitLogger(req, res, next) {
  const originalEnd = res.end;
  res.end = function (...args) {
    if (res.statusCode === 429) {
      console.warn(`[RATE-LIMIT] Rate limit exceeded for ${req.ip}:`, {
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent'],
        time: new Date().toISOString(),
      });
    }
    return originalEnd.apply(this, args);
  };
  next();
}

/**
 * DDoS Koruması - Anlık istek sayısını takip eder
 * Aynı IP'den saniyede çok fazla istek gelirse engeller
 */
const ddosTracker = new Map(); // ip -> { count, resetAt }

function ddosProtection(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  
  if (!ddosTracker.has(ip)) {
    ddosTracker.set(ip, { count: 1, resetAt: now + 1000 }); // 1 saniye
    return next();
  }
  
  const record = ddosTracker.get(ip);
  
  // Süre dolduysa sıfırla
  if (now > record.resetAt) {
    ddosTracker.set(ip, { count: 1, resetAt: now + 1000 });
    return next();
  }
  
  record.count++;
  
  // Saniyede 30+ istek = DDoS şüphesi
  if (record.count > 30) {
    ipBanList.recordAttempt(ip, req.path);
    
    // Saniyede 50+ istek = direk IP ban (1 saat)
    if (record.count > 50) {
      ipBanList.ban(ip, 'DDoS attack detected', 60 * 60 * 1000);
      logSecurityEvent('ddos_attack', { count: record.count, window: '1s' }, req);
    }
    
    return res.status(429).json({
      error: 'Too many requests. Please slow down.',
      code: 'RATE_LIMITED',
      retryAfter: 1,
    });
  }
  
  next();
}

// DDoS tracker temizliği (her 10 saniyede bir)
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ddosTracker.entries()) {
    if (now > record.resetAt + 5000) { // 5 saniye geçmiş kayıtları temizle
      ddosTracker.delete(ip);
    }
  }
}, 10000);

/**
 * IP Ban kontrol middleware'i
 * Banlı IP'lerden gelen istekleri engeller
 */
function ipBanCheck(req, res, next) {
  const ip = req.ip;
  
  if (ipBanList.isBanned(ip)) {
    const remaining = ipBanList.getBanTimeRemaining(ip);
    const seconds = Math.ceil(remaining / 1000);
    
    return res.status(403).json({
      error: `Your IP has been temporarily blocked. Try again in ${seconds} seconds.`,
      code: 'IP_BANNED',
      retryAfter: seconds,
    });
  }
  
  next();
}

/**
 * Güvenlik header'larını ekler (helmet dışında ekstra)
 */
function securityHeaders(req, res, next) {
  // Content-Type koklama önleme
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Referrer politikası
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permission politikası
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  
  // Cross-Origin kaynak paylaşımı
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  
  // XSS koruması (eski tarayıcılar için)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Cache kontrol (dinamik içerik)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Content-Security-Policy (backend için)
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'");
  
  next();
}

/**
 * Hata yakalama ve güvenli hata mesajları
 */
function errorHandler(err, req, res, next) {
  // Hata tipine göre güvenli mesaj
  let statusCode = 500;
  let message = 'Internal server error';
  let details = null;
  
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  } else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid or expired token';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    message = err.message;
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = err.message;
  } else if (err.name === 'RateLimitError') {
    statusCode = 429;
    message = 'Too many requests';
  } else if (err.code === '23505') { // PostgreSQL unique violation
    statusCode = 409;
    message = 'Resource already exists';
  } else if (err.code === '23503') { // PostgreSQL foreign key violation
    statusCode = 400;
    message = 'Referenced resource not found';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON in request body';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body too large';
  }
  
  // Geliştirme ortamında detay göster
  if (process.env.NODE_ENV === 'development') {
    details = err.message;
    console.error('[ERROR]', err);
  } else {
    // Production'da sadece önemli hataları logla
    if (statusCode === 500) {
      console.error('[ERROR]', {
        message: err.message,
        stack: err.stack?.split('\n').slice(0, 3).join('\n'),
        ip: req.ip,
        path: req.path,
        method: req.method,
        time: new Date().toISOString(),
      });
    }
  }
  
  res.status(statusCode).json({
    error: message,
    ...(details && { details }),
    ...(statusCode === 429 && { retryAfter: 'Retry after 15 minutes' }),
  });
}

/**
 * Request ID ekle (traceability için)
 */
function requestId(req, res, next) {
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
}

/**
 * Request logger (güvenlik odaklı)
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  const originalEnd = res.end;
  
  res.end = function (...args) {
    const duration = Date.now() - start;
    const logData = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 100),
    };
    
    // 4xx ve 5xx hatalarını logla
    if (res.statusCode >= 400) {
      console.warn(`[REQ] ${JSON.stringify(logData)}`);
    }
    
    // Yavaş istekleri logla (> 2 saniye)
    if (duration > 2000) {
      console.warn(`[SLOW] ${JSON.stringify(logData)}`);
    }
    
    return originalEnd.apply(this, args);
  };
  
  next();
}

module.exports = {
  // Middleware'ler
  inputSanitizer,
  maliciousPatternDetector,
  csrfProtection,
  requestSizeLimiter,
  rateLimitLogger,
  securityHeaders,
  errorHandler,
  requestId,
  requestLogger,
  ddosProtection,
  ipBanCheck,
  
  // Yardımcı fonksiyonlar
  sanitizeString,
  deepSanitize,
  detectMaliciousPatterns,
  deepDetectMalicious,
  generateCsrfToken,
  validateCsrfToken,
  logSecurityEvent,
  
  // Pattern listesi
  SUSPICIOUS_PATTERNS,
  
  // IP Ban listesi
  ipBanList,
};
