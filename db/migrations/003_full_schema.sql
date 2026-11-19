-- =============================================================================
-- GTV Media Sales — Migration 003 : Schéma complet conforme CDCF §8.2
-- Complète la migration 001 avec toutes les tables métier manquantes
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ADVERTISER / CONTACT : annonceurs et leurs contacts
-- -----------------------------------------------------------------------------
CREATE TABLE advertiser (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(200) NOT NULL,
    sector_code  VARCHAR(50),
    city         VARCHAR(100),
    country      VARCHAR(100) NOT NULL DEFAULT 'Gabon',
    size         VARCHAR(20),                    -- PME, ETI, GE, INSTITUTION
    website      VARCHAR(255),
    tax_id       VARCHAR(50),                    -- NIF, null si non fourni
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ                     -- soft delete (RG-12)
);

CREATE TABLE contact (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id     UUID         NOT NULL REFERENCES advertiser(id),
    full_name         VARCHAR(150) NOT NULL,
    function          VARCHAR(100),
    email             VARCHAR(150) NOT NULL,
    phone             VARCHAR(30),
    consent_marketing BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- SUPPORT / PROGRAM / SLOT : supports de diffusion
-- -----------------------------------------------------------------------------
CREATE TABLE support (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(50) NOT NULL UNIQUE,
    label       VARCHAR(100) NOT NULL,
    type        VARCHAR(20) NOT NULL CHECK (type IN ('tv','digital','radio')),
    description TEXT,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE TABLE program (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    support_id        UUID        NOT NULL REFERENCES support(id),
    label             VARCHAR(150) NOT NULL,
    genre             VARCHAR(50),
    description       TEXT,
    target_hint       VARCHAR(100),
    broadcast_pattern JSONB,                     -- jours/heures de diffusion
    deleted_at        TIMESTAMPTZ
);

CREATE TABLE slot (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id   UUID        REFERENCES program(id),
    daypart_code VARCHAR(20) NOT NULL CHECK (daypart_code IN ('DAY','ACCESS','PRIME','NIGHT')),
    start_time   TIME,
    end_time     TIME,
    days         JSONB,                          -- ex: ["LUN","MAR","MER"]
    availability JSONB                           -- périodes de disponibilité
);

-- Table de liaison format ↔ support ↔ slot
CREATE TABLE format_support (
    format_id  UUID    NOT NULL REFERENCES format(id),
    support_id UUID    NOT NULL REFERENCES support(id),
    slot_id    UUID    REFERENCES slot(id),
    eligible   BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (format_id, support_id)
);

-- -----------------------------------------------------------------------------
-- RATE_CARD_LINE étendue : ajout support_id et duration_s
-- (on recrée la contrainte d'unicité conforme au CDCF §8.3)
-- -----------------------------------------------------------------------------
ALTER TABLE rate_card_line
    ADD COLUMN IF NOT EXISTS support_id  UUID REFERENCES support(id),
    ADD COLUMN IF NOT EXISTS duration_s  INT,
    ADD COLUMN IF NOT EXISTS condition_note TEXT;

-- Contrainte d'unicité conforme CDCF §8.3
ALTER TABLE rate_card_line
    DROP CONSTRAINT IF EXISTS rate_card_line_rate_card_id_format_id_daypart_channel_key;

ALTER TABLE rate_card_line
    ADD CONSTRAINT uq_rate_card_line
    UNIQUE (rate_card_id, format_id, support_id, daypart, duration_s);

-- -----------------------------------------------------------------------------
-- DISCOUNT_RULE : dégressivités et remises conditionnelles (RG-05)
-- Aucune remise n'est déduite par le code sans figurer ici
-- -----------------------------------------------------------------------------
CREATE TABLE discount_rule (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_card_id  UUID          NOT NULL REFERENCES rate_card(id) ON DELETE CASCADE,
    type          VARCHAR(20)   NOT NULL CHECK (type IN ('volume','conditional')),
    threshold_qty INT,
    rate_pct      NUMERIC(5,2)  NOT NULL CHECK (rate_pct BETWEEN 0 AND 100),
    conditions    JSONB,
    approved_by   UUID          REFERENCES "user"(id)
);

-- -----------------------------------------------------------------------------
-- COEFFICIENT : tranches horaires, saisonnalité, urgence (§6.3)
-- CoefTranche et CoefSaisonnalite référencés dans le modèle de calcul
-- -----------------------------------------------------------------------------
CREATE TABLE coefficient (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_card_id UUID          NOT NULL REFERENCES rate_card(id) ON DELETE CASCADE,
    type         VARCHAR(20)   NOT NULL CHECK (type IN ('daypart','seasonality','urgency')),
    key          VARCHAR(50)   NOT NULL,         -- ex: 'PRIME', '2025-12'
    value        NUMERIC(6,3)  NOT NULL,         -- ex: 1.5 pour prime time
    valid_from   DATE          NOT NULL,
    valid_to     DATE,
    UNIQUE (rate_card_id, type, key, valid_from)
);

-- -----------------------------------------------------------------------------
-- SCORING_WEIGHT_SET : poids et matrices éditables en back-office (EX-A02)
-- POURQUOI en base : les poids ne doivent jamais être hardcodés (§5.3)
-- -----------------------------------------------------------------------------
CREATE TABLE scoring_weight_set (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    version_label    VARCHAR(100) NOT NULL,
    -- Poids des 6 critères C1→C6 (JSONB pour flexibilité éditoriale)
    weights          JSONB        NOT NULL,
    -- Matrice objectif × catégorie de format pour C1
    -- ex: {"NOTORIETE": {"SPOT": 1.0, "PARRAINAGE": 0.8, ...}}
    objective_matrix JSONB        NOT NULL,
    -- Nombre de passages recommandé par objectif pour C5
    repetition_targets JSONB      NOT NULL,
    is_active        BOOLEAN      NOT NULL DEFAULT FALSE,
    created_by       UUID         NOT NULL REFERENCES "user"(id),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Une seule version active à la fois
CREATE UNIQUE INDEX uq_scoring_weight_active
    ON scoring_weight_set (is_active) WHERE is_active = TRUE;

-- -----------------------------------------------------------------------------
-- ASSISTANT_SESSION / ASSISTANT_ANSWER / RECOMMENDATION
-- -----------------------------------------------------------------------------
CREATE TABLE assistant_session (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     UUID        REFERENCES project(id),
    session_key    VARCHAR(64) NOT NULL UNIQUE,  -- clé anonyme pour reprise
    status         VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS'
                       CHECK (status IN ('IN_PROGRESS','COMPLETED','ABANDONED')),
    current_step   INT         NOT NULL DEFAULT 1,
    weight_set_id  UUID        NOT NULL REFERENCES scoring_weight_set(id),
    started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at   TIMESTAMPTZ,
    source         VARCHAR(20) CHECK (source IN ('web','mobile','express'))
);

CREATE TABLE assistant_answer (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    assistant_session_id UUID        NOT NULL REFERENCES assistant_session(id) ON DELETE CASCADE,
    question_code        VARCHAR(20) NOT NULL,   -- ex: Q1, Q2b, Q4
    value                JSONB       NOT NULL,   -- réponse sérialisée
    answered_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (assistant_session_id, question_code)
);

CREATE TABLE recommendation (
    id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    assistant_session_id UUID          NOT NULL REFERENCES assistant_session(id) ON DELETE CASCADE,
    format_id            UUID          NOT NULL REFERENCES format(id),
    score                NUMERIC(5,2)  NOT NULL,
    criteria_scores      JSONB         NOT NULL,  -- détail C1→C6
    reasons              JSONB         NOT NULL,  -- justifications en langage naturel
    flags                JSONB,                   -- ex: AUDIENCE_NON_COMMUNIQUEE
    rank                 INT           NOT NULL,
    UNIQUE (assistant_session_id, format_id)
);

-- -----------------------------------------------------------------------------
-- SIMULATION : scénarios sauvegardés (§6.4, RG-S04)
-- -----------------------------------------------------------------------------
CREATE TABLE simulation (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID          NOT NULL REFERENCES project(id),
    label        VARCHAR(150),
    inputs       JSONB         NOT NULL,          -- paramètres saisis
    outputs      JSONB         NOT NULL,          -- résultats calculés
    total_ht     NUMERIC(14,2) NOT NULL,
    total_ttc    NUMERIC(14,2) NOT NULL,
    grp          NUMERIC(8,3),                    -- null si audience absente
    cpm          NUMERIC(10,2),                   -- null si audience absente
    data_flags   JSONB,                           -- ex: ["AUDIENCE_NON_COMMUNIQUEE"]
    -- Versionnage : figé à la création (RG-S04)
    rate_card_id UUID          NOT NULL REFERENCES rate_card(id),
    weight_set_id UUID         REFERENCES scoring_weight_set(id),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- QUOTE_REQUEST / QUOTE / QUOTE_LINE : demandes et devis
-- -----------------------------------------------------------------------------
CREATE TABLE quote_request (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    reference     VARCHAR(30)  NOT NULL UNIQUE,
    project_id    UUID         NOT NULL REFERENCES project(id),
    advertiser_id UUID         NOT NULL REFERENCES advertiser(id),
    contact_id    UUID         NOT NULL REFERENCES contact(id),
    objective     TEXT,
    message       TEXT,
    attachments   JSONB,
    status        VARCHAR(30)  NOT NULL DEFAULT 'SOUMISE'
                      CHECK (status IN (
                          'BROUILLON','SOUMISE','ACCUSE_RECU','EN_QUALIFICATION',
                          'EN_ATTENTE_CLIENT','DEVIS_EN_PREPARATION','DEVIS_ENVOYE',
                          'AJUSTEMENT_DEMANDE','ACCEPTE','REFUSE','EXPIRE','CLOS'
                      )),
    assigned_to   UUID         REFERENCES "user"(id),
    submitted_at  TIMESTAMPTZ,
    first_reply_at TIMESTAMPTZ,
    sla_due_at    TIMESTAMPTZ,
    deleted_at    TIMESTAMPTZ
);

CREATE TABLE quote (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_request_id UUID          NOT NULL REFERENCES quote_request(id),
    version          INT           NOT NULL DEFAULT 1,
    total_ht         NUMERIC(14,2) NOT NULL,
    tva_rate         NUMERIC(5,2)  NOT NULL,      -- paramétré par GTV (RG-11)
    total_ttc        NUMERIC(14,2) NOT NULL,
    conditions       TEXT,
    validity_days    INT           NOT NULL DEFAULT 30,
    status           VARCHAR(20)   NOT NULL DEFAULT 'DRAFT'
                         CHECK (status IN ('DRAFT','SENT','ACCEPTED','REFUSED','EXPIRED')),
    approved_by      UUID          REFERENCES "user"(id),
    sent_at          TIMESTAMPTZ,
    client_decision_at TIMESTAMPTZ,
    decision_reason  TEXT,
    UNIQUE (quote_request_id, version)
);

CREATE TABLE quote_line (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id     UUID          NOT NULL REFERENCES quote(id) ON DELETE CASCADE,
    label        VARCHAR(200)  NOT NULL,
    format_id    UUID          REFERENCES format(id),
    quantity     INT           NOT NULL CHECK (quantity > 0),
    unit_price_ht NUMERIC(12,2) NOT NULL,
    discount_pct NUMERIC(5,2)  NOT NULL DEFAULT 0,
    total_ht     NUMERIC(14,2) NOT NULL,
    sort_order   INT           NOT NULL DEFAULT 0
);

-- -----------------------------------------------------------------------------
-- APPOINTMENT : rendez-vous et rappels (M08)
-- -----------------------------------------------------------------------------
CREATE TABLE appointment (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_request_id UUID        REFERENCES quote_request(id),
    contact_id       UUID        NOT NULL REFERENCES contact(id),
    type             VARCHAR(20) NOT NULL CHECK (type IN ('callback','video','phone','onsite')),
    slot_start       TIMESTAMPTZ NOT NULL,
    slot_end         TIMESTAMPTZ NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','DONE')),
    assigned_to      UUID        REFERENCES "user"(id),
    notes            TEXT,
    ics_uid          VARCHAR(100) UNIQUE,
    CONSTRAINT chk_slot CHECK (slot_end > slot_start)
);

-- -----------------------------------------------------------------------------
-- MESSAGE / DOCUMENT : messagerie et GED
-- -----------------------------------------------------------------------------
CREATE TABLE message (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_request_id UUID        NOT NULL REFERENCES quote_request(id),
    author_type      VARCHAR(10) NOT NULL CHECK (author_type IN ('PROSPECT','SALES','SYSTEM')),
    author_id        UUID,
    body             TEXT        NOT NULL,
    attachments      JSONB,
    is_internal      BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at          TIMESTAMPTZ
);

CREATE TABLE document (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type   VARCHAR(30) NOT NULL,            -- 'quote_request', 'quote', etc.
    owner_id     UUID        NOT NULL,
    kind         VARCHAR(20) NOT NULL CHECK (kind IN ('brief','quote','technical_sheet','upload')),
    file_path    VARCHAR(500) NOT NULL,
    mime         VARCHAR(100) NOT NULL,
    size_bytes   BIGINT      NOT NULL,
    version      INT         NOT NULL DEFAULT 1,
    sha256       CHAR(64)    NOT NULL,            -- intégrité du fichier
    created_by   UUID        REFERENCES "user"(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- TRACKING_TOKEN : liens prospects sécurisés (§13, RG-08)
-- Token aléatoire ≥ 128 bits, stocké haché
-- -----------------------------------------------------------------------------
CREATE TABLE tracking_token (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash   CHAR(64)    NOT NULL UNIQUE,     -- SHA-256 du token brut
    subject_type VARCHAR(30) NOT NULL,            -- 'quote_request'
    subject_id   UUID        NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    use_count    INT         NOT NULL DEFAULT 0
);

-- -----------------------------------------------------------------------------
-- IMPORT_JOB : traçabilité des imports de données de référence (§11.2)
-- -----------------------------------------------------------------------------
CREATE TABLE import_job (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    kind         VARCHAR(20) NOT NULL CHECK (kind IN ('rate_card','audience','coefficient')),
    file_path    VARCHAR(500) NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','PRECHECK_OK','PRECHECK_FAIL','VALIDATED','ACTIVATED','REJECTED')),
    rows_total   INT,
    rows_ok      INT,
    rows_error   INT,
    error_report JSONB,
    uploaded_by  UUID        NOT NULL REFERENCES "user"(id),
    validated_by UUID        REFERENCES "user"(id),   -- second validateur (§11.2)
    activated_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- SETTING : paramètres globaux (TVA, devise, secteurs interdits…)
-- -----------------------------------------------------------------------------
CREATE TABLE setting (
    key        VARCHAR(100) PRIMARY KEY,
    value      JSONB        NOT NULL,
    label      VARCHAR(200),
    updated_by UUID         REFERENCES "user"(id),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Valeurs initiales des paramètres système
INSERT INTO setting (key, value, label) VALUES
    ('tva_rate',          '0',                    'Taux de TVA (%) — [À REMPLIR PAR GTV]'),
    ('currency',          '"XAF"',                'Devise'),
    ('basket_ttl_anon',   '7',                    'Durée de vie panier anonyme (jours)'),
    ('basket_ttl_auth',   '30',                   'Durée de vie panier prospect (jours)'),
    ('forbidden_sectors', '[]',                   'Secteurs interdits (liste paramétrable)'),
    ('demo_mode',         'true',                 'Mode démonstration actif');

-- -----------------------------------------------------------------------------
-- AUDIT_LOG : journal inaltérable (§13, §11.3)
-- -----------------------------------------------------------------------------
CREATE TABLE audit_log (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        REFERENCES "user"(id),
    action     VARCHAR(50) NOT NULL,              -- ex: RATE_CARD_ACTIVATED
    entity     VARCHAR(50) NOT NULL,
    entity_id  UUID,
    before     JSONB,
    after      JSONB,
    ip         INET,
    user_agent TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les requêtes d'audit fréquentes
CREATE INDEX idx_audit_entity    ON audit_log (entity, entity_id, occurred_at DESC);
CREATE INDEX idx_audit_user      ON audit_log (user_id, occurred_at DESC);
CREATE INDEX idx_audit_action    ON audit_log (action, occurred_at DESC);

-- -----------------------------------------------------------------------------
-- ANALYTICS_EVENT : collecte comportementale anonymisée (M12)
-- -----------------------------------------------------------------------------
CREATE TABLE analytics_event (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_key VARCHAR(64) NOT NULL,
    event_type  VARCHAR(50) NOT NULL,             -- ex: FORMAT_VIEWED, SIMULATION_STARTED
    entity_type VARCHAR(30),
    entity_id   UUID,
    payload     JSONB,
    page        VARCHAR(255),
    referrer    VARCHAR(255),
    device      VARCHAR(20),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_event ON analytics_event (event_type, occurred_at DESC);
CREATE INDEX idx_analytics_session ON analytics_event (session_key, occurred_at DESC);

-- -----------------------------------------------------------------------------
-- NOTIFICATION : file d'envoi (M15)
-- -----------------------------------------------------------------------------
CREATE TABLE notification (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    channel       VARCHAR(20) NOT NULL CHECK (channel IN ('email','internal','sms')),
    template_code VARCHAR(50) NOT NULL,
    recipient     VARCHAR(200) NOT NULL,
    payload       JSONB       NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING','SENT','FAILED','CANCELLED')),
    sent_at       TIMESTAMPTZ,
    error         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
