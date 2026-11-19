-- Donnees de demonstration uniquement. Aucun tarif ni chiffre d'audience reel.
BEGIN;

INSERT INTO "user" (id, email, name, role, password_hash, is_active)
VALUES
    ('10000000-0000-4000-8000-000000000001', 'admin.demo@gtv.local',
     'Administrateur DEMO_FICTIF', 'ADMIN',
     crypt('DEMO_FICTIF2026!', gen_salt('bf', 10)), TRUE),
    ('10000000-0000-4000-8000-000000000002', 'commercial.demo@gtv.local',
     'Commercial DEMO_FICTIF', 'COMMERCIAL',
     crypt('DEMO_FICTIF2026!', gen_salt('bf', 10)), TRUE)
ON CONFLICT (email) DO UPDATE
SET name = EXCLUDED.name,
    role = EXCLUDED.role,
    password_hash = EXCLUDED.password_hash,
    is_active = TRUE;

INSERT INTO format (id, code, label, category, duration_sec, is_active)
VALUES
    ('20000000-0000-4000-8000-000000000001', 'DEMO_SPOT_30S',
     'Spot 30 secondes - DEMO_FICTIF', 'SPOT', 30, TRUE),
    ('20000000-0000-4000-8000-000000000002', 'DEMO_PARRAINAGE',
     'Parrainage emission - DEMO_FICTIF', 'PARRAINAGE', NULL, TRUE),
    ('20000000-0000-4000-8000-000000000003', 'DEMO_HABILLAGE',
     'Habillage antenne - DEMO_FICTIF', 'HABILLAGE', NULL, TRUE)
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    category = EXCLUDED.category,
    duration_sec = EXCLUDED.duration_sec,
    is_active = TRUE;

INSERT INTO rate_card (id, name, valid_from, valid_to, status, created_by)
VALUES ('30000000-0000-4000-8000-000000000001',
        'Grille de demonstration DEMO_FICTIF',
        DATE '2026-01-01', NULL, 'ACTIVE',
        '10000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    valid_from = EXCLUDED.valid_from,
    valid_to = EXCLUDED.valid_to,
    status = EXCLUDED.status,
    created_by = EXCLUDED.created_by;

INSERT INTO rate_card_line
    (id, rate_card_id, format_id, daypart, channel, gross_price,
     discount_max_pct, currency, is_negotiable, support_id, duration_s)
VALUES
    ('40000000-0000-4000-8000-000000000001',
     '30000000-0000-4000-8000-000000000001',
     '20000000-0000-4000-8000-000000000001', 'PRIME', 'DEMO_TV_1',
     750000, 10, 'XAF', TRUE, NULL, 30),
    ('40000000-0000-4000-8000-000000000002',
     '30000000-0000-4000-8000-000000000001',
     '20000000-0000-4000-8000-000000000001', 'DAY', 'DEMO_TV_1',
     350000, 5, 'XAF', TRUE, NULL, 30),
    ('40000000-0000-4000-8000-000000000003',
     '30000000-0000-4000-8000-000000000001',
     '20000000-0000-4000-8000-000000000001', 'PRIME', 'DEMO_TV_2',
     600000, 10, 'XAF', TRUE, NULL, 30),
    ('40000000-0000-4000-8000-000000000004',
     '30000000-0000-4000-8000-000000000001',
     '20000000-0000-4000-8000-000000000002', 'PRIME', 'DEMO_TV_1',
     1200000, 8, 'XAF', TRUE, NULL, NULL),
    ('40000000-0000-4000-8000-000000000005',
     '30000000-0000-4000-8000-000000000001',
     '20000000-0000-4000-8000-000000000002', 'DAY', 'DEMO_TV_1',
     800000, 5, 'XAF', TRUE, NULL, NULL),
    ('40000000-0000-4000-8000-000000000006',
     '30000000-0000-4000-8000-000000000001',
     '20000000-0000-4000-8000-000000000003', 'PRIME', 'DEMO_TV_2',
     950000, 5, 'XAF', TRUE, NULL, NULL)
ON CONFLICT (id) DO UPDATE
SET gross_price = EXCLUDED.gross_price,
    discount_max_pct = EXCLUDED.discount_max_pct,
    currency = EXCLUDED.currency,
    is_negotiable = EXCLUDED.is_negotiable;

INSERT INTO audience_dataset
    (id, format_id, daypart, channel, period_start, period_end, source,
     target_segment, grp, reach_pct, affinity_index)
VALUES
    ('50000000-0000-4000-8000-000000000001',
     '20000000-0000-4000-8000-000000000001', 'PRIME', 'DEMO_TV_1',
     DATE '2026-07-01', DATE '2026-09-30', 'DEMO_FICTIF',
     'FEMMES_25_49', 12.5, 35, 125),
    ('50000000-0000-4000-8000-000000000002',
     '20000000-0000-4000-8000-000000000001', 'DAY', 'DEMO_TV_1',
     DATE '2026-07-01', DATE '2026-09-30', 'DEMO_FICTIF',
     'FEMMES_25_49', 8, 24, 108),
    ('50000000-0000-4000-8000-000000000003',
     '20000000-0000-4000-8000-000000000001', 'PRIME', 'DEMO_TV_2',
     DATE '2026-07-01', DATE '2026-09-30', 'DEMO_FICTIF',
     'FEMMES_25_49', 10, 30, 118),
    ('50000000-0000-4000-8000-000000000004',
     '20000000-0000-4000-8000-000000000002', 'PRIME', 'DEMO_TV_1',
     DATE '2026-07-01', DATE '2026-09-30', 'DEMO_FICTIF',
     'FEMMES_25_49', 15, 42, 132),
    ('50000000-0000-4000-8000-000000000005',
     '20000000-0000-4000-8000-000000000002', 'DAY', 'DEMO_TV_1',
     DATE '2026-07-01', DATE '2026-09-30', 'DEMO_FICTIF',
     'FEMMES_25_49', 9, 28, 110),
    ('50000000-0000-4000-8000-000000000006',
     '20000000-0000-4000-8000-000000000003', 'PRIME', 'DEMO_TV_2',
     DATE '2026-07-01', DATE '2026-09-30', 'DEMO_FICTIF',
     'FEMMES_25_49', 11, 33, 121),
    ('50000000-0000-4000-8000-000000000011',
     '20000000-0000-4000-8000-000000000001', 'PRIME', 'DEMO_TV_1',
     DATE '2026-07-01', DATE '2026-09-30', 'DEMO_FICTIF',
     'JEUNES_15_34', 14, 39, 130),
    ('50000000-0000-4000-8000-000000000012',
     '20000000-0000-4000-8000-000000000001', 'DAY', 'DEMO_TV_1',
     DATE '2026-07-01', DATE '2026-09-30', 'DEMO_FICTIF',
     'JEUNES_15_34', 7, 22, 105),
    ('50000000-0000-4000-8000-000000000013',
     '20000000-0000-4000-8000-000000000001', 'PRIME', 'DEMO_TV_2',
     DATE '2026-07-01', DATE '2026-09-30', 'DEMO_FICTIF',
     'JEUNES_15_34', 13, 36, 126),
    ('50000000-0000-4000-8000-000000000014',
     '20000000-0000-4000-8000-000000000002', 'PRIME', 'DEMO_TV_1',
     DATE '2026-07-01', DATE '2026-09-30', 'DEMO_FICTIF',
     'JEUNES_15_34', 16, 45, 136),
    ('50000000-0000-4000-8000-000000000015',
     '20000000-0000-4000-8000-000000000002', 'DAY', 'DEMO_TV_1',
     DATE '2026-07-01', DATE '2026-09-30', 'DEMO_FICTIF',
     'JEUNES_15_34', 8, 25, 109),
    ('50000000-0000-4000-8000-000000000016',
     '20000000-0000-4000-8000-000000000003', 'PRIME', 'DEMO_TV_2',
     DATE '2026-07-01', DATE '2026-09-30', 'DEMO_FICTIF',
     'JEUNES_15_34', 12, 34, 123)
ON CONFLICT (id) DO UPDATE
SET grp = EXCLUDED.grp,
    reach_pct = EXCLUDED.reach_pct,
    affinity_index = EXCLUDED.affinity_index,
    source = EXCLUDED.source;

INSERT INTO client (id, name, sector)
VALUES ('60000000-0000-4000-8000-000000000001',
        'Annonceur DEMO_FICTIF', 'DEMO_FICTIF')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    sector = EXCLUDED.sector;

INSERT INTO project
    (id, reference, title, client_id, owner_id, status,
     campaign_start, campaign_end, budget_target, rate_card_id)
VALUES
    ('70000000-0000-4000-8000-000000000001',
     'PRJ-DEMO-0001', 'Campagne de demonstration DEMO_FICTIF',
     '60000000-0000-4000-8000-000000000001',
     '10000000-0000-4000-8000-000000000002', 'DRAFT',
     DATE '2026-12-01', DATE '2027-01-31', 5000000,
     '30000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
    client_id = EXCLUDED.client_id,
    owner_id = EXCLUDED.owner_id,
    status = EXCLUDED.status,
    campaign_start = EXCLUDED.campaign_start,
    campaign_end = EXCLUDED.campaign_end,
    budget_target = EXCLUDED.budget_target,
    rate_card_id = EXCLUDED.rate_card_id;

COMMIT;
