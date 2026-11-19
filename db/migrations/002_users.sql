-- =============================================================================
-- GTV Media Sales — Migration 002 : Table utilisateurs
-- =============================================================================

CREATE TABLE "user" (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(150) NOT NULL UNIQUE,
    name          VARCHAR(100) NOT NULL,
    role          VARCHAR(20)  NOT NULL CHECK (role IN ('ADMIN','COMMERCIAL','VIEWER')),
    password_hash VARCHAR(255) NOT NULL,   -- bcrypt hash, jamais le mot de passe en clair
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Index pour la requête de login (lookup par email)
CREATE INDEX idx_user_email ON "user" (email);

-- Contrainte FK différée : rate_card et project référencent user
ALTER TABLE rate_card ADD CONSTRAINT fk_rate_card_created_by
    FOREIGN KEY (created_by) REFERENCES "user"(id);

ALTER TABLE project ADD CONSTRAINT fk_project_owner
    FOREIGN KEY (owner_id) REFERENCES "user"(id);
