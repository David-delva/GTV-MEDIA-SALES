-- Keep admin-created accounts unique regardless of email address casing.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_email_case_insensitive
    ON "user" (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS uq_rate_card_line_channel_without_support
    ON rate_card_line (rate_card_id, format_id, daypart, channel)
    WHERE support_id IS NULL;
