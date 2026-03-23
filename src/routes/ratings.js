const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const router = express.Router();

// GET /ratings
router.get('/', (req, res) => {
  const { user_id, book_id } = req.query;
  let query = 'SELECT * FROM ratings WHERE 1=1';
  const params = [];
  if (user_id) { query += ' AND user_id = ?'; params.push(user_id); }
  if (book_id) { query += ' AND book_id = ?'; params.push(book_id); }
  res.json(db.prepare(query).all(...params));
});

// GET /ratings/:id
router.get('/:id', (req, res) => {
  const rating = db.prepare('SELECT * FROM ratings WHERE id = ?').get(req.params.id);
  if (!rating) return res.status(404).json({ error: 'Rating not found' });
  res.json(rating);
});

// POST /ratings  — upsert: if (user_id, book_id) exists, update score
router.post('/', (req, res) => {
  const { user_id, book_id, score } = req.body;
  if (!user_id || !book_id || score === undefined) {
    return res.status(400).json({ error: 'user_id, book_id, and score are required' });
  }

  const numScore = Number(score);
  if (!Number.isInteger(numScore) || numScore < 1 || numScore > 5) {
    return res.status(400).json({ error: 'score must be an integer between 1 and 5' });
  }

  if (!db.prepare('SELECT id FROM users WHERE id = ?').get(user_id)) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (!db.prepare('SELECT id FROM books WHERE id = ? AND is_archived = 0').get(book_id)) {
    return res.status(404).json({ error: 'Book not found or archived' });
  }

  const existing = db.prepare('SELECT * FROM ratings WHERE user_id = ? AND book_id = ?').get(user_id, book_id);

  if (existing) {
    db.prepare('UPDATE ratings SET score = ?, created_at = datetime(\'now\') WHERE id = ?').run(numScore, existing.id);
    return res.json({ ...db.prepare('SELECT * FROM ratings WHERE id = ?').get(existing.id), updated: true });
  }

  const id = uuidv4();
  db.prepare('INSERT INTO ratings (id, user_id, book_id, score) VALUES (?, ?, ?, ?)').run(id, user_id, book_id, numScore);
  res.status(201).json(db.prepare('SELECT * FROM ratings WHERE id = ?').get(id));
});

// PUT /ratings/:id
router.put('/:id', (req, res) => {
  const rating = db.prepare('SELECT * FROM ratings WHERE id = ?').get(req.params.id);
  if (!rating) return res.status(404).json({ error: 'Rating not found' });

  const { score } = req.body;
  const numScore = Number(score);
  if (!Number.isInteger(numScore) || numScore < 1 || numScore > 5) {
    return res.status(400).json({ error: 'score must be an integer between 1 and 5' });
  }

  db.prepare('UPDATE ratings SET score = ?, created_at = datetime(\'now\') WHERE id = ?').run(numScore, req.params.id);
  res.json(db.prepare('SELECT * FROM ratings WHERE id = ?').get(req.params.id));
});

// DELETE /ratings/:id
router.delete('/:id', (req, res) => {
  const rating = db.prepare('SELECT * FROM ratings WHERE id = ?').get(req.params.id);
  if (!rating) return res.status(404).json({ error: 'Rating not found' });
  db.prepare('DELETE FROM ratings WHERE id = ?').run(req.params.id);
  res.json({ message: 'Rating deleted' });
});

module.exports = router;
