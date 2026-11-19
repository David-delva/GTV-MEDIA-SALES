// =============================================================================
// GTV Media Sales — Tests unitaires du moteur de scoring
// Ces tests couvrent les cas nominaux ET les cas dégradés
// Exécution : npx jest scoringEngine.test.ts
// =============================================================================

import { scoreCampaignOption } from './scoringEngine';
import type { RateCardLine, AudienceDataset, ScoringInput } from '../types';

// --- Fixtures DEMO_FICTIF (données explicitement fictives pour les tests) ---

const DEMO_INPUT: ScoringInput = {
  formatId: 'fmt-001',
  daypart: 'PRIME',
  channel: 'GTV1',
  targetSegment: 'FEMMES_25_49',
};

const DEMO_RATE_LINE: RateCardLine = {
  id: 'rcl-001',
  rateCardId: 'rc-001',
  formatId: 'fmt-001',
  daypart: 'PRIME',
  channel: 'GTV1',
  grossPrice: 500_000,   // DEMO_FICTIF — XAF
  discountMaxPct: 15,
  currency: 'XAF',
  isNegotiable: true,
};

const DEMO_AUDIENCE_COMPLETE: AudienceDataset = {
  id: 'aud-001',
  formatId: 'fmt-001',
  daypart: 'PRIME',
  channel: 'GTV1',
  periodStart: '2025-01-01',
  periodEnd: '2025-03-31',
  source: 'DEMO_FICTIF',
  targetSegment: 'FEMMES_25_49',
  grp: 12.5,             // DEMO_FICTIF
  reachPct: 35.0,        // DEMO_FICTIF
  affinityIndex: 125,    // DEMO_FICTIF — au-dessus de la base 100
};

// --- Tests ---

describe('scoreCampaignOption', () => {

  test('retourne INDISPONIBLE si rateLine est null', () => {
    const result = scoreCampaignOption(DEMO_INPUT, null, DEMO_AUDIENCE_COMPLETE);
    expect(result.mode).toBe('INDISPONIBLE');
    expect(result.score).toBeNull();
  });

  test('retourne DÉGRADÉ_TOTAL si audience est null', () => {
    const result = scoreCampaignOption(DEMO_INPUT, DEMO_RATE_LINE, null);
    expect(result.mode).toBe('DÉGRADÉ_TOTAL');
    // dispo est toujours calculable, donc score ≠ null
    expect(result.score).not.toBeNull();
    expect(result.missingCriteria).toContain('affinite');
    expect(result.missingCriteria).toContain('reach');
  });

  test('retourne DÉGRADÉ_PARTIEL si seulement affinityIndex est null', () => {
    const partialAudience: AudienceDataset = {
      ...DEMO_AUDIENCE_COMPLETE,
      affinityIndex: null,
    };
    const result = scoreCampaignOption(DEMO_INPUT, DEMO_RATE_LINE, partialAudience);
    expect(result.mode).toBe('DÉGRADÉ_PARTIEL');
    expect(result.missingCriteria).toEqual(['affinite', 'efficacite']); // efficacite dépend aussi de CPM_REF_CONFIG=NaN
    expect(result.score).not.toBeNull();
  });

  test('les poids redistribués somment à 1 en mode dégradé', () => {
    const result = scoreCampaignOption(DEMO_INPUT, DEMO_RATE_LINE, null);
    const sumWeights = Object.values(result.detail).reduce(
      (acc, c) => acc + c.weight, 0
    );
    expect(sumWeights).toBeCloseTo(1, 5);
  });

  test('score COMPLET est entre 0 et 100', () => {
    // Note: CPM_REF_CONFIG = NaN en dev → efficacite sera null
    // Ce test valide la borne même en mode dégradé partiel
    const result = scoreCampaignOption(DEMO_INPUT, DEMO_RATE_LINE, DEMO_AUDIENCE_COMPLETE);
    expect(result.score).not.toBeNull();
    expect(result.score!).toBeGreaterThanOrEqual(0);
    expect(result.score!).toBeLessThanOrEqual(100);
  });

  test('dataFreshness reflète la période de l\'audience', () => {
    const result = scoreCampaignOption(DEMO_INPUT, DEMO_RATE_LINE, DEMO_AUDIENCE_COMPLETE);
    expect(result.dataFreshness).toBe('2025-03-31');
  });

  test('is_negotiable=false donne score dispo=0.5 (pas 0)', () => {
    const nonNegotiableLine = { ...DEMO_RATE_LINE, isNegotiable: false };
    const result = scoreCampaignOption(DEMO_INPUT, nonNegotiableLine, null);
    expect(result.detail.dispo.score).toBe(0.5);
  });

  test('retourne des explications transparentes sur les critères actifs', () => {
    const result = scoreCampaignOption(DEMO_INPUT, DEMO_RATE_LINE, DEMO_AUDIENCE_COMPLETE);
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});
