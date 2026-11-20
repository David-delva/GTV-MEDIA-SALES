-- Donnees fictives de demonstration uniquement; aucun tarif GTV reel.
BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "user"
        WHERE lower(email) = 'admin.demo@gtv.local' AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Le compte admin.demo@gtv.local doit exister avant ce seed.';
    END IF;
END;
$$;

INSERT INTO format (id, code, label, category, duration_sec, is_active)
SELECT
    ('22000000-0000-4000-8000-' || lpad(sample.number::text, 12, '0'))::uuid,
    'DEMO_OTHER_' || lpad(sample.number::text, 2, '0'),
    sample.label || ' - DEMO_FICTIF',
    'AUTRE',
    sample.duration_sec,
    TRUE
FROM (VALUES
    (1, 'Bande-annonce web 15 secondes', 15),
    (2, 'Pre-roll web 15 secondes', 15),
    (3, 'Pre-roll web 30 secondes', 30),
    (4, 'Banniere display sur site', NULL),
    (5, 'Habillage de page d accueil', NULL),
    (6, 'Article sponsorise web', NULL),
    (7, 'Newsletter sponsorisee', NULL),
    (8, 'Publication sponsorisee reseaux sociaux', NULL),
    (9, 'Video sponsorisee reseaux sociaux 15 secondes', 15),
    (10, 'Video sponsorisee reseaux sociaux 30 secondes', 30),
    (11, 'Spot radio 20 secondes', 20),
    (12, 'Spot radio 30 secondes', 30),
    (13, 'Pre-roll podcast 15 secondes', 15),
    (14, 'Pre-roll podcast 30 secondes', 30),
    (15, 'Sponsoring d episode podcast', NULL),
    (16, 'Insertion audio streaming 15 secondes', 15),
    (17, 'Bandeau live streaming', NULL),
    (18, 'Overlay video streaming', NULL),
    (19, 'Placement de produit digital', NULL),
    (20, 'Jeu concours digital', NULL)
) AS sample(number, label, duration_sec)
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    category = EXCLUDED.category,
    duration_sec = EXCLUDED.duration_sec,
    is_active = TRUE;

INSERT INTO rate_card (id, name, valid_from, valid_to, status, created_by)
SELECT
    ('32000000-0000-4000-8000-' || lpad(sample.number::text, 12, '0'))::uuid,
    'Grille de demonstration AUTRE ' || lpad(sample.number::text, 2, '0') || ' - DEMO_FICTIF',
    DATE '2026-01-01',
    NULL,
    'DRAFT',
    owner.id
FROM generate_series(1, 20) AS sample(number)
CROSS JOIN "user" owner
WHERE lower(owner.email) = 'admin.demo@gtv.local'
  AND owner.is_active = TRUE
ON CONFLICT (id) DO NOTHING;

INSERT INTO rate_card_line (
    id, rate_card_id, format_id, daypart, channel, gross_price,
    discount_max_pct, currency, is_negotiable, support_id, duration_s
)
SELECT
    ('42000000-0000-4000-8000-' ||
      lpad(((grid.number - 1) * 20 + sample_format.number)::text, 12, '0'))::uuid,
    ('32000000-0000-4000-8000-' || lpad(grid.number::text, 12, '0'))::uuid,
    sample_format.id,
    'DAY',
    CASE
        WHEN sample_format.number <= 7 THEN 'DEMO_WEB'
        WHEN sample_format.number <= 10 THEN 'DEMO_SOCIAL'
        WHEN sample_format.number <= 12 THEN 'DEMO_RADIO'
        WHEN sample_format.number <= 16 THEN 'DEMO_AUDIO'
        ELSE 'DEMO_STREAMING'
    END,
    round((75000 + sample_format.number * 25000) * (1 + (grid.number - 1) * 0.02), 0),
    ((grid.number + sample_format.number) % 6) * 2,
    'XAF',
    TRUE,
    NULL,
    sample_format.duration_sec
FROM generate_series(1, 20) AS grid(number)
CROSS JOIN (
    SELECT id, code, duration_sec,
           row_number() OVER (ORDER BY code)::int AS number
    FROM format
    WHERE code LIKE 'DEMO_OTHER_%'
) AS sample_format
WHERE EXISTS (
    SELECT 1 FROM rate_card card
    WHERE card.id = ('32000000-0000-4000-8000-' || lpad(grid.number::text, 12, '0'))::uuid
      AND card.status = 'DRAFT'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
