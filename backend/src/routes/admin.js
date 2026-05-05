const express = require('express');
const { pool, safeQuery, withTransaction } = require('../config/database');
const { authMiddleware, adminMiddleware, modMiddleware } = require('../middleware/auth');
const { securityEvent } = require('../utils/security');

const router = express.Router();

// ============================================
// DASHBOARD / STATS
// ============================================

// GET /api/admin/stats - Gelişmiş istatistikler
router.get('/stats', authMiddleware, modMiddleware, async (req, res) => {
  try {
    const [users, threads, posts, messages, newToday, newWeek, activeToday, reports] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM threads WHERE is_deleted = FALSE'),
      pool.query('SELECT COUNT(*) FROM posts WHERE is_deleted = FALSE'),
      pool.query('SELECT COUNT(*) FROM private_messages'),
      pool.query("SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours'"),
      pool.query("SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days'"),
      pool.query("SELECT COUNT(*) FROM users WHERE last_seen > NOW() - INTERVAL '24 hours'"),
      pool.query("SELECT COUNT(*) FROM threads WHERE created_at > NOW() - INTERVAL '24 hours'"),
    ]);

    // Kategori bazında thread dağılımı
    const categoryStats = await pool.query(
      `SELECT c.name, c.slug, c.thread_count, c.post_count 
       FROM categories c ORDER BY c.thread_count DESC LIMIT 10`
    );

    // Son 7 günlük kayıt grafiği
    const registrations = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count 
       FROM users WHERE created_at > NOW() - INTERVAL '7 days' 
       GROUP BY DATE(created_at) ORDER BY date`
    );

    res.json({
      total_users: parseInt(users.rows[0].count),
      total_threads: parseInt(threads.rows[0].count),
      total_posts: parseInt(posts.rows[0].count),
      total_messages: parseInt(messages.rows[0].count),
      new_users_today: parseInt(newToday.rows[0].count),
      new_users_week: parseInt(newWeek.rows[0].count),
      active_today: parseInt(activeToday.rows[0].count),
      new_threads_today: parseInt(reports.rows[0].count),
      category_stats: categoryStats.rows,
      registrations: registrations.rows,
    });
  } catch (err) {
    securityEvent('admin_stats_error', 'medium', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ============================================
// KULLANICI YÖNETİMİ
// ============================================

// GET /api/admin/users - Gelişmiş kullanıcı listesi
router.get('/users', authMiddleware, modMiddleware, async (req, res) => {
  const { page = 1, search, role, banned, sort = 'created_at', order = 'DESC' } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const offset = (page - 1) * limit;

  try {
    let query = `SELECT id, username, email, role, rank, is_banned, ban_reason, 
                 post_count, thread_count, reputation, avatar_url, bio, last_seen, created_at
                 FROM users WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (username ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (role) {
      query += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }
    if (banned === 'true') {
      query += ` AND is_banned = TRUE`;
    } else if (banned === 'false') {
      query += ` AND is_banned = FALSE`;
    }

    const allowedSorts = ['created_at', 'username', 'role', 'post_count', 'reputation', 'last_seen'];
    const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortCol} ${sortOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Toplam kullanıcı sayısı
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    
    // Kullanıcıların badge'lerini de getir
    const userIds = result.rows.map(u => u.id);
    let badges = [];
    if (userIds.length > 0) {
      const badgeResult = await pool.query(
        `SELECT ub.*, u.username FROM user_badges ub 
         JOIN users u ON u.id = ub.user_id 
         WHERE ub.user_id = ANY($1) ORDER BY ub.awarded_at DESC`,
        [userIds]
      );
      badges = badgeResult.rows;
    }

    // Badge'leri kullanıcılara ekle
    const usersWithBadges = result.rows.map(u => ({
      ...u,
      badges: badges.filter(b => b.user_id === u.id),
    }));

    res.json({
      users: usersWithBadges,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit,
    });
  } catch (err) {
    securityEvent('admin_users_error', 'medium', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/users/:id - Tek kullanıcı detayı
router.get('/users/:id', authMiddleware, modMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, role, rank, is_banned, ban_reason, 
       post_count, thread_count, reputation, avatar_url, bio, signature, 
       website, last_seen, created_at, totp_enabled
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });

    // Kullanıcının badge'leri
    const badges = await pool.query(
      'SELECT * FROM user_badges WHERE user_id = $1 ORDER BY awarded_at DESC',
      [req.params.id]
    );

    // Kullanıcının son thread'leri
    const threads = await pool.query(
      `SELECT id, title, created_at FROM threads 
       WHERE user_id = $1 AND is_deleted = FALSE 
       ORDER BY created_at DESC LIMIT 5`,
      [req.params.id]
    );

    // Kullanıcının son post'ları
    const posts = await pool.query(
      `SELECT p.id, LEFT(p.content, 100) as content, p.thread_id, p.created_at 
       FROM posts p WHERE p.user_id = $1 AND p.is_deleted = FALSE 
       ORDER BY p.created_at DESC LIMIT 5`,
      [req.params.id]
    );

    res.json({
      ...result.rows[0],
      badges: badges.rows,
      recent_threads: threads.rows,
      recent_posts: posts.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PATCH /api/admin/users/:id/ban
router.patch('/users/:id/ban', authMiddleware, modMiddleware, async (req, res) => {
  const { ban, reason } = req.body;

  try {
    const target = await pool.query('SELECT role, username FROM users WHERE id = $1', [req.params.id]);
    if (!target.rows[0]) return res.status(404).json({ error: 'User not found' });

    if (target.rows[0].role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Cannot ban an admin' });
    }

    await pool.query(
      'UPDATE users SET is_banned = $1, ban_reason = $2 WHERE id = $3',
      [ban, reason || null, req.params.id]
    );

    securityEvent('user_ban', 'high', {
      action: ban ? 'ban' : 'unban',
      targetUserId: parseInt(req.params.id),
      targetUsername: target.rows[0].username,
      reason: reason || null,
      adminId: req.user.id,
    });

    res.json({ message: ban ? 'User banned' : 'User unbanned' });
  } catch (err) {
    res.status(500).json({ error: 'Ban action failed' });
  }
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', authMiddleware, adminMiddleware, async (req, res) => {
  const { role } = req.body;
  if (!['member', 'moderator', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Use: member, moderator, admin' });
  }

  try {
    const target = await pool.query('SELECT username, role FROM users WHERE id = $1', [req.params.id]);
    if (!target.rows[0]) return res.status(404).json({ error: 'User not found' });
    if (target.rows[0].role === 'admin' && req.user.id !== parseInt(req.params.id)) {
      return res.status(403).json({ error: 'Cannot change another admin role' });
    }

    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);

    securityEvent('user_role_change', 'high', {
      targetUserId: parseInt(req.params.id),
      targetUsername: target.rows[0].username,
      oldRole: target.rows[0].role,
      newRole: role,
      adminId: req.user.id,
    });

    res.json({ message: 'Role updated' });
  } catch (err) {
    res.status(500).json({ error: 'Role update failed' });
  }
});

// DELETE /api/admin/users/:id - Kullanıcıyı tamamen sil
router.delete('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const target = await pool.query('SELECT username, role FROM users WHERE id = $1', [req.params.id]);
    if (!target.rows[0]) return res.status(404).json({ error: 'User not found' });
    if (target.rows[0].role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete an admin' });
    }

    await withTransaction(async (client) => {
      // Kullanıcının tüm verilerini temizle
      await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.params.id]);
      await client.query('DELETE FROM notifications WHERE user_id = $1', [req.params.id]);
      await client.query('DELETE FROM user_badges WHERE user_id = $1', [req.params.id]);
      await client.query('UPDATE threads SET user_id = NULL WHERE user_id = $1', [req.params.id]);
      await client.query('UPDATE posts SET user_id = NULL WHERE user_id = $1', [req.params.id]);
      await client.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    });

    securityEvent('user_deleted', 'critical', {
      targetUserId: parseInt(req.params.id),
      targetUsername: target.rows[0].username,
      adminId: req.user.id,
    });

    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// POST /api/admin/users/:id/reset-password - Admin şifre sıfırlama
router.post('/users/:id/reset-password', authMiddleware, adminMiddleware, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.params.id]);

    // Tüm refresh token'ları geçersiz kıl
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.params.id]);

    securityEvent('password_reset', 'critical', {
      targetUserId: parseInt(req.params.id),
      adminId: req.user.id,
    });

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// ============================================
// KATEGORİ YÖNETİMİ
// ============================================

// GET /api/admin/categories
router.get('/categories', authMiddleware, modMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM categories ORDER BY display_order ASC, id ASC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/admin/categories
router.post('/categories', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, slug, description, icon, color, display_order, is_private } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'Name and slug required' });

  try {
    const result = await pool.query(
      `INSERT INTO categories (name, slug, description, icon, color, display_order, is_private)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, slug.toLowerCase().replace(/[^a-z0-9-]/g, ''), description || null, 
       icon || '💬', color || '#00ff41', display_order || 0, is_private || false]
    );

    securityEvent('category_created', 'medium', {
      categoryId: result.rows[0].id,
      name,
      adminId: req.user.id,
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Category slug already exists' });
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/admin/categories/:id
router.put('/categories/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, slug, description, icon, color, display_order, is_private } = req.body;

  try {
    const result = await pool.query(
      `UPDATE categories SET 
        name = COALESCE($1, name),
        slug = COALESCE($2, slug),
        description = COALESCE($3, description),
        icon = COALESCE($4, icon),
        color = COALESCE($5, color),
        display_order = COALESCE($6, display_order),
        is_private = COALESCE($7, is_private)
       WHERE id = $8 RETURNING *`,
      [name, slug, description, icon, color, display_order, is_private, req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Category not found' });

    securityEvent('category_updated', 'medium', {
      categoryId: parseInt(req.params.id),
      adminId: req.user.id,
    });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/admin/categories/:id
router.delete('/categories/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM categories WHERE id = $1 RETURNING name',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Category not found' });

    securityEvent('category_deleted', 'high', {
      categoryId: parseInt(req.params.id),
      name: result.rows[0].name,
      adminId: req.user.id,
    });

    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// PATCH /api/admin/categories/reorder
router.patch('/categories/reorder', authMiddleware, adminMiddleware, async (req, res) => {
  const { order } = req.body; // [{id: 1, display_order: 0}, ...]
  if (!Array.isArray(order)) return res.status(400).json({ error: 'Order array required' });

  try {
    await withTransaction(async (client) => {
      for (const item of order) {
        await client.query(
          'UPDATE categories SET display_order = $1 WHERE id = $2',
          [item.display_order, item.id]
        );
      }
    });
    res.json({ message: 'Categories reordered' });
  } catch (err) {
    res.status(500).json({ error: 'Reorder failed' });
  }
});

// ============================================
// THREAD YÖNETİMİ
// ============================================

// GET /api/admin/threads
router.get('/threads', authMiddleware, modMiddleware, async (req, res) => {
  const { page = 1, search, category_id, is_pinned, is_locked, is_deleted } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const offset = (page - 1) * limit;

  try {
    let query = `SELECT t.*, u.username, c.name as category_name, c.slug as category_slug
                 FROM threads t 
                 LEFT JOIN users u ON u.id = t.user_id 
                 LEFT JOIN categories c ON c.id = t.category_id
                 WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND t.title ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (category_id) {
      query += ` AND t.category_id = $${paramIndex}`;
      params.push(category_id);
      paramIndex++;
    }
    if (is_pinned === 'true') query += ` AND t.is_pinned = TRUE`;
    if (is_locked === 'true') query += ` AND t.is_locked = TRUE`;
    if (is_deleted === 'true') {
      query += ` AND t.is_deleted = TRUE`;
    } else {
      query += ` AND t.is_deleted = FALSE`;
    }

    query += ` ORDER BY t.is_pinned DESC, t.last_reply_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    const countResult = await pool.query('SELECT COUNT(*) FROM threads WHERE is_deleted = FALSE');

    res.json({
      threads: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch threads' });
  }
});

// PATCH /api/admin/threads/:id/pin
router.patch('/threads/:id/pin', authMiddleware, modMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE threads SET is_pinned = NOT is_pinned WHERE id = $1 RETURNING is_pinned, title',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Thread not found' });

    securityEvent('thread_pin_toggle', 'medium', {
      threadId: parseInt(req.params.id),
      title: result.rows[0].title,
      isPinned: result.rows[0].is_pinned,
      adminId: req.user.id,
    });

    res.json({ 
      message: result.rows[0].is_pinned ? 'Thread pinned' : 'Thread unpinned',
      is_pinned: result.rows[0].is_pinned 
    });
  } catch (err) {
    res.status(500).json({ error: 'Pin action failed' });
  }
});

// PATCH /api/admin/threads/:id/lock
router.patch('/threads/:id/lock', authMiddleware, modMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE threads SET is_locked = NOT is_locked WHERE id = $1 RETURNING is_locked, title',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Thread not found' });

    securityEvent('thread_lock_toggle', 'medium', {
      threadId: parseInt(req.params.id),
      title: result.rows[0].title,
      isLocked: result.rows[0].is_locked,
      adminId: req.user.id,
    });

    res.json({ 
      message: result.rows[0].is_locked ? 'Thread locked' : 'Thread unlocked',
      is_locked: result.rows[0].is_locked 
    });
  } catch (err) {
    res.status(500).json({ error: 'Lock action failed' });
  }
});

// PATCH /api/admin/threads/:id/move
router.patch('/threads/:id/move', authMiddleware, modMiddleware, async (req, res) => {
  const { category_id } = req.body;
  if (!category_id) return res.status(400).json({ error: 'Category ID required' });

  try {
    const result = await pool.query(
      'UPDATE threads SET category_id = $1 WHERE id = $2 RETURNING title',
      [category_id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Thread not found' });

    securityEvent('thread_moved', 'medium', {
      threadId: parseInt(req.params.id),
      title: result.rows[0].title,
      newCategoryId: category_id,
      adminId: req.user.id,
    });

    res.json({ message: 'Thread moved' });
  } catch (err) {
    res.status(500).json({ error: 'Move failed' });
  }
});

// DELETE /api/admin/threads/:id - Soft delete
router.delete('/threads/:id', authMiddleware, modMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE threads SET is_deleted = TRUE WHERE id = $1 RETURNING title',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Thread not found' });

    securityEvent('thread_deleted', 'high', {
      threadId: parseInt(req.params.id),
      title: result.rows[0].title,
      adminId: req.user.id,
    });

    res.json({ message: 'Thread deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// DELETE /api/admin/threads/:id/hard - Hard delete
router.delete('/threads/:id/hard', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM threads WHERE id = $1 RETURNING title',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Thread not found' });

    securityEvent('thread_hard_deleted', 'critical', {
      threadId: parseInt(req.params.id),
      title: result.rows[0].title,
      adminId: req.user.id,
    });

    res.json({ message: 'Thread permanently deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Hard delete failed' });
  }
});

// ============================================
// POST YÖNETİMİ
// ============================================

// GET /api/admin/posts
router.get('/posts', authMiddleware, modMiddleware, async (req, res) => {
  const { page = 1, search, thread_id, is_deleted } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const offset = (page - 1) * limit;

  try {
    let query = `SELECT p.*, u.username, t.title as thread_title
                 FROM posts p 
                 LEFT JOIN users u ON u.id = p.user_id 
                 LEFT JOIN threads t ON t.id = p.thread_id
                 WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND p.content ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (thread_id) {
      query += ` AND p.thread_id = $${paramIndex}`;
      params.push(thread_id);
      paramIndex++;
    }
    if (is_deleted === 'true') {
      query += ` AND p.is_deleted = TRUE`;
    } else {
      query += ` AND p.is_deleted = FALSE`;
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM posts WHERE is_deleted = FALSE');

    res.json({
      posts: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// PATCH /api/admin/posts/:id/restore
router.patch('/posts/:id/restore', authMiddleware, modMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE posts SET is_deleted = FALSE WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Post not found' });
    res.json({ message: 'Post restored' });
  } catch (err) {
    res.status(500).json({ error: 'Restore failed' });
  }
});

// DELETE /api/admin/posts/:id
router.delete('/posts/:id', authMiddleware, modMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE posts SET is_deleted = TRUE WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Post not found' });

    securityEvent('post_deleted', 'medium', {
      postId: parseInt(req.params.id),
      adminId: req.user.id,
    });

    res.json({ message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// DELETE /api/admin/posts/:id/hard
router.delete('/posts/:id/hard', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM posts WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Post not found' });
    res.json({ message: 'Post permanently deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Hard delete failed' });
  }
});

// ============================================
// BADGE YÖNETİMİ
// ============================================

// POST /api/admin/users/:id/badge
router.post('/users/:id/badge', authMiddleware, modMiddleware, async (req, res) => {
  const { badge_name, badge_icon, badge_color } = req.body;
  if (!badge_name) return res.status(400).json({ error: 'Badge name required' });

  try {
    const result = await pool.query(
      'INSERT INTO user_badges (user_id, badge_name, badge_icon, badge_color) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.id, badge_name, badge_icon || '🏆', badge_color || '#00ff41']
    );

    // Bildirim gönder
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, 'badge', 'New Badge!', 'You earned the "${badge_name}" badge')`,
      [req.params.id]
    );

    securityEvent('badge_awarded', 'low', {
      targetUserId: parseInt(req.params.id),
      badgeName: badge_name,
      adminId: req.user.id,
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Badge award failed' });
  }
});

// ============================================
// BADGE YÖNETİMİ
// ============================================

// GET /api/admin/badges - Tüm badge'leri listele
router.get('/badges', authMiddleware, modMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ub.id, ub.user_id, ub.badge_name, ub.badge_icon, ub.badge_color, ub.created_at,
              u.username
       FROM user_badges ub
       LEFT JOIN users u ON u.id = ub.user_id
       ORDER BY ub.created_at DESC
       LIMIT 200`
    );
    res.json(result.rows);
  } catch (err) {
    securityEvent('badges_list_error', 'low', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

// POST /api/admin/badges - Yeni badge oluştur (sistemsel)
router.post('/badges', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, icon, color, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Badge name required' });

  try {
    const result = await pool.query(
      `INSERT INTO badges (name, icon, color, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, icon || '🏆', color || '#00ff41', description || '']
    );

    securityEvent('badge_created', 'low', {
      badgeName: name,
      adminId: req.user.id,
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Badge already exists' });
    }
    res.status(500).json({ error: 'Badge creation failed' });
  }
});

// DELETE /api/admin/badges/:id
router.delete('/badges/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM user_badges WHERE id = $1 RETURNING badge_name, user_id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Badge not found' });
    res.json({ message: 'Badge removed' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ============================================
// TAG YÖNETİMİ
// ============================================

// GET /api/admin/tags
router.get('/tags', authMiddleware, modMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tags ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// POST /api/admin/tags
router.post('/tags', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Tag name required' });

  try {
    const result = await pool.query(
      'INSERT INTO tags (name, color) VALUES ($1, $2) RETURNING *',
      [name.toLowerCase().replace(/[^a-z0-9-]/g, ''), color || '#8b5cf6']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Tag already exists' });
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// DELETE /api/admin/tags/:id
router.delete('/tags/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM tags WHERE id = $1', [req.params.id]);
    res.json({ message: 'Tag deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

// ============================================
// AKTİVİTE / LOG
// ============================================

// GET /api/admin/recent-activity
router.get('/recent-activity', authMiddleware, modMiddleware, async (req, res) => {
  try {
    const threads = await pool.query(
      `SELECT t.id, t.title, u.username, t.created_at, 'thread' as type, t.is_pinned, t.is_locked
       FROM threads t LEFT JOIN users u ON u.id = t.user_id
       WHERE t.is_deleted = FALSE ORDER BY t.created_at DESC LIMIT 10`
    );
    const posts = await pool.query(
      `SELECT p.id, LEFT(p.content, 80) as content, u.username, p.created_at, 
              t.id as thread_id, t.title as thread_title, 'post' as type
       FROM posts p LEFT JOIN users u ON u.id = p.user_id 
       LEFT JOIN threads t ON t.id = p.thread_id
       WHERE p.is_deleted = FALSE ORDER BY p.created_at DESC LIMIT 10`
    );
    const newUsers = await pool.query(
      `SELECT id, username, created_at, 'registration' as type
       FROM users ORDER BY created_at DESC LIMIT 10`
    );

    const activity = [
      ...threads.rows.map(r => ({ ...r, label: r.title })),
      ...posts.rows.map(r => ({ ...r, label: r.content })),
      ...newUsers.rows.map(r => ({ ...r, label: `${r.username} registered` })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);

    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// ============================================
// SİSTEM AYARLARI
// ============================================

// GET /api/admin/settings
router.get('/settings', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings ORDER BY key ASC');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (err) {
    // Settings tablosu yoksa boş döndür
    if (err.code === '42P01') return res.json({});
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/admin/settings
router.put('/settings', authMiddleware, adminMiddleware, async (req, res) => {
  const settings = req.body;
  if (typeof settings !== 'object') return res.status(400).json({ error: 'Settings object required' });

  try {
    // Settings tablosunu oluştur (yoksa)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await withTransaction(async (client) => {
      for (const [key, value] of Object.entries(settings)) {
        await client.query(
          `INSERT INTO settings (key, value, updated_at) 
           VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, String(value)]
        );
      }
    });

    securityEvent('settings_updated', 'high', {
      keys: Object.keys(settings),
      adminId: req.user.id,
    });

    res.json({ message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ============================================
// IP BAN YÖNETİMİ
// ============================================

// GET /api/admin/ip-bans
router.get('/ip-bans', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // IP bans tablosunu oluştur (yoksa)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ip_bans (
        id SERIAL PRIMARY KEY,
        ip_address VARCHAR(45) NOT NULL,
        reason TEXT,
        banned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP,
        UNIQUE(ip_address)
      )
    `);

    const result = await pool.query(
      `SELECT ib.*, u.username as banned_by_username
       FROM ip_bans ib LEFT JOIN users u ON u.id = ib.banned_by
       ORDER BY ib.created_at DESC LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch IP bans' });
  }
});

// POST /api/admin/ip-bans
router.post('/ip-bans', authMiddleware, adminMiddleware, async (req, res) => {
  const { ip_address, reason, expires_in_hours } = req.body;
  if (!ip_address) return res.status(400).json({ error: 'IP address required' });

  // IP formatı doğrulama
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip_address)) {
    return res.status(400).json({ error: 'Invalid IP address format' });
  }

  try {
    const expiresAt = expires_in_hours
      ? new Date(Date.now() + expires_in_hours * 3600000).toISOString()
      : null;

    const result = await pool.query(
      `INSERT INTO ip_bans (ip_address, reason, banned_by, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [ip_address, reason || null, req.user.id, expiresAt]
    );

    securityEvent('ip_banned', 'high', {
      ipAddress: ip_address,
      reason: reason || null,
      adminId: req.user.id,
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'IP already banned' });
    res.status(500).json({ error: 'Failed to ban IP' });
  }
});

// DELETE /api/admin/ip-bans/:id
router.delete('/ip-bans/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM ip_bans WHERE id = $1 RETURNING ip_address',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'IP ban not found' });

    securityEvent('ip_unbanned', 'medium', {
      ipAddress: result.rows[0].ip_address,
      adminId: req.user.id,
    });

    res.json({ message: 'IP ban removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove IP ban' });
  }
});

// ============================================
// BİLDİRİM BROADCAST
// ============================================

// POST /api/admin/broadcast
router.post('/broadcast', authMiddleware, adminMiddleware, async (req, res) => {
  const { title, message, type = 'broadcast', link } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'Title and message required' });

  try {
    // Tüm kullanıcılara bildirim ekle
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, link)
       SELECT id, $1, $2, $3, $4 FROM users WHERE is_banned = FALSE`,
      [type, title, message, link || null]
    );

    securityEvent('broadcast_sent', 'high', {
      title,
      adminId: req.user.id,
    });

    res.json({ message: 'Broadcast sent to all users' });
  } catch (err) {
    res.status(500).json({ error: 'Broadcast failed' });
  }
});

// ============================================
// AUDIT LOG
// ============================================

// GET /api/admin/audit-log
router.get('/audit-log', authMiddleware, adminMiddleware, async (req, res) => {
  const { page = 1, severity, action, userId } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = (page - 1) * limit;

  try {
    // Audit log tablosunu oluştur (yoksa)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'low',
        user_id INTEGER,
        details JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // İndeks
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)
    `);

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (severity) {
      query += ` AND severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }
    if (action) {
      query += ` AND action ILIKE $${paramIndex}`;
      params.push(`%${action}%`);
      paramIndex++;
    }
    if (userId) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM audit_logs');

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit,
    });
  } catch (err) {
    if (err.code === '42P01') return res.json({ logs: [], total: 0, page: 1, limit });
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// DELETE /api/admin/audit-log - Temizlik (30 günden eski loglar)
router.delete('/audit-log', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '30 days'"
    );
    res.json({ message: `Cleaned ${result.rowCount} old log entries` });
  } catch (err) {
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

// ============================================
// GÜVENLİK OLAYLARI
// ============================================

// GET /api/admin/security-events - Güvenlik olaylarını listele
router.get('/security-events', authMiddleware, adminMiddleware, async (req, res) => {
  const { page = 1, severity, action, ip_address } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = (page - 1) * limit;

  try {
    let query = `SELECT id, event_type, severity, ip_address, user_id, details, created_at
                 FROM security_events WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (severity) {
      query += ` AND severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }
    if (action) {
      query += ` AND event_type ILIKE $${paramIndex}`;
      params.push(`%${action}%`);
      paramIndex++;
    }
    if (ip_address) {
      query += ` AND ip_address = $${paramIndex}`;
      params.push(ip_address);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM security_events');

    res.json({
      events: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit,
    });
  } catch (err) {
    if (err.code === '42P01') return res.json({ events: [], total: 0, page: 1, limit });
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
});

// ============================================
// SİSTEM SAĞLIĞI
// ============================================

// GET /api/admin/health
router.get('/health', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const dbHealth = await pool.query('SELECT NOW() as time');
    const dbStats = await pool.query(
      `SELECT COUNT(*) as total_connections FROM pg_stat_activity WHERE datname = current_database()`
    );

    res.json({
      status: 'healthy',
      database: {
        connected: true,
        time: dbHealth.rows[0].time,
        active_connections: parseInt(dbStats.rows[0].total_connections),
      },
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        node_version: process.version,
        platform: process.platform,
      },
    });
  } catch (err) {
    res.json({
      status: 'degraded',
      database: { connected: false, error: err.message },
      server: {
        uptime: process.uptime(),
        node_version: process.version,
      },
    });
  }
});

module.exports = router;
