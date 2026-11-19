// =============================================================================
// GTV Media Sales — Hook : useQuoteSubmit
// Gère la logique de soumission du devis :
//   1. Construit le scoring_snapshot depuis l'état du simulateur
//   2. Appelle POST /api/projects/:id/submit
//   3. Gère les états loading / success / error
//
// POURQUOI un hook dédié : la page de soumission reste déclarative,
// toute la logique async est isolée et testable indépendamment.
// =============================================================================

import { useState, useCallback } from 'react';
import { projectsApi } from '../services/api';
import { useSimulatorStore } from '../store/simulatorStore';

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseQuoteSubmitReturn {
  status: SubmitStatus;
  error: string | null;
  submit: (projectId: string) => Promise<void>;
}

export function useQuoteSubmit(): UseQuoteSubmitReturn {
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const submit = useCallback(async (projectId: string) => {
    setStatus('loading');
    setError(null);

    // Construction du snapshot depuis l'état courant du simulateur
    // POURQUOI on sérialise les lignes ET le computed :
    // Le computed est recalculable, mais le figer évite toute ambiguïté
    // si les formules de calcul évoluent après la soumission.
    const { lines, computed, budgetTarget } = useSimulatorStore.getState();

    const scoringSnapshot = {
      capturedAt:   new Date().toISOString(),
      budgetTarget,
      lines: lines.map((l) => ({
        formatId:       l.formatId,
        formatLabel:    l.formatLabel,
        daypart:        l.daypart,
        channel:        l.channel,
        grossPriceUnit: l.grossPriceUnit,
        quantity:       l.quantity,
        discountPct:    l.discountPct,
        isLocked:       l.isLocked,
        scoring:        l.scoring,
      })),
      totals: {
        totalGross:  computed.totalGross,
        totalNet:    computed.totalNet,
        budgetUsagePct: computed.budgetUsagePct,
      },
    };

    try {
      await projectsApi.submit(projectId, scoringSnapshot);
      setStatus('success');
    } catch (err: unknown) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Erreur lors de la soumission');
    }
  }, []);

  return { status, error, submit };
}
