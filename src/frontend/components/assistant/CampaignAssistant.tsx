// =============================================================================
// GTV Media Sales — Composant : CampaignAssistant
// Module Star n°1 : affiche les options scorées et permet de les ajouter
// au simulateur budgétaire en un clic.
// =============================================================================

import React, { useState } from 'react';
import { ScoreBadge } from '../ui/ScoreBadge';
import { useSimulatorStore } from '../../store/simulatorStore';
import type { ScoringResult, ScoringInput } from '../../../types';

interface ScoredOption {
  option: Pick<ScoringInput, 'formatId' | 'daypart' | 'channel'>;
  formatLabel: string;
  grossPriceUnit: number;
  discountMaxPct: number;
  scoring: ScoringResult;
}

interface CampaignAssistantProps {
  options: ScoredOption[];   // résultat de POST /api/scoring/batch
  isLoading: boolean;
  targetSegment: string;
}

export function CampaignAssistant({ options, isLoading, targetSegment }: CampaignAssistantProps) {
  const { addLine } = useSimulatorStore();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const handleAdd = (opt: ScoredOption) => {
    const key = `${opt.option.formatId}-${opt.option.daypart}-${opt.option.channel}`;
    addLine({
      formatId:       opt.option.formatId,
      formatLabel:    opt.formatLabel,
      daypart:        opt.option.daypart,
      channel:        opt.option.channel,
      grossPriceUnit: opt.grossPriceUnit,
      discountMaxPct: opt.discountMaxPct,
      quantity:       1,
      discountPct:    0,
      isLocked:       false,
      scoring:        opt.scoring,
    });
    setAddedIds((prev) => new Set(prev).add(key));
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
        <p className="text-sm font-medium text-slate-500">Sélectionnez un segment cible</p>
        <p className="mt-1 text-xs text-slate-400">Les recommandations apparaîtront dans cette zone.</p>
      </div>
    );
  }

  const eligibleOptions = options.filter((opt) => opt.scoring.score !== null);
  if (eligibleOptions.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5">
        <p className="text-sm font-bold text-amber-800">Aucune recommandation exploitable</p>
        <p className="mt-1 text-xs leading-5 text-amber-700">
          Vérifiez la disponibilité tarifaire ou choisissez un autre segment. Les données absentes ne sont pas remplacées par des valeurs fictives.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" aria-label="Options recommandées par l'assistant">
      <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <strong className="text-slate-700">{targetSegment}</strong>
        <span className="mx-1.5 text-slate-300">/</span>
        {options.length} options classées
      </p>

      {options.map((opt) => {
        const key = `${opt.option.formatId}-${opt.option.daypart}-${opt.option.channel}`;
        const isAdded = addedIds.has(key);

        return (
          <div
            key={key}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <ScoreBadge scoring={opt.scoring} />
              <div className="min-w-0">
                <div className="break-words text-sm font-bold text-slate-800">{opt.formatLabel}</div>
                <div className="mt-0.5 break-words text-[11px] text-slate-500">
                  {opt.option.channel} · {opt.option.daypart} · {fmt(opt.grossPriceUnit)} XAF/passage
                </div>
                {/* Transparence algorithmique : affichage du détail des critères */}
                {opt.scoring.mode !== 'COMPLET' && (
                  <div className="mt-1 text-[11px] font-medium text-amber-700">
                    Données partielles
                  </div>
                )}
                {opt.scoring.reasons?.[0] && (
                  <div className="mt-1 max-w-[220px] text-[10px] leading-4 text-slate-400">
                    {opt.scoring.reasons[0]}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => handleAdd(opt)}
              disabled={isAdded}
              aria-label={isAdded ? `${opt.formatLabel} déjà ajouté` : `Ajouter ${opt.formatLabel} au simulateur`}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                isAdded
                  ? 'cursor-default bg-slate-100 text-slate-400'
                  : 'bg-[#0055B8] text-white hover:bg-[#00338D]'
              }`}
            >
              {isAdded ? '✓ Ajouté' : '+ Ajouter'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
