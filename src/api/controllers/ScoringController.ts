// =============================================================================
// GTV Media Sales — Controller : Scoring
// Point d'entrée HTTP du moteur de scoring.
// Retourne HTTP 200 (COMPLET), 206 (DÉGRADÉ_PARTIEL), ou 404 (INDISPONIBLE)
// POURQUOI 206 Partial Content pour le mode dégradé :
// la réponse est valide mais incomplète — le frontend peut l'afficher
// avec un bandeau d'avertissement sans traiter ça comme une erreur.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { RateCardRepository } from '../repositories/RateCardRepository';
import { AudienceRepository } from '../repositories/AudienceRepository';
import { scoreCampaignOption } from '../../engine/scoringEngine';
import { Errors } from '../errors/AppError';
import type { ApiResponse } from '../types';
import type { ScoringResult, ScoringInput } from '../../types';

export class ScoringController {
  constructor(
    private readonly rateCardRepo: RateCardRepository,
    private readonly audienceRepo: AudienceRepository
  ) {}

  /**
   * POST /api/scoring
   * Body: { formatId, daypart, channel, targetSegment, rateCardId? }
   *
   * rateCardId est optionnel : si absent, on utilise la grille ACTIVE du jour.
   * Cela permet de scorer sur une grille future (simulation).
   */
  score = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { formatId, daypart, channel, targetSegment, rateCardId } = req.body as {
        formatId?: string;
        daypart?: string;
        channel?: string;
        targetSegment?: string;
        rateCardId?: string;
      };

      // Validation des champs obligatoires
      const missing = ['formatId', 'daypart', 'channel', 'targetSegment'].filter(
        (k) => !req.body[k]
      );
      if (missing.length) return next(Errors.validation({ required: missing }));

      const input: ScoringInput = {
        formatId: formatId!,
        daypart: daypart as ScoringInput['daypart'],
        channel: channel!,
        targetSegment: targetSegment!,
      };

      // Résolution de la grille tarifaire
      let resolvedRateCardId = rateCardId;
      if (!resolvedRateCardId) {
        const active = await this.rateCardRepo.findActive();
        if (!active) return next(Errors.notFound('rate_card', 'active'));
        resolvedRateCardId = active.id;
      }

      // Récupération parallèle des deux sources de données
      const [rateLine, audience] = await Promise.all([
        this.rateCardRepo.findLine(resolvedRateCardId, input.formatId, input.daypart, input.channel),
        this.audienceRepo.findLatest(input.formatId, input.daypart, input.channel, input.targetSegment),
      ]);

      const result = scoreCampaignOption(input, rateLine, audience);

      // HTTP 404 si le tarif est introuvable (bloquant dur)
      if (result.mode === 'INDISPONIBLE') {
        return next(Errors.notFound('rate_card_line', `${input.daypart}/${input.channel}`));
      }

      const body: ApiResponse<ScoringResult> = { success: true, data: result };

      // HTTP 206 si données partielles — le frontend affiche un avertissement
      const statusCode = result.mode === 'DÉGRADÉ_PARTIEL' || result.mode === 'DÉGRADÉ_TOTAL'
        ? 206
        : 200;

      res.status(statusCode).json(body);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/scoring/batch
   * Scorer plusieurs options en une seule requête (pour l'Assistant de Campagne
   * qui affiche un tableau comparatif de N options).
   * POURQUOI batch : évite N appels HTTP depuis le frontend, réduit la latence.
   */
  scoreBatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { options, targetSegment, rateCardId } = req.body as {
        options?: Array<{ formatId: string; daypart: string; channel: string }>;
        targetSegment?: string;
        rateCardId?: string;
      };

      if (!options?.length || !targetSegment) {
        return next(Errors.validation({ required: ['options', 'targetSegment'] }));
      }

      let resolvedRateCardId = rateCardId;
      if (!resolvedRateCardId) {
        const active = await this.rateCardRepo.findActive();
        if (!active) return next(Errors.notFound('rate_card', 'active'));
        resolvedRateCardId = active.id;
      }

      // Toutes les options sont scorées en parallèle
      const results = await Promise.all(
        options.map(async (opt) => {
          const input: ScoringInput = {
            ...opt,
            daypart: opt.daypart as ScoringInput['daypart'],
            targetSegment,
          };
          const [rateLine, audience] = await Promise.all([
            this.rateCardRepo.findLine(resolvedRateCardId!, input.formatId, input.daypart, input.channel),
            this.audienceRepo.findLatest(input.formatId, input.daypart, input.channel, targetSegment),
          ]);
          return { option: opt, scoring: scoreCampaignOption(input, rateLine, audience) };
        })
      );

      // Tri par score décroissant (null en dernier)
      results.sort((a, b) => {
        if (a.scoring.score === null) return 1;
        if (b.scoring.score === null) return -1;
        return b.scoring.score - a.scoring.score;
      });

      res.json({ success: true, data: results } satisfies ApiResponse<typeof results>);
    } catch (err) {
      next(err);
    }
  };
}
