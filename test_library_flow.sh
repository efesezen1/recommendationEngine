#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Intelligent Library Recommendation Engine – E2E Validation Script
# Tools: curl + grep only  (no jq)
# ─────────────────────────────────────────────────────────────────────────────

BASE="http://localhost:3000"
PASS=0
FAIL=0

# ── helpers ──────────────────────────────────────────────────────────────────
check() {
  local label="$1"
  local response="$2"
  local pattern="$3"
  if echo "$response" | grep -q "$pattern"; then
    echo "[PASS] $label"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] $label"
    echo "       Expected pattern : $pattern"
    echo "       Got              : $response"
    FAIL=$((FAIL + 1))
  fi
}

extract_id() {
  # Extracts the FIRST "id" value from a JSON response (no jq allowed)
  echo "$1" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//'
}

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  STEP 1 – CREATE USERS"
echo "══════════════════════════════════════════"

RESP_U1=$(curl -s -X POST "$BASE/users" \
  -H "Content-Type: application/json" \
  -d '{"username":"alice"}')
echo "User 1: $RESP_U1"
check "Create User 1 (alice)" "$RESP_U1" '"username":"alice"'
USER1_ID=$(extract_id "$RESP_U1")

RESP_U2=$(curl -s -X POST "$BASE/users" \
  -H "Content-Type: application/json" \
  -d '{"username":"bob"}')
echo "User 2: $RESP_U2"
check "Create User 2 (bob)" "$RESP_U2" '"username":"bob"'
USER2_ID=$(extract_id "$RESP_U2")

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  STEP 2 – CREATE BOOKS (A, B, C)"
echo "══════════════════════════════════════════"

RESP_BA=$(curl -s -X POST "$BASE/books" \
  -H "Content-Type: application/json" \
  -d '{"title":"Book Alpha","author":"Author One","genre":"Fiction","isbn":"ISBN-001"}')
echo "Book A: $RESP_BA"
check "Create Book A" "$RESP_BA" '"title":"Book Alpha"'
BOOK_A_ID=$(extract_id "$RESP_BA")

RESP_BB=$(curl -s -X POST "$BASE/books" \
  -H "Content-Type: application/json" \
  -d '{"title":"Book Beta","author":"Author Two","genre":"Fiction","isbn":"ISBN-002"}')
echo "Book B: $RESP_BB"
check "Create Book B" "$RESP_BB" '"title":"Book Beta"'
BOOK_B_ID=$(extract_id "$RESP_BB")

RESP_BC=$(curl -s -X POST "$BASE/books" \
  -H "Content-Type: application/json" \
  -d '{"title":"Book Gamma","author":"Author Three","genre":"Sci-Fi","isbn":"ISBN-003"}')
echo "Book C: $RESP_BC"
check "Create Book C" "$RESP_BC" '"title":"Book Gamma"'
BOOK_C_ID=$(extract_id "$RESP_BC")

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  STEP 3 – TRAINING DATA (RATINGS)"
echo "══════════════════════════════════════════"

# User 1 rates Book A → 5
RESP=$(curl -s -X POST "$BASE/ratings" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$USER1_ID\",\"book_id\":\"$BOOK_A_ID\",\"score\":5}")
check "User 1 rates Book A (5)" "$RESP" '"score":5'

# User 1 rates Book B → 5
RESP=$(curl -s -X POST "$BASE/ratings" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$USER1_ID\",\"book_id\":\"$BOOK_B_ID\",\"score\":5}")
check "User 1 rates Book B (5)" "$RESP" '"score":5'

# User 2 rates Book A → 5  (establishes similarity with User 1)
RESP=$(curl -s -X POST "$BASE/ratings" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$USER2_ID\",\"book_id\":\"$BOOK_A_ID\",\"score\":5}")
check "User 2 rates Book A (5)" "$RESP" '"score":5'

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  STEP 4 – RECOMMENDATION TEST (User 2)"
echo "══════════════════════════════════════════"

RESP_REC=$(curl -s "$BASE/recommend/$USER2_ID")
echo "Recommendations for User 2: $RESP_REC"

# Engine must suggest Book B (User 1 & 2 both liked Book A → User 1's Book B rating is recommended)
check "Book Beta appears in recommendations for User 2" "$RESP_REC" 'Book Beta'

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  STEP 5 – INVENTORY INTEGRITY (Borrow Book A twice)"
echo "══════════════════════════════════════════"

# First borrow – must succeed
RESP_LOAN1=$(curl -s -X POST "$BASE/loans" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$USER1_ID\",\"book_id\":\"$BOOK_A_ID\"}")
echo "First borrow: $RESP_LOAN1"
check "First borrow of Book A succeeds (ACTIVE)" "$RESP_LOAN1" '"status":"ACTIVE"'
LOAN_ID=$(extract_id "$RESP_LOAN1")

# Second borrow – must be rejected with "Already Borrowed"
RESP_LOAN2=$(curl -s -X POST "$BASE/loans" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$USER2_ID\",\"book_id\":\"$BOOK_A_ID\"}")
echo "Second borrow (conflict): $RESP_LOAN2"
check "Second borrow rejected with 'Already Borrowed'" "$RESP_LOAN2" 'Already Borrowed'

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  STEP 6 – BONUS: Rating upsert & soft-delete"
echo "══════════════════════════════════════════"

# Upsert: User 2 re-rates Book A with a different score
RESP=$(curl -s -X POST "$BASE/ratings" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$USER2_ID\",\"book_id\":\"$BOOK_A_ID\",\"score\":3}")
check "Rating upsert (User 2, Book A → score 3)" "$RESP" '"score":3'
check "Upsert sets updated flag" "$RESP" '"updated":true'

# Invalid score must be rejected
RESP=$(curl -s -X POST "$BASE/ratings" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$USER1_ID\",\"book_id\":\"$BOOK_B_ID\",\"score\":7}")
check "Score out of range rejected" "$RESP" 'score must be an integer between 1 and 5'

# Soft delete Book C → is_archived should be set
RESP=$(curl -s -X DELETE "$BASE/books/$BOOK_C_ID")
check "Book C soft-deleted (archived)" "$RESP" 'archived'

# Archived book should not appear in default book list
RESP=$(curl -s "$BASE/books")
# Book C must NOT appear
if echo "$RESP" | grep -q 'Book Gamma'; then
  echo "[FAIL] Archived Book C must not appear in default /books listing"
  FAIL=$((FAIL + 1))
else
  echo "[PASS] Archived Book C hidden from default /books listing"
  PASS=$((PASS + 1))
fi

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  RESULTS"
echo "══════════════════════════════════════════"
echo "  Passed : $PASS"
echo "  Failed : $FAIL"
echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "  ALL TESTS PASSED ✓"
else
  echo "  SOME TESTS FAILED ✗"
  exit 1
fi
