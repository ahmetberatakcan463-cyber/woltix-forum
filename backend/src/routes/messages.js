const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/messages — inbox
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pm.*, u.username as sender_name, u.avatar_url as sender_avatar
       FROM private_messages pm
       LEFT JOIN users u ON u.id = pm.sender_id
       WHERE pm.receiver_id = $1 AND pm.deleted_by_receiver = FALSE
       ORDER BY pm.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// GET /api/messages/sent
router.get('/sent', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pm.*, u.username as receiver_name, u.avatar_url as receiver_avatar
       FROM private_messages pm
       LEFT JOIN users u ON u.id = pm.receiver_id
       WHERE pm.sender_id = $1 AND pm.deleted_by_sender = FALSE
       ORDER BY pm.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sent messages' });
  }
});

// GET /api/messages/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pm.*,
        s.username as sender_name, s.avatar_url as sender_avatar,
        r.username as receiver_name
       FROM private_messages pm
       LEFT JOIN users s ON s.id = pm.sender_id
       LEFT JOIN users r ON r.id = pm.receiver_id
       WHERE pm.id = $1 AND (pm.receiver_id = $2 OR pm.sender_id = $2)`,
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Message not found' });

    const msg = result.rows[0];
    if (msg.receiver_id === req.user.id && !msg.is_read) {
      await pool.query('UPDATE private_messages SET is_read = TRUE WHERE id = $1', [msg.id]);
    }

    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

// POST /api/messages
router.post('/', authMiddleware, async (req, res) => {
  const { to, subject, content } = req.body;
  if (!to || !content) return res.status(400).json({ error: 'Recipient and content required' });
  if (content.length < 2) return res.status(400).json({ error: 'Content too short' });

  try {
    const receiverResult = await pool.query(
      'SELECT id, username, is_banned FROM users WHERE username = $1',
      [to.toLowerCase()]
    );
    if (!receiverResult.rows[0]) return res.status(404).json({ error: 'User not found' });
    const receiver = receiverResult.rows[0];

    if (receiver.is_banned) return res.status(400).json({ error: 'Cannot message this user' });
    if (receiver.id === req.user.id) return res.status(400).json({ error: 'Cannot message yourself' });

    const result = await pool.query(
      'INSERT INTO private_messages (sender_id, receiver_id, subject, content) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, receiver.id, subject || 'No subject', content.trim()]
    );

    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, link)
       VALUES ($1, 'dm', 'New message', $2, '/messages')`,
      [receiver.id, `${req.user.username} sent you a message`]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// DELETE /api/messages/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT sender_id, receiver_id FROM private_messages WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Message not found' });
    const msg = result.rows[0];

    if (msg.receiver_id === req.user.id) {
      await pool.query('UPDATE private_messages SET deleted_by_receiver = TRUE WHERE id = $1', [req.params.id]);
    } else if (msg.sender_id === req.user.id) {
      await pool.query('UPDATE private_messages SET deleted_by_sender = TRUE WHERE id = $1', [req.params.id]);
    } else {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({ message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// GET /api/messages/unread/count
router.get('/unread/count', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM private_messages WHERE receiver_id = $1 AND is_read = FALSE AND deleted_by_receiver = FALSE',
      [req.user.id]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch count' });
  }
});

module.exports = router;
