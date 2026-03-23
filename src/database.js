const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'library_engine.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id        TEXT PRIMARY KEY,
      username  TEXT NOT NULL UNIQUE,
      member_since TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS books (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      author      TEXT NOT NULL,
      genre       TEXT NOT NULL,
      isbn        TEXT NOT NULL UNIQUE,
      is_archived INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id),
      book_id    TEXT NOT NULL REFERENCES books(id),
      score      INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, book_id)
    );

    CREATE TABLE IF NOT EXISTS loans (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id),
      book_id     TEXT NOT NULL REFERENCES books(id),
      loan_date   TEXT NOT NULL DEFAULT (datetime('now')),
      return_date TEXT,
      status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','RETURNED'))
    );
  `);
}

initSchema();

module.exports = db;
