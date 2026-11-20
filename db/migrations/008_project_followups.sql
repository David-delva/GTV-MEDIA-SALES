CREATE TABLE IF NOT EXISTS project_follow_up (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID         NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    author_id    UUID         NOT NULL REFERENCES "user"(id),
    note         VARCHAR(2000) NOT NULL CHECK (length(trim(note)) BETWEEN 1 AND 2000),
    due_date     DATE         NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_follow_up_open_due
    ON project_follow_up (due_date, project_id)
    WHERE completed_at IS NULL;
