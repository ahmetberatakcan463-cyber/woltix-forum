import { NextResponse } from 'next/server';

// ============================================
// WOLTIX FORUM - GELİŞMİŞ GÜVENLİK MIDDLEWARE
// ============================================

// In-memory rate limiter
const rateLimitMap = new Map();
const ipBanMap = new Map(); // IP ban listesi

// Rate limit temizliği - her 1 dakikada bir
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
  // Süresi dolmuş banları temizle
  for (const [ip, ban] of ipBanMap.entries()) {
    if (now > ban.expiresAt) {
      ipBanMap.delete(ip);
    }
  }
}, 60000);

/**
 * IP ban kontrolü
 */
function checkIpBan(ip) {
  const ban = ipBanMap.get(ip);
  if (!ban) return null;
  if (Date.now() > ban.expiresAt) {
    ipBanMap.delete(ip);
    return null;
  }
  return ban;
}

/**
 * IP'yi geçici olarak banla
 */
function banIp(ip, reason, durationMs = 15 * 60 * 1000) {
  ipBanMap.set(ip, {
    reason,
    expiresAt: Date.now() + durationMs,
  });
  console.warn(`[WOLTIX-BAN] IP banned: ${ip} - ${reason}`);
}

/**
 * Rate limiting kontrolü (gelişmiş)
 */
function checkRateLimit(ip, pathname) {
  const now = Date.now();
  
  // Rate limit kuralları (sıkılaştırılmış)
  const rules = [
    { path: '/auth/login', maxRequests: 5, windowMs: 60000, banAfter: 10 },       // 5/dk, 10'da ban
    { path: '/auth/register', maxRequests: 3, windowMs: 300000, banAfter: 6 },     // 3/5dk, 6'da ban
    { path: '/admin', maxRequests: 30, windowMs: 60000, banAfter: 50 },            // 30/dk admin
    { path: '/api/', maxRequests: 60, windowMs: 60000, banAfter: 100 },            // 60/dk API
    { path: '/', maxRequests: 200, windowMs: 60000, banAfter: 300 },               // 200/dk genel
  ];
  
  for (const rule of rules) {
    if (pathname.startsWith(rule.path)) {
      const key = `${ip}:${rule.path}`;
      const record = rateLimitMap.get(key);
      
      if (record && now < record.resetTime) {
        record.count++;
        
        // Ban eşiği aşıldıysa IP'yi banla
        if (record.count >= rule.banAfter) {
          banIp(ip, `Rate limit exceeded on ${rule.path} (${record.count} requests)`, 30 * 60 * 1000);
          return {
            limited: true,
            banned: true,
            retryAfter: 1800,
            limit: rule.maxRequests,
            remaining: 0,
          };
        }
        
        if (record.count > rule.maxRequests) {
          return {
            limited: true,
            banned: false,
            retryAfter: Math.ceil((record.resetTime - now) / 1000),
            limit: rule.maxRequests,
            remaining: 0,
          };
        }
        return {
          limited: false,
          banned: false,
          limit: rule.maxRequests,
          remaining: rule.maxRequests - record.count,
        };
      } else {
        rateLimitMap.set(key, { count: 1, resetTime: now + rule.windowMs });
        return {
          limited: false,
          banned: false,
          limit: rule.maxRequests,
          remaining: rule.maxRequests - 1,
        };
      }
    }
  }
  
  return { limited: false, banned: false };
}

/**
 * Şüpheli istek pattern'lerini tespit et (gelişmiş)
 */
function detectSuspiciousActivity(request) {
  const suspiciousPatterns = [
    // SQL Injection
    { pattern: /union.*select/i, type: 'SQL Injection' },
    { pattern: /select.*from/i, type: 'SQL Injection' },
    { pattern: /insert.*into/i, type: 'SQL Injection' },
    { pattern: /delete.*from/i, type: 'SQL Injection' },
    { pattern: /drop\s+table/i, type: 'SQL Injection' },
    { pattern: /truncate\s+table/i, type: 'SQL Injection' },
    { pattern: /alter\s+table/i, type: 'SQL Injection' },
    { pattern: /create\s+table/i, type: 'SQL Injection' },
    { pattern: /exec\s*\(/i, type: 'SQL Injection' },
    { pattern: /execute\s*\(/i, type: 'SQL Injection' },
    { pattern: /pg_sleep/i, type: 'SQL Injection Time-based' },
    { pattern: /waitfor\s+delay/i, type: 'SQL Injection Time-based' },
    { pattern: /sleep\s*\(/i, type: 'SQL Injection Time-based' },
    { pattern: /benchmark\s*\(/i, type: 'SQL Injection Time-based' },
    { pattern: /\/\*!/i, type: 'SQL Injection' },
    { pattern: /--\s*$/m, type: 'SQL Injection' },
    { pattern: /';/i, type: 'SQL Injection' },
    { pattern: /1=1/i, type: 'SQL Injection' },
    { pattern: /1=2/i, type: 'SQL Injection' },
    { pattern: /'or'/i, type: 'SQL Injection' },
    { pattern: /'and'/i, type: 'SQL Injection' },
    { pattern: /information_schema/i, type: 'SQL Injection' },
    
    // XSS
    { pattern: /<script/i, type: 'XSS' },
    { pattern: /<iframe/i, type: 'XSS' },
    { pattern: /<embed/i, type: 'XSS' },
    { pattern: /<object/i, type: 'XSS' },
    { pattern: /<svg/i, type: 'XSS' },
    { pattern: /<img[^>]*onerror/i, type: 'XSS' },
    { pattern: /<body[^>]*onload/i, type: 'XSS' },
    { pattern: /javascript\s*:/i, type: 'XSS' },
    { pattern: /eval\s*\(/i, type: 'Code Injection' },
    { pattern: /document\.cookie/i, type: 'XSS' },
    { pattern: /document\.location/i, type: 'XSS' },
    { pattern: /window\.location/i, type: 'XSS' },
    { pattern: /onerror\s*=/i, type: 'XSS' },
    { pattern: /onload\s*=/i, type: 'XSS' },
    { pattern: /onclick\s*=/i, type: 'XSS' },
    { pattern: /onmouseover\s*=/i, type: 'XSS' },
    { pattern: /onfocus\s*=/i, type: 'XSS' },
    { pattern: /onblur\s*=/i, type: 'XSS' },
    { pattern: /onchange\s*=/i, type: 'XSS' },
    { pattern: /onsubmit\s*=/i, type: 'XSS' },
    { pattern: /alert\s*\(/i, type: 'XSS' },
    { pattern: /prompt\s*\(/i, type: 'XSS' },
    { pattern: /confirm\s*\(/i, type: 'XSS' },
    { pattern: /fetch\s*\(/i, type: 'XSS' },
    { pattern: /XMLHttpRequest/i, type: 'XSS' },
    
    // Path Traversal
    { pattern: /\.\.\/\.\.\//, type: 'Path Traversal' },
    { pattern: /\.\.%2f/i, type: 'Path Traversal' },
    { pattern: /\.\.%5c/i, type: 'Path Traversal' },
    { pattern: /\/proc\//i, type: 'Path Traversal' },
    { pattern: /\/etc\/passwd/i, type: 'Path Traversal' },
    { pattern: /\/etc\/shadow/i, type: 'Path Traversal' },
    { pattern: /\/\.git\//i, type: 'Sensitive File' },
    { pattern: /\/\.env/i, type: 'Sensitive File' },
    { pattern: /\/\.aws\//i, type: 'Sensitive File' },
    { pattern: /\/\.ssh\//i, type: 'Sensitive File' },
    { pattern: /id_rsa/i, type: 'Sensitive File' },
    { pattern: /id_dsa/i, type: 'Sensitive File' },
    { pattern: /\.pem/i, type: 'Sensitive File' },
    { pattern: /\.key/i, type: 'Sensitive File' },
    
    // Command Injection
    { pattern: /;\s*(rm|wget|curl|nc|bash|sh|python|perl)/i, type: 'Command Injection' },
    { pattern: /`.*`/i, type: 'Command Injection' },
    { pattern: /\$\(.*\)/i, type: 'Command Injection' },
    { pattern: /\$\{.*\}/i, type: 'Command Injection' },
    { pattern: /powershell/i, type: 'Command Injection' },
    { pattern: /cmd\.exe/i, type: 'Command Injection' },
    
    // Null Byte
    { pattern: /%00/i, type: 'Null Byte Injection' },
    { pattern: /\\x00/i, type: 'Null Byte Injection' },
    
    // Admin Attack Patterns
    { pattern: /admin.*delete/i, type: 'Admin Attack' },
    { pattern: /admin.*drop/i, type: 'Admin Attack' },
    { pattern: /admin.*truncate/i, type: 'Admin Attack' },
    { pattern: /admin.*update.*set.*role/i, type: 'Privilege Escalation' },
    { pattern: /admin.*password/i, type: 'Admin Attack' },
  ];
  
  const url = request.url;
  const searchParams = request.nextUrl.search;
  const pathname = request.nextUrl.pathname;
  const fullUrl = url + searchParams;
  
  for (const { pattern, type } of suspiciousPatterns) {
    if (pattern.test(fullUrl)) {
      return { suspicious: true, type, pattern: pattern.source };
    }
  }
  
  return { suspicious: false };
}

/**
 * Ana middleware fonksiyonu
 */
export function middleware(request) {
  const pathname = request.nextUrl.pathname;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || request.headers.get('cf-connecting-ip')
    || '127.0.0.1';
  
  // ============================================
  // 0. IP BAN KONTROLÜ
  // ============================================
  const ban = checkIpBan(ip);
  if (ban) {
    const remaining = Math.ceil((ban.expiresAt - Date.now()) / 1000);
    return new NextResponse(
      JSON.stringify({ error: 'IP temporarily blocked', retryAfter: remaining }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(remaining),
        },
      }
    );
  }
  
  const response = NextResponse.next();
  
  // ============================================
  // 1. ŞÜPHELİ AKTİVİTE KONTROLÜ
  // ============================================
  const suspicious = detectSuspiciousActivity(request);
  if (suspicious.suspicious) {
    console.warn(`[WOLTIX-SECURITY] 🚨 Şüpheli aktivite tespit edildi!`, {
      ip,
      path: pathname,
      type: suspicious.type,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent')?.substring(0, 100),
    });
    
    // Tüm şüpheli istekleri engelle
    return new NextResponse(
      JSON.stringify({ error: 'Request blocked: Suspicious content detected' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  
  // ============================================
  // 2. RATE LIMITING
  // ============================================
  const rateLimitResult = checkRateLimit(ip, pathname);
  
  response.headers.set('X-RateLimit-Limit', String(rateLimitResult.limit || ''));
  response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining || ''));
  
  if (rateLimitResult.limited) {
    console.warn(`[WOLTIX-SECURITY] ⚠️ Rate limit aşıldı!`, {
      ip,
      path: pathname,
      banned: rateLimitResult.banned,
      retryAfter: rateLimitResult.retryAfter,
      timestamp: new Date().toISOString(),
    });
    
    return new NextResponse(
      JSON.stringify({
        error: rateLimitResult.banned ? 'IP temporarily blocked' : 'Too Many Requests',
        retryAfter: rateLimitResult.retryAfter,
      }),
      {
        status: rateLimitResult.banned ? 403 : 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimitResult.retryAfter),
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }
  
  // ============================================
  // 3. GÜVENLİK HEADER'LARI
  // ============================================
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  
  // Teknoloji bilgisini gizle
  response.headers.delete('x-powered-by');
  
  // ============================================
  // 4. API ROUTE KORUMASI
  // ============================================
  if (pathname.startsWith('/api/')) {
    const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    if (!allowedMethods.includes(request.method)) {
      return new NextResponse('Method Not Allowed', { status: 405 });
    }
    
    // Content-Type kontrolü
    const contentType = request.headers.get('content-type') || '';
    if (['POST', 'PUT', 'PATCH'].includes(request.method) &&
        !contentType.includes('application/json') &&
        !contentType.includes('multipart/form-data') &&
        !contentType.includes('application/x-www-form-urlencoded')) {
      return new NextResponse('Unsupported Media Type', { status: 415 });
    }
  }
  
  // ============================================
  // 5. HASSAS PATH'LERİ ENGELLE
  // ============================================
  const blockedPaths = [
    '/.env', '/.git', '/.gitignore', '/.htaccess',
    '/.env.local', '/.env.production', '/.env.development',
    '/wp-admin', '/wp-login', '/wp-content',
    '/server-status', '/server-info',
    '/backup', '/config', '/database',
    '/robots.txt', '/sitemap.xml',
    '/crossdomain.xml', '/clientaccesspolicy.xml',
    '/WEB-INF', '/META-INF',
    '/node_modules', '/vendor',
    '/.npmrc', '/.yarnrc',
    '/docker-compose.yml', '/Dockerfile',
    '/nginx.conf', '/.htpasswd',
  ];
  
  for (const blockedPath of blockedPaths) {
    if (pathname === blockedPath || pathname.startsWith(blockedPath + '/')) {
      return new NextResponse('Not Found', { status: 404 });
    }
  }
  
  // ============================================
  // 6. REFERER KONTROLÜ (API için)
  // ============================================
  if (pathname.startsWith('/api/') && request.method !== 'GET') {
    const referer = request.headers.get('referer') || '';
    const origin = request.headers.get('origin') || '';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Sadece kendi domain'imizden gelen state-changing isteklere izin ver
    if (referer && !referer.startsWith(appUrl) && !referer.includes('localhost')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }
  
  return response;
}

/**
 * Middleware'in hangi path'lerde çalışacağı
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
