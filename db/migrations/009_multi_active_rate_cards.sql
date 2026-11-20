BEGIN;

ALTER TABLE rate_card
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE rate_card
SET is_default = TRUE
WHERE id = (
    SELECT id
    FROM rate_card
    WHERE status = 'ACTIVE'
      AND valid_from <= CURRENT_DATE
      AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
    ORDER BY valid_from DESC, created_at DESC
    LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM rate_card WHERE is_default = TRUE);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rate_card_single_default
    ON rate_card (is_default)
    WHERE is_default = TRUE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_rate_card_default_active'
          AND conrelid = 'rate_card'::regclass
    ) THEN
        ALTER TABLE rate_card
            ADD CONSTRAINT chk_rate_card_default_active
            CHECK (NOT is_default OR status = 'ACTIVE');
    END IF;
END;
$$;

COMMIT;
