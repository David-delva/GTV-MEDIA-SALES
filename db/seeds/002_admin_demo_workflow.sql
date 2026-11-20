BEGIN;

INSERT INTO client (id, name, sector)
VALUES
    ('91000000-0000-4000-8000-000000000001', 'Annonceur Démo Alpha', 'Agroalimentaire'),
    ('91000000-0000-4000-8000-000000000002', 'Annonceur Démo Boréal', 'Énergie'),
    ('91000000-0000-4000-8000-000000000003', 'Annonceur Démo Canopée', 'Habitat'),
    ('91000000-0000-4000-8000-000000000004', 'Annonceur Démo Horizon', 'Éducation')
ON CONFLICT DO NOTHING;

INSERT INTO project (
    id, reference, title, client_id, owner_id, status,
    campaign_start, campaign_end, budget_target, rate_card_id
)
SELECT sample.id, sample.reference, sample.title, client.id, owner.id,
       sample.status, sample.campaign_start::date, sample.campaign_end::date,
       sample.budget_target,
       (SELECT id FROM rate_card WHERE status = 'ACTIVE' ORDER BY valid_from DESC LIMIT 1)
FROM (VALUES
    ('92000000-0000-4000-8000-000000000001'::uuid, 'PRJ-DEMO-0002', 'Campagne de fin d’année', '91000000-0000-4000-8000-000000000001'::uuid, 'commercial.demo@gtv.local', 'SUBMITTED', '2026-12-01', '2026-12-31', 2500000::numeric),
    ('92000000-0000-4000-8000-000000000002'::uuid, 'PRJ-DEMO-0003', 'Lancement d’une offre énergie', '91000000-0000-4000-8000-000000000002'::uuid, 'commercial.demo@gtv.local', 'NEGOTIATION', '2026-11-25', '2027-01-15', 5000000::numeric),
    ('92000000-0000-4000-8000-000000000003'::uuid, 'PRJ-DEMO-0004', 'Notoriété habitat durable', '91000000-0000-4000-8000-000000000003'::uuid, 'admin.demo@gtv.local', 'DRAFT', '2027-02-01', '2027-02-28', 1800000::numeric)
) AS sample(id, reference, title, client_id, owner_email, status, campaign_start, campaign_end, budget_target)
JOIN client ON client.id = sample.client_id
JOIN "user" owner ON lower(owner.email) = sample.owner_email AND owner.is_active = TRUE
WHERE EXISTS (SELECT 1 FROM rate_card WHERE status = 'ACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO advertiser (id, company_name, sector_code, city, country)
VALUES
    ('93000000-0000-4000-8000-000000000001', 'Prospect Démo Alpha', 'AGROALIMENTAIRE', 'Libreville', 'Gabon'),
    ('93000000-0000-4000-8000-000000000002', 'Prospect Démo Boréal', 'ENERGIE', 'Port-Gentil', 'Gabon'),
    ('93000000-0000-4000-8000-000000000003', 'Prospect Démo Canopée', 'COMMERCE', 'Franceville', 'Gabon'),
    ('93000000-0000-4000-8000-000000000004', 'Prospect Démo Delta', 'EDUCATION', 'Libreville', 'Gabon'),
    ('93000000-0000-4000-8000-000000000005', 'Prospect Démo Émeraude', 'HABITAT', 'Oyem', 'Gabon'),
    ('93000000-0000-4000-8000-000000000006', 'Prospect Démo Falaise', 'CULTURE', 'Lambaréné', 'Gabon'),
    ('93000000-0000-4000-8000-000000000007', 'Prospect Démo Gabon', 'TOURISME', 'Mouila', 'Gabon'),
    ('93000000-0000-4000-8000-000000000008', 'Prospect Démo Horizon', 'SERVICES', 'Libreville', 'Gabon')
ON CONFLICT DO NOTHING;

INSERT INTO contact (id, advertiser_id, full_name, email, phone, consent_marketing)
VALUES
    ('94000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001', 'Contact Démo 01', 'contact01@example.invalid', NULL, FALSE),
    ('94000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002', 'Contact Démo 02', 'contact02@example.invalid', NULL, FALSE),
    ('94000000-0000-4000-8000-000000000003', '93000000-0000-4000-8000-000000000003', 'Contact Démo 03', 'contact03@example.invalid', NULL, FALSE),
    ('94000000-0000-4000-8000-000000000004', '93000000-0000-4000-8000-000000000004', 'Contact Démo 04', 'contact04@example.invalid', NULL, FALSE),
    ('94000000-0000-4000-8000-000000000005', '93000000-0000-4000-8000-000000000005', 'Contact Démo 05', 'contact05@example.invalid', NULL, FALSE),
    ('94000000-0000-4000-8000-000000000006', '93000000-0000-4000-8000-000000000006', 'Contact Démo 06', 'contact06@example.invalid', NULL, FALSE),
    ('94000000-0000-4000-8000-000000000007', '93000000-0000-4000-8000-000000000007', 'Contact Démo 07', 'contact07@example.invalid', NULL, FALSE),
    ('94000000-0000-4000-8000-000000000008', '93000000-0000-4000-8000-000000000008', 'Contact Démo 08', 'contact08@example.invalid', NULL, FALSE)
ON CONFLICT DO NOTHING;

INSERT INTO quote_request (
    id, reference, project_id, advertiser_id, contact_id, objective, message,
    campaign_brief, plan_snapshot, rate_card_id, status, submitted_at
)
SELECT sample.id, sample.reference, NULL, sample.advertiser_id, sample.contact_id,
       sample.objective, sample.message, sample.campaign_brief, sample.plan_snapshot,
       (SELECT id FROM rate_card WHERE status = 'ACTIVE' ORDER BY valid_from DESC LIMIT 1),
       sample.status, NOW() - sample.age
FROM (VALUES
    (
        '95000000-0000-4000-8000-000000000001'::uuid, 'GTV-2026-DEMO-001',
        '93000000-0000-4000-8000-000000000001'::uuid, '94000000-0000-4000-8000-000000000001'::uuid,
        'NOTORIETE', 'Faire connaître une nouvelle gamme de produits.',
        '{"objective":"NOTORIETE","targetSegment":"Familles","budgetHT":2500000,"periodStart":"2026-12-01","periodEnd":"2026-12-31","sectorCode":"AGROALIMENTAIRE"}'::jsonb,
        '[{"formatId":"20000000-0000-4000-8000-000000000001","formatLabel":"Spot 30 secondes - DEMO_FICTIF","daypart":"DAY","channel":"DEMO_TV_1","quantity":3,"grossPriceUnit":350000,"grossTotal":1050000,"currency":"XAF"}]'::jsonb,
        'SOUMISE', INTERVAL '1 day'
    ),
    (
        '95000000-0000-4000-8000-000000000002'::uuid, 'GTV-2026-DEMO-002',
        '93000000-0000-4000-8000-000000000002'::uuid, '94000000-0000-4000-8000-000000000002'::uuid,
        'TRAFIC', 'Présenter une nouvelle offre de services.',
        '{"objective":"TRAFIC","targetSegment":"Jeunes actifs","budgetHT":4000000,"periodStart":"2026-12-05","periodEnd":"2027-01-05","sectorCode":"ENERGIE"}'::jsonb,
        '[{"formatId":"20000000-0000-4000-8000-000000000002","formatLabel":"Parrainage emission - DEMO_FICTIF","daypart":"PRIME","channel":"DEMO_TV_1","quantity":2,"grossPriceUnit":1200000,"grossTotal":2400000,"currency":"XAF"}]'::jsonb,
        'ACCUSE_RECU', INTERVAL '2 days'
    ),
    (
        '95000000-0000-4000-8000-000000000003'::uuid, 'GTV-2026-DEMO-003',
        '93000000-0000-4000-8000-000000000003'::uuid, '94000000-0000-4000-8000-000000000003'::uuid,
        'LANCEMENT', 'Annoncer l’ouverture d’un nouveau point de vente.',
        '{"objective":"LANCEMENT","targetSegment":"Grand public","budgetHT":3200000,"periodStart":"2027-01-10","periodEnd":"2027-02-10","sectorCode":"COMMERCE"}'::jsonb,
        '[{"formatId":"20000000-0000-4000-8000-000000000001","formatLabel":"Spot 30 secondes - DEMO_FICTIF","daypart":"PRIME","channel":"DEMO_TV_1","quantity":2,"grossPriceUnit":750000,"grossTotal":1500000,"currency":"XAF"},{"formatId":"20000000-0000-4000-8000-000000000003","formatLabel":"Habillage antenne - DEMO_FICTIF","daypart":"PRIME","channel":"DEMO_TV_2","quantity":1,"grossPriceUnit":950000,"grossTotal":950000,"currency":"XAF"}]'::jsonb,
        'EN_QUALIFICATION', INTERVAL '3 days'
    ),
    (
        '95000000-0000-4000-8000-000000000004'::uuid, 'GTV-2026-DEMO-004',
        '93000000-0000-4000-8000-000000000004'::uuid, '94000000-0000-4000-8000-000000000004'::uuid,
        'SENSIBILISATION', 'Partager une campagne d’information avec le grand public.',
        '{"objective":"SENSIBILISATION","targetSegment":"Parents et élèves","budgetHT":1800000,"periodStart":"2027-01-15","periodEnd":"2027-02-15","sectorCode":"EDUCATION"}'::jsonb,
        '[{"formatId":"20000000-0000-4000-8000-000000000001","formatLabel":"Spot 30 secondes - DEMO_FICTIF","daypart":"DAY","channel":"DEMO_TV_1","quantity":2,"grossPriceUnit":350000,"grossTotal":700000,"currency":"XAF"}]'::jsonb,
        'EN_ATTENTE_CLIENT', INTERVAL '4 days'
    ),
    (
        '95000000-0000-4000-8000-000000000005'::uuid, 'GTV-2026-DEMO-005',
        '93000000-0000-4000-8000-000000000005'::uuid, '94000000-0000-4000-8000-000000000005'::uuid,
        'IMAGE', 'Développer la visibilité d’un programme de logements.',
        '{"objective":"IMAGE","targetSegment":"Ménages","budgetHT":3000000,"periodStart":"2027-02-01","periodEnd":"2027-03-01","sectorCode":"HABITAT"}'::jsonb,
        '[{"formatId":"20000000-0000-4000-8000-000000000003","formatLabel":"Habillage antenne - DEMO_FICTIF","daypart":"PRIME","channel":"DEMO_TV_2","quantity":1,"grossPriceUnit":950000,"grossTotal":950000,"currency":"XAF"}]'::jsonb,
        'DEVIS_EN_PREPARATION', INTERVAL '5 days'
    ),
    (
        '95000000-0000-4000-8000-000000000006'::uuid, 'GTV-2026-DEMO-006',
        '93000000-0000-4000-8000-000000000006'::uuid, '94000000-0000-4000-8000-000000000006'::uuid,
        'EVENEMENT', 'Promouvoir un rendez-vous culturel auprès des téléspectateurs.',
        '{"objective":"EVENEMENT","targetSegment":"Amateurs de culture","budgetHT":2200000,"periodStart":"2027-03-01","periodEnd":"2027-03-20","sectorCode":"CULTURE"}'::jsonb,
        '[{"formatId":"20000000-0000-4000-8000-000000000002","formatLabel":"Parrainage emission - DEMO_FICTIF","daypart":"DAY","channel":"DEMO_TV_1","quantity":1,"grossPriceUnit":800000,"grossTotal":800000,"currency":"XAF"}]'::jsonb,
        'DEVIS_ENVOYE', INTERVAL '6 days'
    ),
    (
        '95000000-0000-4000-8000-000000000007'::uuid, 'GTV-2026-DEMO-007',
        '93000000-0000-4000-8000-000000000007'::uuid, '94000000-0000-4000-8000-000000000007'::uuid,
        'PROMOTION', 'Mettre en avant une offre saisonnière.',
        '{"objective":"PROMOTION","targetSegment":"Voyageurs","budgetHT":1500000,"periodStart":"2027-04-01","periodEnd":"2027-04-30","sectorCode":"TOURISME"}'::jsonb,
        '[{"formatId":"20000000-0000-4000-8000-000000000001","formatLabel":"Spot 30 secondes - DEMO_FICTIF","daypart":"PRIME","channel":"DEMO_TV_2","quantity":1,"grossPriceUnit":600000,"grossTotal":600000,"currency":"XAF"}]'::jsonb,
        'ACCEPTE', INTERVAL '8 days'
    ),
    (
        '95000000-0000-4000-8000-000000000008'::uuid, 'GTV-2026-DEMO-008',
        '93000000-0000-4000-8000-000000000008'::uuid, '94000000-0000-4000-8000-000000000008'::uuid,
        'RECRUTEMENT', 'Présenter une campagne de recrutement nationale.',
        '{"objective":"RECRUTEMENT","targetSegment":"Jeunes diplômés","budgetHT":1200000,"periodStart":"2027-05-01","periodEnd":"2027-05-31","sectorCode":"SERVICES"}'::jsonb,
        '[{"formatId":"20000000-0000-4000-8000-000000000001","formatLabel":"Spot 30 secondes - DEMO_FICTIF","daypart":"DAY","channel":"DEMO_TV_1","quantity":2,"grossPriceUnit":350000,"grossTotal":700000,"currency":"XAF"}]'::jsonb,
        'REFUSE', INTERVAL '10 days'
    )
) AS sample(id, reference, advertiser_id, contact_id, objective, message, campaign_brief, plan_snapshot, status, age)
WHERE EXISTS (SELECT 1 FROM rate_card WHERE status = 'ACTIVE')
ON CONFLICT DO NOTHING;

COMMIT;
