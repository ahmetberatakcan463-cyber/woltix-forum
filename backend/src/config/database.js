/**
 * Woltix Forum - Gelişmiş Veritabanı Yapılandırması
 * 
 * Özellikler:
 * - SSL ile güvenli bağlantı (production)
 * - Connection pooling
 * - Otomatik yeniden bağlanma
 * - Query timeout
 * - Statement timeout
 * - Audit logging
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// ============================================================
// POOL YAPILANDIRMASI
// ============================================================

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maksimum pool boyutu
  idleTimeoutMillis: 30000, // 30 saniye boşta kalma timeout
  connectionTimeoutMillis: 5000, // 5 saniye bağlantı timeout
  query_timeout: 10000, // 10 saniye query timeout
  statement_timeout: 10000, // 10 saniye statement timeout
};

// Production'da SSL zorunlu
if (process.env.NODE_ENV === 'production') {
  poolConfig.ssl = {
    rejectUnauthorized: true,
    ca: process.env.DB_CA_CERT || undefined,
  };
} else {
  // Development'da opsiyonel SSL
  poolConfig.ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;
}

const pool = new Pool(poolConfig);

// ============================================================
// POOL OLAY DİNLEYİCİLERİ
// ============================================================

pool.on('connect', (client) => {
  console.log('[DB] New client connected to pool');
  
  // Her yeni bağlantıda statement timeout ayarla
  client.query(`SET statement_timeout = '10s'`).catch(err => {
    console.error('[DB] Failed to set statement_timeout:', err.message);
  });
});

pool.on('acquire', (client) => {
  // Bağlantı alındığında
});

pool.on('remove', (client) => {
  console.log('[DB] Client removed from pool');
});

pool.on('error', (err, client) => {
  console.error('[DB] Unexpected pool error:', err.message);
  
  // Hatalı client'ı pool'dan çıkar
  if (client) {
    client.release(true); // true = destroy
  }
});

// ============================================================
// YARDIMCI FONKSİYONLAR
// ============================================================

/**
 * Güvenli query çalıştırma (otomatik hata yönetimi ile)
 */
async function safeQuery(text, params, options = {}) {
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Yavaş query'leri logla
    if (duration > 1000) {
      console.warn(`[DB] Slow query (${duration}ms):`, text.substring(0, 200));
    }
    
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`[DB] Query failed (${duration}ms):`, {
      error: err.message,
      code: err.code,
      detail: err.detail?.substring(0, 200),
      query: text.substring(0, 200),
    });
    throw err;
  }
}

/**
 * Transaction yönetimi için yardımcı
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Pool sağlık kontrolü
 */
async function healthCheck() {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      latency: `${latency}ms`,
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      error: err.message,
    };
  }
}

// ============================================================
// VERİTABANI BAŞLATMA
// ============================================================

async function initializeDatabase() {
  const schemaPath = path.join(__dirname, '../db/schema.sql');
  const seedPath = path.join(__dirname, '../db/seed.sql');

  // Schema dosyasını kontrol et
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }

  try {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('[DB] Schema initialized');
  } catch (err) {
    // Tablolar zaten varsa hata verme
    if (err.code !== '42P07') { // 42P07 = duplicate_table
      throw err;
    }
    console.log('[DB] Schema already exists');
  }

  // Seed data (opsiyonel)
  if (fs.existsSync(seedPath)) {
    try {
      const seed = fs.readFileSync(seedPath, 'utf8');
      await pool.query(seed);
      console.log('[DB] Seed data loaded');
    } catch (err) {
      if (err.code !== '23505') { // 23505 = unique_violation
        console.warn('[DB] Seed data warning:', err.message);
      }
    }
  }

  console.log('[DB] Database initialization complete');
}

module.exports = { 
  pool, 
  initializeDatabase,
  safeQuery,
  withTransaction,
  healthCheck,
};
