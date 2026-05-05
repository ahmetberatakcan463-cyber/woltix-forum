const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { adminMiddleware } = require('../middleware/admin');

const router = express.Router();

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*,
        (SELECT t.title FROM threads t WHERE t.category_id = c.id AND t.is_deleted = FALSE ORDER BY t.last_reply_at DESC LIMIT 1) as last_thread_title,
        (SELECT t.id FROM threads t WHERE t.category_id = c.id AND t.is_deleted = FALSE ORDER BY t.last_reply_at DESC LIMIT 1) as last_thread_id
       FROM categories c ORDER BY c.display_order ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/categories/:slug
router.get('/:slug', async (req, res) => {
  const { page = 1 } = req.query;
  const limit = 25;
  const offset = (page - 1) * limit;

  try {
    const catResult = await pool.query('SELECT * FROM categories WHERE slug = $1', [req.params.slug]);
    if (!catResult.rows[0]) return res.status(404).json({ error: 'Category not found' });

    const category = catResult.rows[0];

    const threadsResult = await pool.query(
      `SELECT t.id, t.title, t.view_count, t.reply_count, t.is_pinned, t.is_locked,
        t.created_at, t.last_reply_at,
        u.username as author, u.avatar_url as author_avatar, u.rank as author_rank,
        lu.username as last_reply_user
       FROM threads t
       LEFT JOIN users u ON u.id = t.user_id
       LEFT JOIN users lu ON lu.id = t.last_reply_user_id
       WHERE t.category_id = $1 AND t.is_deleted = FALSE
       ORDER BY t.is_pinned DESC, t.last_reply_at DESC
       LIMIT $2 OFFSET $3`,
      [category.id, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM threads WHERE category_id = $1 AND is_deleted = FALSE',
      [category.id]
    );

    res.json({
      category,
      threads: threadsResult.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// POST /api/categories — admin only
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, slug, description, icon, color, display_order } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'Name and slug required' });

  try {
    const result = await pool.query(
      'INSERT INTO categories (name, slug, description, icon, color, display_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [name, slug, description, icon || '💬', color || '#00ff41', display_order || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Slug already exists' });
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PATCH /api/categories/:id — admin only
router.patch('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, description, icon, color, display_order, is_private } = req.body;
  try {
    const result = await pool.query(
      `UPDATE categories SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        icon = COALESCE($3, icon),
        color = COALESCE($4, color),
        display_order = COALESCE($5, display_order),
        is_private = COALESCE($6, is_private)
       WHERE id = $7 RETURNING *`,
      [name, description, icon, color, display_order, is_private, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Category not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// DELETE /api/categories/:id — admin only
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
