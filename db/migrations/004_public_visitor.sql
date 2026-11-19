-- Public visitor requests are pre-sales leads, not confirmed bookings.
-- They may be submitted before an internal commercial project exists.
ALTER TABLE quote_request
    ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE quote_request
    ADD COLUMN IF NOT EXISTS campaign_brief JSONB,
    ADD COLUMN IF NOT EXISTS plan_snapshot JSONB,
    ADD COLUMN IF NOT EXISTS rate_card_id UUID REFERENCES rate_card(id);

CREATE INDEX IF NOT EXISTS idx_quote_request_visitor_inbox
    ON quote_request (status, submitted_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tracking_token_active
    ON tracking_token (subject_type, subject_id, expires_at)
    WHERE revoked_at IS NULL;
