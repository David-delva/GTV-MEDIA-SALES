// =============================================================================
// GTV Media Sales — Tests du moteur de scoring complet (6 critères)
// Conforme EX-A01 : déterminisme vérifié, EX-A05 : assouplissement testé
// =============================================================================

import {
  scoreCampaignOptionFull,
  recommend,
  applyEliminationFilters,
  type ScoringCandidate,
  type CampaignBrief,
  type ScoringWeightSet,
} from './scoringEngineFull';

// --- Fixtures DEMO_FICTIF ---

const DEMO_WEIGHT_SET: ScoringWeightSet = {
  id: 'ws-demo',
  versionLabel: 'DEMO_V1',
  weights: { C1: 0.30, C2: 0.25, C3: 0.20, C4: 0.10, C5: 0.10, C6: 0.05 },
  objectiveMatrix: {
    NOTORIETE:      { SPOT: 1.0, PARRAINAGE: 0.8, HABILLAGE: 0.6, BANDEAU: 0.4, DIGITAL: 0.5, COMMUNIQUE: 0.2 },
    TRAFIC:         { SPOT: 0.7, PARRAINAGE: 0.5, HABILLAGE: 0.4, BANDEAU: 0.8, DIGITAL: 0.9, COMMUNIQUE: 0.3 },
    LANCEMENT:      { SPOT: 1.0, PARRAINAGE: 0.9, HABILLAGE: 0.7, BANDEAU: 0.5, DIGITAL: 0.6, COMMUNIQUE: 0.4 },
    PROMOTION:      { SPOT: 0.8, PARRAINAGE: 0.4, HABILLAGE: 0.3, BANDEAU: 0.9, DIGITAL: 0.8, COMMUNIQUE: 0.5 },
    IMAGE:          { SPOT: 0.7, PARRAINAGE: 1.0, HABILLAGE: 0.9, BANDEAU: 0.3, DIGITAL: 0.4, COMMUNIQUE: 0.6 },
    SENSIBILISATION:{ SPOT: 0.9, PARRAINAGE: 0.7, HABILLAGE: 0.5, BANDEAU: 0.6, DIGITAL: 0.7, COMMUNIQUE: 0.8 },
    RECRUTEMENT:    { SPOT: 0.5, PARRAINAGE: 0.3, HABILLAGE: 0.2, BANDEAU: 0.7, DIGITAL: 0.9, COMMUNIQUE: 0.6 },
    EVENEMENT:      { SPOT: 0.8, PARRAINAGE: 0.9, HABILLAGE: 0.7, BANDEAU: 0.6, DIGITAL: 0.7, COMMUNIQUE: 0.5 },
  },
  repetitionTargets: {
    NOTORIETE: 15, TRAFIC: 8, LANCEMENT: 20, PROMOTION: 10,
    IMAGE: 12, SENSIBILISATION: 18, RECRUTEMENT: 6, EVENEMENT: 5,
  },
};

const DEMO_BRIEF: CampaignBrief = {
  objective:       'NOTORIETE',
  targetSegment:   'FEMMES_25_49',
  budgetHT:        5_000_000,   // DEMO_FICTIF XAF
  flexibility:     0.10,
  periodStart:     '2025-06-01',
  periodEnd:       '2025-07-15',
  sectorCode:      'BRASSERIE',
  wantsExclusivity: false,
};

const DEMO_CANDIDATE: ScoringCandidate = {
  formatId:         'fmt-spot-30',
  formatCategory:   'SPOT',
  channel:          'CHAINE-DEMO-1',
  daypart:          'PRIME',
  grossPriceUnit:   200_000,    // DEMO_FICTIF XAF
  minOrder:         5,
  leadTimeDays:     7,
  isPublished:      true,
  affinityIndex:    125,        // DEMO_FICTIF
  reachPct:         35,         // DEMO_FICTIF
  grp:              12,         // DEMO_FICTIF
  sectorAffinities: ['BRASSERIE', 'TELECOM'],
  sectorExclusions: [],
};

const CAMPAIGN_DURATION = 44; // jours entre 01/06 et 15/07

describe('applyEliminationFilters', () => {
  test('passe un candidat valide', () => {
    const result = applyEliminationFilters(DEMO_CANDIDATE, DEMO_BRIEF, CAMPAIGN_DURATION);
    expect(result.passed).toBe(true);
  });

  test('élimine un format non publié', () => {
    const result = applyEliminationFilters(
      { ...DEMO_CANDIDATE, isPublished: false }, DEMO_BRIEF, CAMPAIGN_DURATION
    );
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('non publié');
  });

  test('élimine si coût d\'entrée > budget × (1 + flexibilité)', () => {
    const expensiveCandidate = { ...DEMO_CANDIDATE, grossPriceUnit: 1_000_000, minOrder: 10 };
    // coût entrée = 10M > 5M × 1.10 = 5.5M
    const result = applyEliminationFilters(expensiveCandidate, DEMO_BRIEF, CAMPAIGN_DURATION);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('budget maximum');
  });

  test('élimine si secteur incompatible', () => {
    const result = applyEliminationFilters(
      { ...DEMO_CANDIDATE, sectorExclusions: ['BRASSERIE'] }, DEMO_BRIEF, CAMPAIGN_DURATION
    );
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('BRASSERIE');
  });
});

describe('scoreCampaignOptionFull', () => {
  test('score entre 0 et 100', () => {
    const result = scoreCampaignOptionFull(DEMO_CANDIDATE, DEMO_BRIEF, DEMO_WEIGHT_SET, CAMPAIGN_DURATION);
    expect(result.isExcluded).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test('EX-A01 — déterminisme : mêmes entrées → même score', () => {
    const r1 = scoreCampaignOptionFull(DEMO_CANDIDATE, DEMO_BRIEF, DEMO_WEIGHT_SET, CAMPAIGN_DURATION);
    const r2 = scoreCampaignOptionFull(DEMO_CANDIDATE, DEMO_BRIEF, DEMO_WEIGHT_SET, CAMPAIGN_DURATION);
    expect(r1.score).toBe(r2.score);
  });

  test('C2 neutralisé à 0.5 si affinityIndex null + flag AUDIENCE_NON_COMMUNIQUEE', () => {
    const result = scoreCampaignOptionFull(
      { ...DEMO_CANDIDATE, affinityIndex: null }, DEMO_BRIEF, DEMO_WEIGHT_SET, CAMPAIGN_DURATION
    );
    expect(result.criteriaScores.C2.isNeutral).toBe(true);
    expect(result.criteriaScores.C2.value).toBe(0.5);
    expect(result.flags).toContain('AUDIENCE_NON_COMMUNIQUEE');
  });

  test('C6 bonus si secteur dans sectorAffinities', () => {
    const withAffinity    = scoreCampaignOptionFull(DEMO_CANDIDATE, DEMO_BRIEF, DEMO_WEIGHT_SET, CAMPAIGN_DURATION);
    const withoutAffinity = scoreCampaignOptionFull(
      { ...DEMO_CANDIDATE, sectorAffinities: [] }, DEMO_BRIEF, DEMO_WEIGHT_SET, CAMPAIGN_DURATION
    );
    expect(withAffinity.score).toBeGreaterThan(withoutAffinity.score);
  });

  test('3 raisons retournées', () => {
    const result = scoreCampaignOptionFull(DEMO_CANDIDATE, DEMO_BRIEF, DEMO_WEIGHT_SET, CAMPAIGN_DURATION);
    expect(result.reasons).toHaveLength(3);
    result.reasons.forEach((r) => expect(typeof r).toBe('string'));
  });

  test('redistribue les poids sans pénaliser les données absentes', () => {
    const result = scoreCampaignOptionFull(
      { ...DEMO_CANDIDATE, affinityIndex: null },
      DEMO_BRIEF,
      DEMO_WEIGHT_SET,
      CAMPAIGN_DURATION
    );
    const sumWeights = Object.values(result.criteriaScores).reduce(
      (sum, criterion) => sum + criterion.weight,
      0
    );
    expect(result.criteriaScores.C2.weight).toBe(0);
    expect(sumWeights).toBeCloseTo(1, 5);
  });
});

describe('recommend — EX-A05', () => {
  test('retourne un message d\'assouplissement si aucun candidat ne passe', () => {
    const tooExpensive: ScoringCandidate = {
      ...DEMO_CANDIDATE,
      grossPriceUnit: 10_000_000,
      minOrder: 10,
    };
    const { results, hasAssouplissement, assouplissementMessage } = recommend(
      [tooExpensive], DEMO_BRIEF, DEMO_WEIGHT_SET, CAMPAIGN_DURATION
    );
    expect(results).toHaveLength(0);
    expect(hasAssouplissement).toBe(true);
    expect(assouplissementMessage).toBeTruthy();
  });

  test('classe les résultats par score décroissant', () => {
    const lowScore: ScoringCandidate = {
      ...DEMO_CANDIDATE,
      formatId: 'fmt-low',
      formatCategory: 'COMMUNIQUE',
      affinityIndex: 60,
    };
    const { results } = recommend(
      [DEMO_CANDIDATE, lowScore], DEMO_BRIEF, DEMO_WEIGHT_SET, CAMPAIGN_DURATION
    );
    expect(results[0].score).toBeGreaterThanOrEqual(results[1]?.score ?? 0);
    expect(results[0].rank).toBe(1);
  });
});
