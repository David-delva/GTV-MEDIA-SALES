// =============================================================================
// GTV Media Sales — Tests unitaires du Simulateur Budgétaire
// Couvre : calculs dérivés, rééquilibrage, verrous, cas limites
// =============================================================================

import {
  lineNetPrice,
  computeSimulator,
  rebalanceLines,
  validateDiscount,
} from './simulatorEngine';
import type { SimulatorLine } from '../types/simulator';

// --- Fixtures DEMO_FICTIF ---

const makeLine = (overrides: Partial<SimulatorLine> & { id: string }): SimulatorLine => ({
  formatId: 'fmt-001',
  formatLabel: 'Spot 30s',
  daypart: 'PRIME',
  channel: 'GTV1',
  grossPriceUnit: 100_000,  // DEMO_FICTIF XAF
  quantity: 3,
  discountPct: 0,
  discountMaxPct: 20,
  isLocked: false,
  scoring: null,
  ...overrides,
});

const LINE_A = makeLine({ id: 'A', quantity: 3 });                    // net = 300 000
const LINE_B = makeLine({ id: 'B', quantity: 2 });                    // net = 200 000
const LINE_C = makeLine({ id: 'C', quantity: 5, isLocked: true });    // net = 500 000, verrouillée
const BUDGET  = 1_000_000; // DEMO_FICTIF XAF

describe('lineNetPrice', () => {
  test('sans remise : net = gross', () => {
    expect(lineNetPrice(LINE_A)).toBe(300_000);
  });

  test('avec remise 10% : net = gross × 0.9', () => {
    const line = makeLine({ id: 'X', quantity: 2, discountPct: 10 });
    expect(lineNetPrice(line)).toBeCloseTo(180_000);
  });
});

describe('computeSimulator', () => {
  test('calcule totalNet correctement', () => {
    const { totalNet } = computeSimulator([LINE_A, LINE_B, LINE_C], BUDGET);
    expect(totalNet).toBe(1_000_000); // 300k + 200k + 500k
  });

  test('isBalanced = true quand totalNet ≈ budgetTarget', () => {
    const { isBalanced } = computeSimulator([LINE_A, LINE_B, LINE_C], BUDGET);
    expect(isBalanced).toBe(true);
  });

  test('warning OVER_BUDGET si totalNet > budgetTarget', () => {
    const { warnings } = computeSimulator([LINE_A, LINE_B, LINE_C], 900_000);
    expect(warnings.some((w) => w.type === 'OVER_BUDGET')).toBe(true);
  });

  test('warning ALL_LOCKED si toutes les lignes sont verrouillées', () => {
    const allLocked = [
      makeLine({ id: 'A', isLocked: true }),
      makeLine({ id: 'B', isLocked: true }),
    ];
    const { warnings } = computeSimulator(allLocked, BUDGET);
    expect(warnings.some((w) => w.type === 'ALL_LOCKED')).toBe(true);
  });

  test('warning NO_LINES si tableau vide', () => {
    const { warnings } = computeSimulator([], BUDGET);
    expect(warnings.some((w) => w.type === 'NO_LINES')).toBe(true);
  });
});

describe('rebalanceLines — invariant Σ net ≈ budgetTarget', () => {
  test('rééquilibrage simple : augmenter A réduit B proportionnellement', () => {
    const lines = [LINE_A, LINE_B]; // total = 500 000
    const budget = 500_000;
    // On veut que A passe à 350 000 net → B doit passer à 150 000
    const result = rebalanceLines(lines, 'A', 350_000, budget);
    expect(result).not.toBeNull();
    const netA = lineNetPrice(result!.find((l) => l.id === 'A')!);
    const netB = lineNetPrice(result!.find((l) => l.id === 'B')!);
    expect(netA + netB).toBeCloseTo(budget, 0);
  });

  test('retourne null si toutes les autres lignes sont verrouillées', () => {
    const lines = [LINE_A, LINE_C]; // C est verrouillée
    const result = rebalanceLines(lines, 'A', 400_000, BUDGET);
    expect(result).toBeNull();
  });

  test('retourne null si le delta dépasse la capacité des lignes libres', () => {
    const lines = [LINE_A, makeLine({ id: 'B', quantity: 1 })]; // B net = 100 000
    // On veut augmenter A de 200 000 → B devrait passer à -100 000 (impossible)
    const result = rebalanceLines(lines, 'A', 500_000, 600_000);
    expect(result).toBeNull();
  });

  test('les lignes verrouillées ne sont pas modifiées', () => {
    const lines = [LINE_A, LINE_B, LINE_C];
    const result = rebalanceLines(lines, 'A', 350_000, BUDGET);
    expect(result).not.toBeNull();
    const lineC = result!.find((l) => l.id === 'C')!;
    expect(lineC.quantity).toBe(LINE_C.quantity); // inchangée
  });
});

describe('validateDiscount', () => {
  test('retourne null si remise dans les limites', () => {
    expect(validateDiscount(LINE_A, 15)).toBeNull();
  });

  test('retourne un warning si remise dépasse le plafond', () => {
    const warning = validateDiscount(LINE_A, 25); // plafond = 20
    expect(warning).not.toBeNull();
    expect(warning!.type).toBe('DISCOUNT_EXCEEDED');
  });
});
