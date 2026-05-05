/**
 * Woltix Forum - Gelişmiş Kimlik Doğrulama Rotaları
 * 
 * Özellikler:
 * - Güçlü şifre politikası (en az 8 karakter, büyük/küçük harf, rakam, özel karakter)
 * - Hesap kilitlenmesi (5 başarısız denemeden sonra 15 dk)
 * - JWT access token (15 dk) + refresh token (7 gün) rotasyonu
 * - Opsiyonel TOTP 2FA
 * - Token blacklisting (çıkış yapınca token geçersiz)
 * - Cihaz parmak izi takibi
 * - Rate limiting (IP başına)
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { authMiddleware, loginTracker, tokenBlacklist, getDeviceFingerprint } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// YARDIMCI FONKSİYONLAR
// ============================================================

/**
 * JWT access token ve refresh token oluştur
 */
function generateTokens(user) {
  const payload = { 
    id: user.id, 
    username: user.username, 
    role: user.role 
  };
  
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { 
    expiresIn: '15m',
    algorithm: 'HS256',
  });
  
  const refreshToken = crypto.randomBytes(64).toString('hex');
  
  return { accessToken, refreshToken };
}

/**
 * Kullanıcı rank'ını post sayısına göre hesapla
 */
function getUserRank(postCount) {
  if (postCount >= 2501) return 'Legend';
  if (postCount >= 1001) return 'Elite';
  if (postCount >= 501) return 'Expert';
  if (postCount >= 201) return 'Veteran';
  if (postCount >= 51) return 'Regular';
  if (postCount >= 11) return 'Member';
  return 'Newbie';
}

/**
 * Şifre gücü kontrolü
 * En az 8 karakter, en az 1 büyük harf, 1 küçük harf, 1 rakam, 1 özel karakter
 */
function validatePasswordStrength(password) {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Yaygın şifreleri kontrol et
  const commonPasswords = [
    'password', 'password123', '12345678', 'qwerty123', 'admin123',
    'letmein', 'welcome', 'monkey', 'dragon', 'master',
  ];
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('This password is too common. Please choose a stronger password');
  }
  
  return errors;
}

/**
 * Email formatı doğrulama
 */
function validateEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return 'Invalid email format';
  }
  if (email.length > 254) {
    return 'Email too long';
  }
  return null;
}

/**
 * Kullanıcı adı doğrulama
 */
function validateUsername(username) {
  if (username.length < 3 || username.length > 30) {
    return 'Username must be 3-30 characters';
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return 'Username can only contain letters, numbers, underscores and hyphens';
  }
  // Rezerve edilmiş kullanıcı adları
  const reservedUsernames = [
    'admin', 'administrator', 'moderator', 'mod', 'system', 'root',
    'woltix', 'support', 'help', 'info', 'contact', 'api', 'null',
    'undefined', 'true', 'false', 'anonymous',
  ];
  if (reservedUsernames.includes(username.toLowerCase())) {
    return 'This username is reserved';
  }
  return null;
}

// ============================================================
// ROTALAR
// ============================================================

/**
 * POST /api/auth/register
 * Yeni kullanıcı kaydı
 */
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  // Validasyon
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Kullanıcı adı validasyonu
  const usernameError = validateUsername(username);
  if (usernameError) {
    return res.status(400).json({ error: usernameError });
  }

  // Email validasyonu
  const emailError = validateEmail(email);
  if (emailError) {
    return res.status(400).json({ error: emailError });
  }

  // Şifre gücü validasyonu
  const passwordErrors = validatePasswordStrength(password);
  if (passwordErrors.length > 0) {
    return res.status(400).json({ error: passwordErrors[0] });
  }

  try {
    // Mevcut kullanıcı kontrolü
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username.toLowerCase(), email.toLowerCase()]
    );
    
    if (existing.rows.length > 0) {
      // Hangi alanın çakıştığını söyleme (güvenlik)
      return res.status(409).json({ error: 'Username or email already taken' });
    }

    // Şifre hash'leme (12 round - yüksek güvenlik)
    const hash = await bcrypt.hash(password, 12);
    
    // Kullanıcı oluşturma
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash) 
       VALUES ($1, $2, $3) 
       RETURNING id, username, email, role, rank`,
      [username.toLowerCase(), email.toLowerCase(), hash]
    );

    const user = result.rows[0];
    const { accessToken, refreshToken } = generateTokens(user);

    // Refresh token'ı veritabanına kaydet
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    // Başarılı kayıt log'u
    console.log(`[AUTH] New user registered: ${user.username} (ID: ${user.id})`);

    res.status(201).json({ 
      accessToken, 
      refreshToken, 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        role: user.role, 
        rank: user.rank 
      } 
    });
  } catch (err) {
    console.error('[AUTH] Registration error:', err.message);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

/**
 * POST /api/auth/login
 * Kullanıcı girişi (hesap kilitlenmesi desteği ile)
 */
router.post('/login', async (req, res) => {
  const { username, password, totpCode } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const ip = req.ip;
  const identifier = username.toLowerCase();

  // Hesap kilitli mi kontrol et
  if (loginTracker.isLocked(identifier, ip)) {
    const lockoutTime = loginTracker.getLockoutTime(identifier, ip);
    const minutes = Math.ceil(lockoutTime / 60000);
    return res.status(429).json({ 
      error: `Account temporarily locked. Try again in ${minutes} minute(s).`,
      code: 'ACCOUNT_LOCKED',
      retryAfter: Math.ceil(lockoutTime / 1000),
    });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [identifier]
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      // Başarısız deneme kaydı
      const attempts = loginTracker.recordFailedAttempt(identifier, ip);
      
      console.warn(`[AUTH] Failed login attempt for '${identifier}' from ${ip} (${attempts}/5)`);
      
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Ban kontrolü
    if (user.is_banned) {
      return res.status(403).json({ 
        error: `Account suspended: ${user.ban_reason || 'Contact administrator'}`,
        code: 'ACCOUNT_BANNED',
      });
    }

    // 2FA kontrolü
    if (user.totp_enabled) {
      if (!totpCode) {
        return res.status(200).json({ requires2FA: true });
      }
      
      const valid = authenticator.verify({ token: totpCode, secret: user.totp_secret });
      if (!valid) {
        const attempts = loginTracker.recordFailedAttempt(identifier, ip);
        return res.status(401).json({ error: 'Invalid 2FA code' });
      }
    }

    // Başarılı giriş - denemeleri temizle
    loginTracker.clearAttempts(identifier, ip);

    // Son görülme zamanını güncelle
    await pool.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [user.id]);

    // Token oluştur
    const { accessToken, refreshToken } = generateTokens(user);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    console.log(`[AUTH] User logged in: ${user.username} (ID: ${user.id})`);

    res.json({
      accessToken,
      refreshToken,
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        role: user.role, 
        rank: user.rank, 
        avatar_url: user.avatar_url 
      },
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh token ile yeni access token al
 */
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
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
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const row = result.rows[0];

    // Ban kontrolü
    if (row.is_banned) {
      await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [row.uid]);
      return res.status(403).json({ error: 'Account is banned', code: 'ACCOUNT_BANNED' });
    }

    // Eski token'ı sil (token rotasyonu)
    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);

    // Yeni token'lar oluştur
    const { accessToken, refreshToken: newRefresh } = generateTokens({ 
      id: row.uid, 
      username: row.username, 
      role: row.role 
    });
    
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [row.uid, newRefresh, expiresAt]
    );

    res.json({ accessToken, refreshToken: newRefresh });
  } catch (err) {
    console.error('[AUTH] Token refresh error:', err.message);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * POST /api/auth/logout
 * Çıkış yap - refresh token'ı sil ve access token'ı blacklist'e ekle
 */
router.post('/logout', authMiddleware, async (req, res) => {
  const { refreshToken } = req.body;
  
  try {
    // Refresh token'ı sil
    if (refreshToken) {
      await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }
    
    // Access token'ı blacklist'e ekle
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      tokenBlacklist.add(token);
    }
    
    console.log(`[AUTH] User logged out: ${req.user.username} (ID: ${req.user.id})`);
    
    res.json({ message: 'Successfully logged out' });
  } catch (err) {
    console.error('[AUTH] Logout error:', err.message);
    res.json({ message: 'Logged out' });
  }
});

/**
 * POST /api/auth/logout/all
 * Tüm cihazlardan çıkış yap
 */
router.post('/logout/all', authMiddleware, async (req, res) => {
  try {
    // Kullanıcının tüm refresh token'larını sil
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.user.id]);
    
    console.log(`[AUTH] User logged out from all devices: ${req.user.username} (ID: ${req.user.id})`);
    
    res.json({ message: 'Logged out from all devices' });
  } catch (err) {
    console.error('[AUTH] Logout all error:', err.message);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /api/auth/me
 * Mevcut kullanıcı bilgilerini getir
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, role, rank, avatar_url, bio, website, 
              signature, post_count, thread_count, reputation, 
              totp_enabled, last_seen, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[AUTH] Get profile error:', err.message);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ============================================================
// 2FA (İKİ FAKTÖRLÜ KİMLİK DOĞRULAMA) ROTALARI
// ============================================================

/**
 * GET /api/auth/2fa/setup
 * 2FA kurulumu için secret ve QR kod oluştur
 */
router.get('/2fa/setup', authMiddleware, async (req, res) => {
  try {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(req.user.username, 'Woltix Forum', secret);
    const qrCode = await QRCode.toDataURL(otpauth);

    // Secret'ı geçici olarak kaydet (verify edilene kadar enabled değil)
    await pool.query(
      'UPDATE users SET totp_secret = $1, totp_enabled = FALSE WHERE id = $2',
      [secret, req.user.id]
    );

    res.json({ secret, qrCode });
  } catch (err) {
    console.error('[AUTH] 2FA setup error:', err.message);
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
});

/**
 * POST /api/auth/2fa/verify
 * 2FA kodunu doğrula ve aktifleştir
 */
router.post('/2fa/verify', authMiddleware, async (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Verification code required' });
  }

  try {
    const result = await pool.query(
      'SELECT totp_secret FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];

    if (!user || !user.totp_secret) {
      return res.status(400).json({ error: '2FA not set up. Please setup first.' });
    }

    const valid = authenticator.verify({ token: code, secret: user.totp_secret });
    if (!valid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    await pool.query(
      'UPDATE users SET totp_enabled = TRUE WHERE id = $1',
      [req.user.id]
    );

    console.log(`[AUTH] 2FA enabled for user: ${req.user.username}`);
    
    res.json({ message: '2FA successfully enabled' });
  } catch (err) {
    console.error('[AUTH] 2FA verify error:', err.message);
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

/**
 * DELETE /api/auth/2fa
 * 2FA'yı devre dışı bırak
 */
router.delete('/2fa', authMiddleware, async (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Verification code required to disable 2FA' });
  }

  try {
    const result = await pool.query(
      'SELECT totp_secret FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];

    if (!user || !user.totp_secret) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    const valid = authenticator.verify({ token: code, secret: user.totp_secret });
    if (!valid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    await pool.query(
      'UPDATE users SET totp_secret = NULL, totp_enabled = FALSE WHERE id = $1',
      [req.user.id]
    );

    console.log(`[AUTH] 2FA disabled for user: ${req.user.username}`);
    
    res.json({ message: '2FA successfully disabled' });
  } catch (err) {
    console.error('[AUTH] 2FA disable error:', err.message);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

module.exports = router;
module.exports.generateTokens = generateTokens;
