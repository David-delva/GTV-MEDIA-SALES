// =============================================================================
// GTV Media Sales — Tests du calculateur de simulation (§6.3 CDCF)
// Vérifie : précision décimale, coefficients, remises, flags données manquantes
// =============================================================================

import {
  computeCoutBrut,
  computeTauxRemise,
  computeSimulation,
  type SimulationLineInput,
  type LineReferenceData,
} from './simulationCalculator';

describe('computeCoutBrut — précision décimale (ENF-13)', () => {
  test('calcul sans coefficients : tarif × quantité', () => {
    const { coutBrutCentimes, flags } = computeCoutBrut(100_000, 5, null, null);
    // 100 000 × 5 = 500 000 XAF = 50 000 000 centimes
    expect(coutBrutCentimes).toBe(50_000_000);
    expect(flags).toContain('COEF_TRANCHE_ABSENT');
    expect(flags).toContain('COEF_SAISONNALITE_ABSENT');
  });

  test('avec coefTranche prime time 1.5', () => {
    const { coutBrutCentimes, flags } = computeCoutBrut(100_000, 3, 1.5, 1.0);
    // 100 000 × 3 × 1.5 × 1.0 = 450 000 XAF
    expect(coutBrutCentimes).toBe(45_000_000);
    expect(flags).toHaveLength(0);
  });

  test('pas d\'erreur de flottant sur des valeurs décimales', () => {
    // Test classique 0.1 + 0.2 en version monétaire
    const { coutBrutCentimes } = computeCoutBrut(333.33, 3, 1.0, 1.0);
    // 333.33 × 3 = 999.99 XAF — doit être exact en centimes
    expect(coutBrutCentimes).toBe(99_999); // 999.99 XAF en centimes
  });
});

describe('computeTauxRemise', () => {
  const rules = [
    { type: 'volume' as const, thresholdQty: 5,  ratePct: 5  },
    { type: 'volume' as const, thresholdQty: 10, ratePct: 10 },
    { type: 'volume' as const, thresholdQty: 20, ratePct: 15 },
  ];

  test('aucune remise si quantité < seuil minimum', () => {
    expect(computeTauxRemise(3, rules)).toBe(0);
  });

  test('palier 5% pour qty=7', () => {
    expect(computeTauxRemise(7, rules)).toBeCloseTo(0.05);
  });

  test('palier 15% pour qty=25', () => {
    expect(computeTauxRemise(25, rules)).toBeCloseTo(0.15);
  });

  test('aucune remise si règles vides (RG-05)', () => {
    expect(computeTauxRemise(100, [])).toBe(0);
  });
});

describe('computeSimulation — intégration complète', () => {
  const lineInput: SimulationLineInput = {
    formatId:    'fmt-spot-30',
    supportId:   'sup-gtv1',
    daypart:     'PRIME',
    durationSec: 30,
    quantity:    10,
    periodStart: '2025-06-01',
    periodEnd:   '2025-07-15',
    isLocked:    false,
  };

  const refData: LineReferenceData = {
    tarifBase:        100_000,   // DEMO_FICTIF XAF
    minOrder:         5,
    coefTranche:      1.5,       // prime time
    coefSaisonnalite: 1.0,
    discountRules:    [{ type: 'volume', thresholdQty: 10, ratePct: 10 }],
    audienceAbsolue:  50_000,    // DEMO_FICTIF contacts/passage
    partAudiencePct:  5.0,       // DEMO_FICTIF %
  };

  const refMap = new Map([['fmt-spot-30', refData]]);

  test('calcul complet : brut, remise, net, GRP, CPM', () => {
    const output = computeSimulation([lineInput], refMap, 1_500_000, 0.18);

    // Brut = 100 000 × 10 × 1.5 × 1.0 = 1 500 000 XAF
    expect(output.lines[0].coutBrutHT).toBe(1_500_000);

    // Remise 10% → net = 1 350 000 XAF
    expect(output.lines[0].coutNetHT).toBe(1_350_000);
    expect(output.lines[0].tauxRemise).toBeCloseTo(0.10);

    // GRP = 5.0% × 10 passages = 50 GRP
    expect(output.grpTotal).toBe(50);

    // Contacts = 50 000 × 10 = 500 000
    expect(output.totalContacts).toBe(500_000);

    // CPM = 1 350 000 / (500 000 / 1000) = 2 700 XAF
    expect(output.cpmTotal).toBeCloseTo(2_700);
  });

  test('flag AUDIENCE_NON_COMMUNIQUEE si audienceAbsolue null', () => {
    const refNoAudience: LineReferenceData = { ...refData, audienceAbsolue: null, partAudiencePct: null };
    const output = computeSimulation([lineInput], new Map([['fmt-spot-30', refNoAudience]]), 1_500_000, 0.18);
    expect(output.dataFlags).toContain('AUDIENCE_NON_COMMUNIQUEE');
    expect(output.grpTotal).toBeNull();
    expect(output.cpmTotal).toBeNull();
  });

  test('budgetStatus "over_hard" si total > 110% du budget', () => {
    const output = computeSimulation([lineInput], refMap, 1_000_000, 0.18);
    // total net = 1 350 000 > 1 000 000 × 1.10 = 1 100 000
    expect(output.budgetStatus).toBe('over_hard');
  });

  test('disclaimer toujours présent', () => {
    const output = computeSimulation([lineInput], refMap, 2_000_000, 0.18);
    expect(output.disclaimer).toContain('indicative');
    expect(output.disclaimer).toContain('non contractuelle');
  });
});
