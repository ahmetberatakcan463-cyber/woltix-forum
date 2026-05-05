/**
 * Woltix Forum - Gelişmiş Kimlik Doğrulama Middleware'i
 * 
 * Özellikler:
 * - JWT doğrulama ve token blacklisting
 * - Cihaz parmak izi (device fingerprint)
 * - Rate limiting (başarısız giriş denemeleri)
 * - Hesap kilitlenmesi
 * - Rol tabanlı yetkilendirme
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/database');

// ============================================================
// TOKEN BLACKLIST (In-memory, production'da Redis kullan)
// ============================================================

class TokenBlacklist {
  constructor() {
    this.blacklistedTokens = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 15 * 60 * 1000); // 15 dk
  }

  /**
   * Token'ı kara listeye ekle
   */
  add(token, expiresIn = 15 * 60 * 1000) {
    const hash = this._hash(token);
    this.blacklistedTokens.set(hash, Date.now() + expiresIn);
  }

  /**
   * Token kara listede mi kontrol et
   */
  has(token) {
    const hash = this._hash(token);
    return this.blacklistedTokens.has(hash);
  }

  /**
   * Süresi dolmuş token'ları temizle
   */
  cleanup() {
    const now = Date.now();
    for (const [hash, expiry] of this.blacklistedTokens.entries()) {
      if (now > expiry) {
        this.blacklistedTokens.delete(hash);
      }
    }
  }

  /**
   * Token hash'le (güvenlik için)
   */
  _hash(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

const tokenBlacklist = new TokenBlacklist();

// ============================================================
// BAŞARISIZ GİRİŞ DENEMELERİ TAKİBİ
// ============================================================

class LoginAttemptTracker {
  constructor() {
    this.attempts = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000); // 5 dk
  }

  /**
   * Başarısız giriş denemesi kaydet
   */
  recordFailedAttempt(identifier, ip) {
    const key = `${identifier}:${ip}`;
    const now = Date.now();
    
    if (!this.attempts.has(key)) {
      this.attempts.set(key, []);
    }
    
    const attempts = this.attempts.get(key);
    attempts.push(now);
    
    // Sadece son 15 dakikadaki denemeleri tut
    const cutoff = now - 15 * 60 * 1000;
    const recentAttempts = attempts.filter(t => t > cutoff);
    this.attempts.set(key, recentAttempts);
    
    return recentAttempts.length;
  }

  /**
   * Başarılı girişte denemeleri temizle
   */
  clearAttempts(identifier, ip) {
    const key = `${identifier}:${ip}`;
    this.attempts.delete(key);
  }

  /**
   * Hesap kilitli mi kontrol et
   */
  isLocked(identifier, ip) {
    const key = `${identifier}:${ip}`;
    const attempts = this.attempts.get(key);
    if (!attempts) return false;
    
    const now = Date.now();
    const cutoff = now - 15 * 60 * 1000;
    const recentAttempts = attempts.filter(t => t > cutoff);
    
    // 5 başarısız denemeden sonra 15 dakika kilitlenme
    return recentAttempts.length >= 5;
  }

  /**
   * Kilit kalma süresini döndür
   */
  getLockoutTime(identifier, ip) {
    const key = `${identifier}:${ip}`;
    const attempts = this.attempts.get(key);
    if (!attempts || attempts.length < 5) return 0;
    
    const lastAttempt = Math.max(...attempts);
    const lockoutEnd = lastAttempt + 15 * 60 * 1000;
    return Math.max(0, lockoutEnd - Date.now());
  }

  cleanup() {
    const now = Date.now();
    const cutoff = now - 30 * 60 * 1000; // 30 dakikadan eski kayıtları temizle
    
    for (const [key, attempts] of this.attempts.entries()) {
      const recentAttempts = attempts.filter(t => t > cutoff);
      if (recentAttempts.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, recentAttempts);
      }
    }
  }
}

const loginTracker = new LoginAttemptTracker();

// ============================================================
// CİHAZ PARMAK İZİ (DEVICE FINGERPRINT)
// ============================================================

/**
 * İstekten cihaz parmak izi oluştur
 */
function getDeviceFingerprint(req) {
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['sec-ch-ua'] || '',
    req.headers['sec-ch-ua-platform'] || '',
    req.headers['sec-ch-ua-mobile'] || '',
    req.ip,
  ];
  
  return crypto
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex');
}

// ============================================================
// ANA MIDDLEWARE FONKSİYONLARI
// ============================================================

/**
 * Auth middleware - JWT doğrulama
 * Token'ı Authorization header'dan alır, doğrular ve req.user'a ekler
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7);
  
  if (!token || token.length < 10) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  // Token blacklist kontrolü
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ error: 'Token has been revoked' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      maxAge: '15m',
    });
    
    req.user = {
      id: payload.id,
      username: payload.username,
      role: payload.role,
    };
    
    // Cihaz parmak izi
    req.deviceFingerprint = getDeviceFingerprint(req);
    
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token', code: 'TOKEN_INVALID' });
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Opsiyonel auth middleware
 * Token varsa doğrular, yoksa req.user = null olarak devam eder
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    
    if (!tokenBlacklist.has(token)) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET, {
          algorithms: ['HS256'],
          maxAge: '15m',
        });
        req.user = {
          id: payload.id,
          username: payload.username,
          role: payload.role,
        };
        req.deviceFingerprint = getDeviceFingerprint(req);
      } catch {
        req.user = null;
      }
    } else {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  
  next();
}

/**
 * Admin yetkilendirme middleware'i
 */
function adminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}

/**
 * Moderatör yetkilendirme middleware'i
 */
function modMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({ error: 'Moderator access required' });
  }
  
  next();
}

/**
 * Hesap ban kontrolü middleware'i
 */
async function banCheckMiddleware(req, res, next) {
  if (!req.user) return next();
  
  try {
    const result = await pool.query(
      'SELECT is_banned, ban_reason FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length > 0 && result.rows[0].is_banned) {
      return res.status(403).json({
        error: `Account banned: ${result.rows[0].ban_reason || 'Contact administrator'}`,
        code: 'ACCOUNT_BANNED',
      });
    }
    
    next();
  } catch {
    next();
  }
}

/**
 * Refresh token doğrulama ve döndürme
 */
async function validateAndRotateRefreshToken(refreshToken, userId) {
  if (!refreshToken) {
    return { valid: false, error: 'Refresh token required' };
  }
  
  try {
    const result = await pool.query(
      `SELECT rt.*, u.id as uid, u.username, u.role, u.is_banned
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token = $1 AND rt.expires_at > NOW()`,
      [refreshToken]
    );
    
    if (!result.rows[0]) {
      return { valid: false, error: 'Invalid or expired refresh token' };
    }
    
    const row = result.rows[0];
    
    // Ban kontrolü
    if (row.is_banned) {
      // Banlı kullanıcının tüm token'larını temizle
      await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [row.uid]);
      return { valid: false, error: 'Account is banned' };
    }
    
    // Eski token'ı sil
    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    
    // Yeni token'lar oluştur
    const { generateTokens } = require('../routes/auth');
    const tokens = generateTokens({ id: row.uid, username: row.username, role: row.role });
    
    // Yeni refresh token'ı kaydet
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [row.uid, tokens.refreshToken, expiresAt]
    );
    
    return { valid: true, tokens, user: { id: row.uid, username: row.username, role: row.role } };
  } catch (err) {
    console.error('[AUTH] Refresh token error:', err.message);
    return { valid: false, error: 'Token refresh failed' };
  }
}

module.exports = {
  authMiddleware,
  optionalAuth,
  adminMiddleware,
  modMiddleware,
  banCheckMiddleware,
  validateAndRotateRefreshToken,
  tokenBlacklist,
  loginTracker,
  getDeviceFingerprint,
};
