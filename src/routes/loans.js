const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const router = express.Router();

// GET /loans
router.get('/', (req, res) => {
  const { user_id, book_id, status } = req.query;
  let query = 'SELECT * FROM loans WHERE 1=1';
  const params = [];
  if (user_id) { query += ' AND user_id = ?'; params.push(user_id); }
  if (book_id) { query += ' AND book_id = ?'; params.push(book_id); }
  if (status)  { query += ' AND status = ?';  params.push(status.toUpperCase()); }
  res.json(db.prepare(query).all(...params));
});

// GET /loans/:id
router.get('/:id', (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  res.json(loan);
});

// POST /loans  — borrow a book
router.post('/', (req, res) => {
  const { user_id, book_id } = req.body;
  if (!user_id || !book_id) {
    return res.status(400).json({ error: 'user_id and book_id are required' });
  }

  if (!db.prepare('SELECT id FROM users WHERE id = ?').get(user_id)) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (!db.prepare('SELECT id FROM books WHERE id = ? AND is_archived = 0').get(book_id)) {
    return res.status(404).json({ error: 'Book not found or archived' });
  }

  // Inventory integrity: reject if latest loan for this book is ACTIVE
  const latestLoan = db.prepare(
    `SELECT status FROM loans
     WHERE book_id = ?
     ORDER BY loan_date DESC
     LIMIT 1`
  ).get(book_id);

  if (latestLoan && latestLoan.status === 'ACTIVE') {
    return res.status(409).json({ error: 'Already Borrowed: this book is currently on loan' });
  }

  const id = uuidv4();
  db.prepare(
    'INSERT INTO loans (id, user_id, book_id, loan_date, status) VALUES (?, ?, ?, datetime(\'now\'), \'ACTIVE\')'
  ).run(id, user_id, book_id);

  res.status(201).json(db.prepare('SELECT * FROM loans WHERE id = ?').get(id));
});

// PUT /loans/:id  — return a book
router.put('/:id', (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  if (loan.status === 'RETURNED') {
    return res.status(409).json({ error: 'Loan is already returned' });
  }

  db.prepare(
    "UPDATE loans SET status = 'RETURNED', return_date = datetime('now') WHERE id = ?"
  ).run(req.params.id);

  res.json(db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id));
});

// DELETE /loans/:id
router.delete('/:id', (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  db.prepare('DELETE FROM loans WHERE id = ?').run(req.params.id);
  res.json({ message: 'Loan record deleted' });
});

module.exports = router;
