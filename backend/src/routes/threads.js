const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { modMiddleware } = require('../middleware/admin');

const router = express.Router();

function getUserRank(postCount) {
  if (postCount >= 2501) return 'Legend';
  if (postCount >= 1001) return 'Elite';
  if (postCount >= 501) return 'Expert';
  if (postCount >= 201) return 'Veteran';
  if (postCount >= 51) return 'Regular';
  if (postCount >= 11) return 'Member';
  return 'Newbie';
}

// GET /api/threads/:id
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const threadResult = await pool.query(
      `SELECT t.*, c.name as category_name, c.slug as category_slug, c.color as category_color,
        u.username as author, u.avatar_url as author_avatar, u.rank as author_rank, u.role as author_role
       FROM threads t
       JOIN categories c ON c.id = t.category_id
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.id = $1 AND t.is_deleted = FALSE`,
      [req.params.id]
    );

    if (!threadResult.rows[0]) return res.status(404).json({ error: 'Thread not found' });

    await pool.query('UPDATE threads SET view_count = view_count + 1 WHERE id = $1', [req.params.id]);

    const thread = threadResult.rows[0];
    const { page = 1 } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;

    const postsResult = await pool.query(
      `SELECT p.*, u.username, u.avatar_url, u.rank, u.role, u.post_count, u.reputation, u.signature, u.created_at as member_since,
        (SELECT COUNT(*) FROM user_badges WHERE user_id = p.user_id) as badge_count
       FROM posts p
       LEFT JOIN users u ON u.id = p.user_id
       WHERE p.thread_id = $1 AND p.is_deleted = FALSE
       ORDER BY p.created_at ASC
       LIMIT $2 OFFSET $3`,
      [thread.id, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM posts WHERE thread_id = $1 AND is_deleted = FALSE',
      [thread.id]
    );

    let userVotes = {};
    if (req.user) {
      const votesResult = await pool.query(
        `SELECT post_id, vote_type FROM votes WHERE user_id = $1 AND post_id = ANY($2)`,
        [req.user.id, postsResult.rows.map(p => p.id)]
      );
      votesResult.rows.forEach(v => { userVotes[v.post_id] = v.vote_type; });
    }

    const posts = postsResult.rows.map(p => ({ ...p, userVote: userVotes[p.id] || 0 }));

    res.json({
      thread,
      posts,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

// POST /api/threads
router.post('/', authMiddleware, async (req, res) => {
  const { title, content, category_id, tags } = req.body;

  if (!title || !content || !category_id) {
    return res.status(400).json({ error: 'Title, content and category are required' });
  }
  if (title.length < 5 || title.length > 200) {
    return res.status(400).json({ error: 'Title must be 5-200 characters' });
  }
  if (content.length < 10) {
    return res.status(400).json({ error: 'Content too short' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const catResult = await client.query('SELECT id, is_private FROM categories WHERE id = $1', [category_id]);
    if (!catResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Category not found' });
    }

    const threadResult = await client.query(
      `INSERT INTO threads (title, category_id, user_id, last_reply_user_id)
       VALUES ($1, $2, $3, $3) RETURNING *`,
      [title.trim(), category_id, req.user.id]
    );
    const thread = threadResult.rows[0];

    const postResult = await client.query(
      'INSERT INTO posts (thread_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
      [thread.id, req.user.id, content.trim()]
    );

    await client.query(
      `UPDATE users SET post_count = post_count + 1, thread_count = thread_count + 1 WHERE id = $1`,
      [req.user.id]
    );

    const userResult = await client.query('SELECT post_count FROM users WHERE id = $1', [req.user.id]);
    const newRank = getUserRank(userResult.rows[0].post_count);
    await client.query('UPDATE users SET rank = $1 WHERE id = $2', [newRank, req.user.id]);

    await client.query(
      'UPDATE categories SET thread_count = thread_count + 1, post_count = post_count + 1 WHERE id = $1',
      [category_id]
    );

    if (tags && tags.length > 0) {
      for (const tagId of tags) {
        await client.query(
          'INSERT INTO thread_tags (thread_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [thread.id, tagId]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ thread, firstPost: postResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to create thread' });
  } finally {
    client.release();
  }
});

// POST /api/threads/:id/posts — reply
router.post('/:id/posts', authMiddleware, async (req, res) => {
  const { content } = req.body;
  if (!content || content.length < 2) {
    return res.status(400).json({ error: 'Content required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const threadResult = await client.query(
      'SELECT id, is_locked, category_id, user_id, title FROM threads WHERE id = $1 AND is_deleted = FALSE',
      [req.params.id]
    );
    if (!threadResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Thread not found' });
    }
    const thread = threadResult.rows[0];

    if (thread.is_locked && req.user.role === 'member') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Thread is locked' });
    }

    const postResult = await client.query(
      'INSERT INTO posts (thread_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
      [thread.id, req.user.id, content.trim()]
    );

    await client.query(
      `UPDATE threads SET reply_count = reply_count + 1, last_reply_at = NOW(), last_reply_user_id = $1 WHERE id = $2`,
      [req.user.id, thread.id]
    );

    await client.query(
      'UPDATE categories SET post_count = post_count + 1 WHERE id = $1',
      [thread.category_id]
    );

    await client.query(
      'UPDATE users SET post_count = post_count + 1 WHERE id = $1',
      [req.user.id]
    );

    const userResult = await client.query('SELECT post_count FROM users WHERE id = $1', [req.user.id]);
    const newRank = getUserRank(userResult.rows[0].post_count);
    await client.query('UPDATE users SET rank = $1 WHERE id = $2', [newRank, req.user.id]);

    if (thread.user_id && thread.user_id !== req.user.id) {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ($1, 'reply', 'New reply in your thread', $2, $3)`,
        [thread.user_id, `${req.user.username} replied to "${thread.title}"`, `/t/${thread.id}`]
      );
    }

    await client.query('COMMIT');

    const post = postResult.rows[0];
    const userResult2 = await pool.query(
      'SELECT username, avatar_url, rank, role, post_count, reputation, signature, created_at as member_since FROM users WHERE id = $1',
      [req.user.id]
    );

    res.status(201).json({ ...post, ...userResult2.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to post reply' });
  } finally {
    client.release();
  }
});

// PATCH /api/threads/:id — update thread (lock, pin, delete)
router.patch('/:id', authMiddleware, async (req, res) => {
  const { is_pinned, is_locked, is_deleted, title } = req.body;

  try {
    const threadResult = await pool.query('SELECT * FROM threads WHERE id = $1', [req.params.id]);
    if (!threadResult.rows[0]) return res.status(404).json({ error: 'Thread not found' });
    const thread = threadResult.rows[0];

    const isMod = req.user.role === 'admin' || req.user.role === 'moderator';
    const isAuthor = thread.user_id === req.user.id;

    if (!isMod && !isAuthor) return res.status(403).json({ error: 'Not authorized' });

    const updates = {};
    if (isMod && is_pinned !== undefined) updates.is_pinned = is_pinned;
    if (isMod && is_locked !== undefined) updates.is_locked = is_locked;
    if ((isMod || isAuthor) && is_deleted !== undefined) updates.is_deleted = is_deleted;
    if (isAuthor && title) updates.title = title.trim();

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates' });
    }

    const setClause = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = [...Object.values(updates), req.params.id];

    const result = await pool.query(
      `UPDATE threads SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// PATCH /api/threads/posts/:postId — edit post
router.patch('/posts/:postId', authMiddleware, async (req, res) => {
  const { content } = req.body;
  if (!content || content.length < 2) return res.status(400).json({ error: 'Content required' });

  try {
    const result = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.postId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Post not found' });
    const post = result.rows[0];

    const isMod = req.user.role === 'admin' || req.user.role === 'moderator';
    if (!isMod && post.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await pool.query(
      'UPDATE posts SET content = $1, edit_count = edit_count + 1, edited_at = NOW() WHERE id = $2 RETURNING *',
      [content.trim(), req.params.postId]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Edit failed' });
  }
});

// POST /api/threads/posts/:postId/vote
router.post('/posts/:postId/vote', authMiddleware, async (req, res) => {
  const { type } = req.body; // 1 or -1
  if (type !== 1 && type !== -1) return res.status(400).json({ error: 'Vote type must be 1 or -1' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const postResult = await client.query('SELECT user_id FROM posts WHERE id = $1', [req.params.postId]);
    if (!postResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Post not found' });
    }

    const existing = await client.query(
      'SELECT id, vote_type FROM votes WHERE user_id = $1 AND post_id = $2',
      [req.user.id, req.params.postId]
    );

    let delta = 0;
    if (existing.rows[0]) {
      if (existing.rows[0].vote_type === type) {
        await client.query('DELETE FROM votes WHERE id = $1', [existing.rows[0].id]);
        delta = -type;
      } else {
        await client.query('UPDATE votes SET vote_type = $1 WHERE id = $2', [type, existing.rows[0].id]);
        delta = type * 2;
      }
    } else {
      await client.query(
        'INSERT INTO votes (user_id, post_id, vote_type) VALUES ($1, $2, $3)',
        [req.user.id, req.params.postId, type]
      );
      delta = type;
    }

    const updated = await client.query(
      'UPDATE posts SET votes = votes + $1 WHERE id = $2 RETURNING votes',
      [delta, req.params.postId]
    );

    if (postResult.rows[0].user_id) {
      await client.query(
        'UPDATE users SET reputation = reputation + $1 WHERE id = $2',
        [delta, postResult.rows[0].user_id]
      );
    }

    await client.query('COMMIT');
    res.json({ votes: updated.rows[0].votes });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Vote failed' });
  } finally {
    client.release();
  }
});

module.exports = router;
