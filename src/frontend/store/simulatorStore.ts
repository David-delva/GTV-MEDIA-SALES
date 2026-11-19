// =============================================================================
// GTV Media Sales — Store Zustand du Simulateur Budgétaire
//
// POURQUOI Zustand plutôt que Redux :
// - Moins de boilerplate pour un état complexe mais localisé
// - Pas de Provider à wrapper, accès direct depuis n'importe quel composant
// - Les actions sont co-localisées avec l'état → lisibilité pour la soutenance
//
// POURQUOI pas useState local :
// Le simulateur est partagé entre plusieurs composants (tableau, graphique,
// résumé budgétaire) → état global nécessaire.
// =============================================================================

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import {
  computeSimulator,
  rebalanceLines,
  validateDiscount,
} from '../../engine/simulatorEngine';
import type {
  SimulatorState,
  SimulatorLine,
  SimulatorWarning,
} from '../../types/simulator';

// État étendu avec les actions
interface SimulatorStore extends SimulatorState {
  // Actions
  setBudgetTarget: (budget: number) => void;
  addLine: (line: Omit<SimulatorLine, 'id'>) => void;
  removeLine: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  updateDiscount: (lineId: string, discountPct: number) => void;
  toggleLock: (lineId: string) => void;
  rebalance: (lineId: string, targetNetBudget: number) => { success: boolean; warning?: SimulatorWarning };
  reset: () => void;
}

const INITIAL_STATE: SimulatorState = {
  projectId: null,
  budgetTarget: 0,
  lines: [],
  computed: computeSimulator([], 0),
};

export const useSimulatorStore = create<SimulatorStore>()(
  devtools(
    (set, get) => ({
      ...INITIAL_STATE,

      setBudgetTarget: (budget) =>
        set((state) => ({
          budgetTarget: budget,
          computed: computeSimulator(state.lines, budget),
        })),

      addLine: (lineData) =>
        set((state) => {
          const newLines = [...state.lines, { ...lineData, id: nanoid() }];
          return { lines: newLines, computed: computeSimulator(newLines, state.budgetTarget) };
        }),

      removeLine: (lineId) =>
        set((state) => {
          const newLines = state.lines.filter((l) => l.id !== lineId);
          return { lines: newLines, computed: computeSimulator(newLines, state.budgetTarget) };
        }),

      updateQuantity: (lineId, quantity) =>
        set((state) => {
          const newLines = state.lines.map((l) =>
            l.id === lineId ? { ...l, quantity: Math.max(0, quantity) } : l
          );
          return { lines: newLines, computed: computeSimulator(newLines, state.budgetTarget) };
        }),

      updateDiscount: (lineId, discountPct) => {
        const line = get().lines.find((l) => l.id === lineId);
        if (!line) return;

        const warning = validateDiscount(line, discountPct);
        // On applique quand même mais on remonte le warning via le retour
        set((state) => {
          const newLines = state.lines.map((l) =>
            l.id === lineId
              ? { ...l, discountPct: Math.min(discountPct, l.discountMaxPct) }
              : l
          );
          return { lines: newLines, computed: computeSimulator(newLines, state.budgetTarget) };
        });
        // Le warning est géré par le composant appelant (pas dans le store)
        if (warning) console.warn('[Simulator]', warning.message);
      },

      toggleLock: (lineId) =>
        set((state) => {
          const newLines = state.lines.map((l) =>
            l.id === lineId ? { ...l, isLocked: !l.isLocked } : l
          );
          return { lines: newLines, computed: computeSimulator(newLines, state.budgetTarget) };
        }),

      /**
       * Rééquilibrage : modifie le budget d'une ligne et redistribue le delta
       * sur les lignes libres. Retourne { success: false } si impossible.
       */
      rebalance: (lineId, targetNetBudget) => {
        const state = get();
        const result = rebalanceLines(
          state.lines,
          lineId,
          targetNetBudget,
          state.budgetTarget
        );

        if (result === null) {
          return {
            success: false,
            warning: {
              type: 'ALL_LOCKED',
              message: 'Rééquilibrage impossible : aucune ligne libre disponible ou budget insuffisant.',
            },
          };
        }

        set({ lines: result, computed: computeSimulator(result, state.budgetTarget) });
        return { success: true };
      },

      reset: () => set(INITIAL_STATE),
    }),
    { name: 'SimulatorStore' } // nom visible dans Redux DevTools
  )
);
