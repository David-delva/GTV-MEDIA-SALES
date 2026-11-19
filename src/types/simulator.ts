// =============================================================================
// GTV Media Sales — Types du Simulateur Budgétaire
// =============================================================================

import type { Daypart, ScoringResult } from './index';

// Une ligne du plan média dans le simulateur
export interface SimulatorLine {
  id: string;                    // identifiant unique de la ligne
  formatId: string;
  formatLabel: string;           // ex: "Spot 30s"
  daypart: Daypart;
  channel: string;
  grossPriceUnit: number;        // prix unitaire brut (depuis rate_card_line)
  quantity: number;              // nombre de passages
  discountPct: number;           // remise négociée (0 à discountMaxPct)
  discountMaxPct: number;        // plafond de remise autorisé
  isLocked: boolean;             // verrou : cette ligne ne participe pas au rééquilibrage
  scoring: ScoringResult | null; // résultat du moteur de scoring (peut être null)
}

// État global du simulateur
export interface SimulatorState {
  projectId: string | null;
  budgetTarget: number;          // budget total cible fixé par le client
  lines: SimulatorLine[];
  // Résultats calculés (dérivés, jamais stockés directement)
  computed: SimulatorComputed;
}

// Valeurs calculées — recalculées à chaque mutation d'état
export interface SimulatorComputed {
  totalGross: number;            // Σ (grossPriceUnit × quantity)
  totalNet: number;              // Σ (grossPriceUnit × quantity × (1 - discountPct/100))
  totalBudgetAllocated: number;  // = totalNet (alias sémantique)
  budgetRemaining: number;       // budgetTarget - totalNet
  budgetUsagePct: number;        // totalNet / budgetTarget × 100
  isBalanced: boolean;           // |budgetRemaining| < TOLERANCE
  canRebalance: boolean;         // au moins une ligne libre existe
  warnings: SimulatorWarning[];
}

export interface SimulatorWarning {
  type: 'OVER_BUDGET' | 'UNDER_BUDGET' | 'ALL_LOCKED' | 'DISCOUNT_EXCEEDED' | 'NO_LINES';
  message: string;
  lineId?: string;
}

// Actions possibles sur le simulateur
export type SimulatorAction =
  | { type: 'SET_BUDGET_TARGET'; payload: number }
  | { type: 'ADD_LINE'; payload: Omit<SimulatorLine, 'id'> }
  | { type: 'REMOVE_LINE'; payload: { lineId: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { lineId: string; quantity: number } }
  | { type: 'UPDATE_DISCOUNT'; payload: { lineId: string; discountPct: number } }
  | { type: 'TOGGLE_LOCK'; payload: { lineId: string } }
  | { type: 'REBALANCE'; payload: { lineId: string; targetBudget: number } }
  | { type: 'RESET' };
