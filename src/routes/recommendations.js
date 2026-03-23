const express = require('express');
const db = require('../database');

const router = express.Router();

/**
 * GET /recommend/:user_id
 *
 * Collaborative-filtering algorithm (pure SQL):
 *
 * 1. Find all books the target user has already rated  →  exclude these.
 * 2. Find "similar users": users who rated at least one book in common with
 *    the target user AND whose average score on shared books is >= 4.
 * 3. From those similar users, collect books they rated highly (score >= 4)
 *    that the target user has NOT yet rated.
 * 4. Rank candidate books by (number of similar-user endorsements DESC,
 *    average score DESC).
 */
router.get('/:user_id', (req, res) => {
  const { user_id } = req.params;

  if (!db.prepare('SELECT id FROM users WHERE id = ?').get(user_id)) {
    return res.status(404).json({ error: 'User not found' });
  }

  const recommendations = db.prepare(`
    SELECT
      b.id,
      b.title,
      b.author,
      b.genre,
      b.isbn,
      COUNT(DISTINCT r_sim.user_id)          AS endorsements,
      ROUND(AVG(r_sim.score), 2)             AS avg_score
    FROM ratings r_sim
    JOIN books b ON b.id = r_sim.book_id
    WHERE
      b.is_archived = 0

      -- Only books the target user has NOT already rated
      AND r_sim.book_id NOT IN (
        SELECT book_id FROM ratings WHERE user_id = ?
      )

      -- Only from users who are "similar" to the target user:
      -- they share at least one highly-rated book (score >= 4) with the target user
      AND r_sim.user_id IN (
        SELECT DISTINCT r_other.user_id
        FROM ratings r_other
        JOIN ratings r_target
          ON  r_target.book_id = r_other.book_id
          AND r_target.user_id = ?
        WHERE
          r_other.user_id  <> ?
          AND r_other.score  >= 4
          AND r_target.score >= 4
      )

      -- Only count high-scoring endorsements
      AND r_sim.score >= 4

    GROUP BY b.id
    ORDER BY endorsements DESC, avg_score DESC
  `).all(user_id, user_id, user_id);

  res.json({
    user_id,
    recommendations,
  });
});

module.exports = router;
