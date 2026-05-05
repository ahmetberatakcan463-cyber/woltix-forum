require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initializeDatabase } = require('./config/database');
const {
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
} = require('./middleware/security');

const app = express();

// ============================================================
// GÜVENLİK YAPILANDIRMASI
// ============================================================

// Trust proxy (Railway, Cloudflare vb. için)
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

// ============================================================
// HELMET - Güvenlik Header'ları (Sıkılaştırılmış)
// ============================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://challenges.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'https://api.cloudflare.com', 'https://*.railway.app'],
      frameSrc: ["'self'", 'https://challenges.cloudflare.com'],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'", 'blob:'],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: { policy: 'require-corp' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 63072000, // 2 yıl
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));

// ============================================================
// CORS - Güvenli Cross-Origin
// ============================================================
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://woltix-frontend-production.up.railway.app',
];

app.use(cors({
  origin: function (origin, callback) {
    // Sunucudan sunucuya isteklere izin ver
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Wildcard ile biten domain'lere izin ver (alt domainler)
    if (origin.endsWith('.railway.app') || origin.endsWith('.railway.internal')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'Retry-After'],
  maxAge: 86400, // 24 saat preflight cache
}));

// ============================================================
// BODY PARSER - Güvenli Limitler
// ============================================================
app.use(express.json({
  limit: '1mb', // 5mb'den 1mb'ye düşürüldü
  verify: (req, res, buf) => {
    // JSON body boyutunu kontrol et
    if (buf.length > 1024 * 1024) { // 1MB
      throw new Error('Request body too large');
    }
  },
}));

app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// ============================================================
// DDoS KORUMASI & IP BAN CHECK (En önce çalışır)
// ============================================================
app.use(ddosProtection);
app.use(ipBanCheck);

// ============================================================
// REQUEST ID & LOGGING
// ============================================================
app.use(requestId);
app.use(requestLogger);

// ============================================================
// EK GÜVENLİK HEADER'LARI
// ============================================================
app.use(securityHeaders);

// ============================================================
// INPUT SANITIZATION & MALICIOUS PATTERN DETECTION
// ============================================================
app.use(inputSanitizer);
app.use(maliciousPatternDetector);

// ============================================================
// RATE LIMITING - Çok Katmanlı (Sıkılaştırılmış)
// ============================================================

// Global rate limit - tüm API (sıkılaştırıldı)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 200, // 300'den 200'e düşürüldü
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
  keyGenerator: (req) => req.ip,
});

// Auth rate limit - giriş (çok sıkı)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 5, // 10'dan 5'e düşürüldü
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
  keyGenerator: (req) => req.ip,
  skipSuccessfulRequests: false,
});

// Strict auth rate limit - IP başına (çok sıkı)
const strictAuthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 10, // 20'den 10'a düşürüldü
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Account temporarily locked.' },
  keyGenerator: (req) => req.ip,
});

// Thread/Post oluşturma limiti
const writeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 30, // 50'den 30'a düşürüldü
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'You have reached the posting limit. Please slow down.' },
  keyGenerator: (req) => req.user?.id || req.ip,
});

// Admin rate limit (sıkılaştırıldı)
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 60, // 100'den 60'a düşürüldü
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin requests.' },
  keyGenerator: (req) => req.user?.id || req.ip,
});

// API rate limit - genel API kullanımı
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 60, // Dakikada max 60 istek
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'API rate limit exceeded.' },
  keyGenerator: (req) => req.ip,
});

app.use('/api', globalLimiter);
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', strictAuthLimiter);
app.use('/api/auth', rateLimitLogger);
app.use('/api/threads', writeLimiter);
app.use('/api/admin', adminLimiter);

// ============================================================
// CSRF KORUMASI
// ============================================================
app.use('/api', csrfProtection);

// ============================================================
// REQUEST SIZE LIMITER
// ============================================================
app.use('/api', requestSizeLimiter);

// ============================================================
// ROUTES
// ============================================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/threads', require('./routes/threads'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/search', require('./routes/search'));
app.use('/api/admin', require('./routes/admin'));

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// ============================================================
// 404 - Bulunamayan Rotalar
// ============================================================
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ============================================================
// HATA YAKALAMA
// ============================================================
app.use(errorHandler);

// ============================================================
// SUNUCU BAŞLATMA
// ============================================================
const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await initializeDatabase();
    
    // Redis bağlantısı (opsiyonel)
    if (process.env.REDIS_URL) {
      try {
        const Redis = require('ioredis');
        const redis = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => Math.min(times * 50, 2000),
        });
        redis.on('error', (err) => console.warn('[REDIS] Connection error:', err.message));
        redis.on('connect', () => console.log('[REDIS] Connected'));
        app.locals.redis = redis;
      } catch (err) {
        console.warn('[REDIS] Failed to connect, running without Redis');
      }
    }
    
    app.listen(PORT, () => {
      console.log(`[WOLTIX] API running on port ${PORT}`);
      console.log(`[WOLTIX] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[WOLTIX] CORS origin: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    });
  } catch (err) {
    console.error('[WOLTIX] Failed to start:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[WOLTIX] SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[WOLTIX] SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Beklenmeyen hataları yakala
process.on('uncaughtException', (err) => {
  console.error('[WOLTIX] Uncaught exception:', err);
  // Production'da crash etme, sadece logla
  if (process.env.NODE_ENV === 'production') {
    console.error('[WOLTIX] Uncaught exception (non-fatal in production):', err.message);
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[WOLTIX] Unhandled rejection at:', promise, 'reason:', reason);
});

start();
