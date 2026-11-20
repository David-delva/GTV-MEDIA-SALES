-- =============================================================================
-- GTV Media Sales — Migration 001 : Schéma initial
-- Stratégie : versioning SCD2 sur rate_card, découplage audience/tarif
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- FORMAT : entité stable, cycle de vie long
-- -----------------------------------------------------------------------------
CREATE TABLE format (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code         VARCHAR(50) NOT NULL UNIQUE,  -- ex: SPOT_30S, PARRAINAGE_EMISSION
    label        VARCHAR(100) NOT NULL,
    category     VARCHAR(20) NOT NULL CHECK (category IN ('SPOT','PARRAINAGE','HABILLAGE','AUTRE')),
    duration_sec INT,                          -- null si non applicable (parrainage)
    is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- RATE_CARD : grille tarifaire versionnée (SCD2)
-- Plusieurs grilles peuvent être ACTIVE; la grille par défaut est gérée séparément.
-- -----------------------------------------------------------------------------
CREATE TABLE rate_card (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(150) NOT NULL,
    valid_from  DATE         NOT NULL,
    valid_to    DATE,                          -- NULL = grille en cours
    status      VARCHAR(10)  NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED')),
    created_by  UUID         NOT NULL,         -- FK vers users (Phase 2)
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_validity CHECK (valid_to IS NULL OR valid_to > valid_from)
);

-- -----------------------------------------------------------------------------
-- RATE_CARD_LINE : lignes tarifaires — prix bruts [À REMPLIR PAR GTV]
-- -----------------------------------------------------------------------------
CREATE TABLE rate_card_line (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_card_id     UUID          NOT NULL REFERENCES rate_card(id) ON DELETE CASCADE,
    format_id        UUID          NOT NULL REFERENCES format(id),
    daypart          VARCHAR(20)   NOT NULL CHECK (daypart IN ('PRIME','DAY','NUIT','WEEKEND')),
    channel          VARCHAR(50)   NOT NULL,
    gross_price      NUMERIC(12,2) NOT NULL CHECK (gross_price >= 0),
    discount_max_pct NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (discount_max_pct BETWEEN 0 AND 100),
    currency         CHAR(3)       NOT NULL DEFAULT 'XAF',
    is_negotiable    BOOLEAN       NOT NULL DEFAULT TRUE,
    UNIQUE (rate_card_id, format_id, daypart, channel)
);

-- -----------------------------------------------------------------------------
-- AUDIENCE_DATASET : données d'audience découplées, fraîcheur traçable
-- Toutes les métriques sont nullable → gestion du mode dégradé
-- -----------------------------------------------------------------------------
CREATE TABLE audience_dataset (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    format_id       UUID          NOT NULL REFERENCES format(id),
    daypart         VARCHAR(20)   NOT NULL,
    channel         VARCHAR(50)   NOT NULL,
    period_start    DATE          NOT NULL,
    period_end      DATE          NOT NULL,
    source          VARCHAR(100)  NOT NULL,    -- ex: MEDIAMETRIE_GABON, INTERNE_GTV
    target_segment  VARCHAR(100)  NOT NULL,    -- ex: FEMMES_25_49, CSP_PLUS
    grp             NUMERIC(8,3),              -- NULL si non mesuré
    reach_pct       NUMERIC(6,3),              -- NULL si non mesuré
    affinity_index  NUMERIC(7,2),              -- NULL si non mesuré, base 100
    imported_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_period CHECK (period_end > period_start),
    CONSTRAINT chk_reach   CHECK (reach_pct IS NULL OR reach_pct BETWEEN 0 AND 100)
);

-- Index critique pour la requête du moteur de scoring
CREATE INDEX idx_audience_lookup
    ON audience_dataset (format_id, daypart, channel, target_segment, period_end DESC);

-- -----------------------------------------------------------------------------
-- CLIENT
-- -----------------------------------------------------------------------------
CREATE TABLE client (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(150) NOT NULL,
    sector     VARCHAR(50),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- PROJECT : devis/campagne en construction
-- scoring_snapshot JSONB : fige l'état algorithmique à la soumission
-- -----------------------------------------------------------------------------
CREATE TABLE project (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    reference        VARCHAR(30)   NOT NULL UNIQUE,  -- ex: PRJ-2025-0042
    title            VARCHAR(200)  NOT NULL,
    client_id        UUID          NOT NULL REFERENCES client(id),
    owner_id         UUID          NOT NULL,          -- FK vers users (Phase 2)
    status           VARCHAR(20)   NOT NULL DEFAULT 'DRAFT'
                         CHECK (status IN ('DRAFT','SUBMITTED','NEGOTIATION','CLOSED_WON','CLOSED_LOST')),
    campaign_start   DATE,
    campaign_end     DATE,
    budget_target    NUMERIC(14,2),
    rate_card_id     UUID          NOT NULL REFERENCES rate_card(id),
    scoring_snapshot JSONB,                           -- figé à SUBMITTED
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_campaign_dates CHECK (
        campaign_end IS NULL OR campaign_start IS NULL OR campaign_end >= campaign_start
    )
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_project_updated_at
    BEFORE UPDATE ON project
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
