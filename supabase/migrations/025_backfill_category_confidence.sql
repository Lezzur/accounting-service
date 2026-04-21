-- Backfill: earlier process-document runs inserted transactions with a
-- category_code but left category_confidence NULL. The UI treats NULL as
-- "low confidence" and paints a warning on every such row. For any row
-- that already has a category assigned, stamp a reasonable confidence
-- (0.9, matching the existing suggest-category fallback) so the warning
-- clears. Uncategorized rows (category_code IS NULL) stay NULL — those
-- genuinely need review.

UPDATE transactions
SET category_confidence = 0.9
WHERE category_code IS NOT NULL
  AND category_confidence IS NULL;
