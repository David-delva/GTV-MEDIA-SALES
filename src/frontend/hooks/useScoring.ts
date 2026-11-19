// =============================================================================
// GTV Media Sales — Hook : appel API scoring avec cache et gestion dégradée
// POURQUOI un hook dédié : isole la logique async du composant,
// réutilisable dans l'Assistant ET le Simulateur.
// =============================================================================

import { useState, useCallback } from 'react';
import type { ScoringResult, ScoringInput } from '../../types';

interface UseScoringReturn {
  score: ScoringResult | null;
  isLoading: boolean;
  isDegraded: boolean;   // true si HTTP 206
  error: string | null;
  fetchScore: (input: ScoringInput, rateCardId?: string) => Promise<ScoringResult | null>;
}

export function useScoring(): UseScoringReturn {
  const [score, setScore]       = useState<ScoringResult | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [isDegraded, setDegraded] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const fetchScore = useCallback(async (
    input: ScoringInput,
    rateCardId?: string
  ): Promise<ScoringResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, rateCardId }),
      });

      // HTTP 206 = mode dégradé (données partielles) — pas une erreur
      setDegraded(res.status === 206);

      if (!res.ok && res.status !== 206) {
        const body = await res.json();
        setError(body.error?.message ?? 'Erreur de scoring');
        return null;
      }

      const body = await res.json();
      setScore(body.data);
      return body.data;
    } catch {
      setError('Impossible de contacter le serveur.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { score, isLoading, isDegraded, error, fetchScore };
}
