// =============================================================================
// GTV Media Sales — Composant : ScoreBadge
// Affiche le score de scoring avec indicateur de mode dégradé
// =============================================================================

import React from 'react';
import type { ScoringResult } from '../../../types';

interface ScoreBadgeProps {
  scoring: ScoringResult | null;
  isLoading?: boolean;
}

export function ScoreBadge({ scoring, isLoading }: ScoreBadgeProps) {
  if (isLoading) {
    return <span className="inline-block w-12 h-5 bg-gray-200 animate-pulse rounded" />;
  }

  if (!scoring || scoring.mode === 'INDISPONIBLE') {
    return (
      <span className="inline-flex h-6 items-center rounded-full bg-slate-100 px-2 text-[11px] font-semibold text-slate-400">N/D</span>
    );
  }

  const score = scoring.score ?? 0;
  const colorClass =
    score >= 70 ? 'bg-emerald-100 text-emerald-800' :
    score >= 40 ? 'bg-amber-100 text-amber-800' :
                  'bg-red-100 text-red-800';

  return (
    <span
      className={`inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold ${colorClass}`}
      title={scoring.mode !== 'COMPLET' ? `Score partiel — données manquantes : ${scoring.missingCriteria.join(', ')}` : undefined}
    >
      {score.toFixed(1)}
      {scoring.mode !== 'COMPLET' && (
        <span aria-label="Données partielles" title="Score calculé sur données partielles">⚠</span>
      )}
    </span>
  );
}
