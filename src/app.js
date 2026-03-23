const express = require('express');

const usersRouter          = require('./routes/users');
const booksRouter          = require('./routes/books');
const ratingsRouter        = require('./routes/ratings');
const loansRouter          = require('./routes/loans');
const recommendationsRouter = require('./routes/recommendations');

const app  = express();
const PORT = 3000;

app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/users',       usersRouter);
app.use('/books',       booksRouter);
app.use('/ratings',     ratingsRouter);
app.use('/loans',       loansRouter);
app.use('/recommend',   recommendationsRouter);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── 404 catch-all ────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

app.listen(PORT, () => {
  console.log(`Library Recommendation Engine running on http://localhost:${PORT}`);
});

module.exports = app;
