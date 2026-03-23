const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const router = express.Router();

// GET /books  (exclude archived by default unless ?include_archived=true)
router.get('/', (req, res) => {
  const includeArchived = req.query.include_archived === 'true';
  const books = includeArchived
    ? db.prepare('SELECT * FROM books').all()
    : db.prepare('SELECT * FROM books WHERE is_archived = 0').all();
  res.json(books);
});

// GET /books/:id
router.get('/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json(book);
});

// POST /books
router.post('/', (req, res) => {
  const { title, author, genre, isbn } = req.body;
  if (!title || !author || !genre || !isbn) {
    return res.status(400).json({ error: 'title, author, genre, and isbn are required' });
  }

  const id = uuidv4();
  try {
    db.prepare('INSERT INTO books (id, title, author, genre, isbn) VALUES (?, ?, ?, ?, ?)').run(id, title, author, genre, isbn);
    res.status(201).json(db.prepare('SELECT * FROM books WHERE id = ?').get(id));
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'ISBN already exists' });
    throw err;
  }
});

// PUT /books/:id
router.put('/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const { title, author, genre, isbn } = req.body;
  const updated = {
    title:  title  ?? book.title,
    author: author ?? book.author,
    genre:  genre  ?? book.genre,
    isbn:   isbn   ?? book.isbn,
  };

  try {
    db.prepare('UPDATE books SET title=?, author=?, genre=?, isbn=? WHERE id=?')
      .run(updated.title, updated.author, updated.genre, updated.isbn, req.params.id);
    res.json(db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id));
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'ISBN already exists' });
    throw err;
  }
});

// DELETE /books/:id  →  soft delete (archive)
router.delete('/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  if (book.is_archived) return res.status(409).json({ error: 'Book is already archived' });

  db.prepare('UPDATE books SET is_archived = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Book archived (soft deleted)', id: req.params.id });
});

module.exports = router;
