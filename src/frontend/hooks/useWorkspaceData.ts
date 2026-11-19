// =============================================================================
// GTV Media Sales — Hook : useWorkspaceData
// Charge toutes les données nécessaires à la page ProjectWorkspace :
//   1. Grille tarifaire active (formats + lignes tarifaires)
//   2. Segments d'audience disponibles
//   3. Déclenche le scoring batch quand le segment change
//
// POURQUOI un hook dédié et non du fetch dans le composant :
// Sépare la logique de chargement de la logique d'affichage.
// Le composant reste déclaratif, le hook gère l'async.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  rateCardsApi,
  audienceApi,
  scoringApi,
  type ActiveRateCardDto,
  type ScoredOptionDto,
  type RateCardLineDto,
  type FormatDto,
} from '../services/api';
import { formatsApi } from '../services/api';

interface WorkspaceData {
  rateCard: ActiveRateCardDto | null;
  formats: FormatDto[];
  availableSegments: string[];
  scoredOptions: EnrichedScoredOption[];
  isLoadingRateCard: boolean;
  isLoadingOptions: boolean;
  error: string | null;
  fetchOptionsForSegment: (segment: string) => Promise<void>;
}

// Option scorée enrichie avec les données tarifaires et le label format
export interface EnrichedScoredOption extends ScoredOptionDto {
  formatLabel: string;
  grossPriceUnit: number;
  discountMaxPct: number;
}

export function useWorkspaceData(projectRateCardId?: string): WorkspaceData {
  const [rateCard, setRateCard]               = useState<ActiveRateCardDto | null>(null);
  const [formats, setFormats]                 = useState<FormatDto[]>([]);
  const [availableSegments, setSegments]      = useState<string[]>([]);
  const [scoredOptions, setScoredOptions]     = useState<EnrichedScoredOption[]>([]);
  const [isLoadingRateCard, setLoadingCard]   = useState(true);
  const [isLoadingOptions, setLoadingOptions] = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  // Chargement initial : grille tarifaire + formats + segments disponibles
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingCard(true);
      setError(null);
      try {
        // Chargement parallèle pour minimiser la latence perçue
        const [cardResult, formatsResult] = await Promise.all([
          rateCardsApi.getActive(),
          formatsApi.list(),
        ]);

        if (cancelled) return;

        setRateCard(cardResult.data);
        setFormats(formatsResult.data);

        // Segments disponibles pour cette grille
        const segResult = await audienceApi.allSegments(
          projectRateCardId ?? cardResult.data.id
        );
        if (!cancelled) setSegments(segResult.data);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoadingCard(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [projectRateCardId]);

  // Scoring batch déclenché à la sélection d'un segment
  const fetchOptionsForSegment = useCallback(async (segment: string) => {
    if (!rateCard || !segment) return;

    setLoadingOptions(true);
    try {
      // Construction des options à scorer depuis les lignes de la grille active
      const optionsToScore = rateCard.lines.map((line) => ({
        formatId: line.formatId,
        daypart:  line.daypart as import('../../types').Daypart,
        channel:  line.channel,
      }));

      const result = await scoringApi.batch(optionsToScore, segment, rateCard.id);

      // Enrichissement : on joint les données tarifaires et le label format
      const enriched: EnrichedScoredOption[] = result.data
        .map((scored) => {
          const rateLine = findRateLine(rateCard.lines, scored.option);
          const format   = formats.find((f) => f.id === scored.option.formatId);
          if (!rateLine || !format) return null;

          return {
            ...scored,
            formatLabel:    format.label,
            grossPriceUnit: rateLine.grossPrice,
            discountMaxPct: rateLine.discountMaxPct,
          } as EnrichedScoredOption;
        })
        .filter((o): o is EnrichedScoredOption => o !== null);

      setScoredOptions(enriched);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de scoring');
    } finally {
      setLoadingOptions(false);
    }
  }, [rateCard, formats]);

  return {
    rateCard,
    formats,
    availableSegments,
    scoredOptions,
    isLoadingRateCard,
    isLoadingOptions,
    error,
    fetchOptionsForSegment,
  };
}

// Recherche d'une ligne tarifaire par clé composite
function findRateLine(
  lines: RateCardLineDto[],
  option: { formatId: string; daypart: string; channel: string }
): RateCardLineDto | undefined {
  return lines.find(
    (l) =>
      l.formatId === option.formatId &&
      l.daypart  === option.daypart  &&
      l.channel  === option.channel
  );
}
