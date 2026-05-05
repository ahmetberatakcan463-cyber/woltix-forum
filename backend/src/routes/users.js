const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/:username
router.get('/:username', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, rank, role, reputation, post_count, thread_count, avatar_url, bio, website, signature, last_seen, created_at
       FROM users WHERE username = $1 AND is_banned = FALSE`,
      [req.params.username.toLowerCase()]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });

    const user = result.rows[0];

    const badges = await pool.query(
      'SELECT badge_name, badge_icon, badge_color, awarded_at FROM user_badges WHERE user_id = $1 ORDER BY awarded_at DESC',
      [user.id]
    );

    const threads = await pool.query(
      `SELECT t.id, t.title, t.created_at, c.name as category_name, c.slug as category_slug
       FROM threads t JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = $1 AND t.is_deleted = FALSE
       ORDER BY t.created_at DESC LIMIT 5`,
      [user.id]
    );

    res.json({ ...user, badges: badges.rows, recent_threads: threads.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PATCH /api/users/me
router.patch('/me', authMiddleware, async (req, res) => {
  const { bio, website, signature, avatar_url } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users SET bio = COALESCE($1, bio), website = COALESCE($2, website),
       signature = COALESCE($3, signature), avatar_url = COALESCE($4, avatar_url)
       WHERE id = $5 RETURNING id, username, bio, website, signature, avatar_url`,
      [bio, website, signature, avatar_url, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// PATCH /api/users/me/password
router.patch('/me/password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both passwords required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.user.id]);

    res.json({ message: 'Password updated. Please login again.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Password update failed' });
  }
});

// GET /api/users/me/notifications
router.get('/me/notifications', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /api/users/me/notifications/read
router.patch('/me/notifications/read', authMiddleware, async (req, res) => {
  await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.user.id]);
  res.json({ message: 'Notifications marked as read' });
});

module.exports = router;
