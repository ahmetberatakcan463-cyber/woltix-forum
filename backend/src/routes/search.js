const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();

// GET /api/search?q=...&type=threads|posts|users
router.get('/', async (req, res) => {
  const { q, type = 'threads', page = 1 } = req.query;
  if (!q || q.trim().length < 2) return res.status(400).json({ error: 'Query too short' });

  const limit = 20;
  const offset = (page - 1) * limit;
  const query = `%${q.trim()}%`;

  try {
    if (type === 'threads') {
      const result = await pool.query(
        `SELECT t.id, t.title, t.created_at, t.reply_count, t.view_count,
          u.username as author, c.name as category_name, c.slug as category_slug
         FROM threads t
         LEFT JOIN users u ON u.id = t.user_id
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.is_deleted = FALSE AND (t.title ILIKE $1)
         ORDER BY t.last_reply_at DESC LIMIT $2 OFFSET $3`,
        [query, limit, offset]
      );
      return res.json({ results: result.rows, type });
    }

    if (type === 'posts') {
      const result = await pool.query(
        `SELECT p.id, p.content, p.created_at,
          u.username as author,
          t.id as thread_id, t.title as thread_title
         FROM posts p
         LEFT JOIN users u ON u.id = p.user_id
         LEFT JOIN threads t ON t.id = p.thread_id
         WHERE p.is_deleted = FALSE AND t.is_deleted = FALSE AND p.content ILIKE $1
         ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
        [query, limit, offset]
      );
      return res.json({ results: result.rows, type });
    }

    if (type === 'users') {
      const result = await pool.query(
        `SELECT username, rank, role, reputation, post_count, avatar_url, created_at
         FROM users WHERE username ILIKE $1 AND is_banned = FALSE
         ORDER BY reputation DESC LIMIT $2 OFFSET $3`,
        [query, limit, offset]
      );
      return res.json({ results: result.rows, type });
    }

    res.status(400).json({ error: 'Invalid search type' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
