// =============================================================================
// GTV Media Sales — Controller : Audience
// Expose les segments disponibles pour alimenter le sélecteur de l'Assistant.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { AudienceRepository } from '../repositories/AudienceRepository';
import type { ApiResponse } from '../types';

export class AudienceController {
  constructor(private readonly repo: AudienceRepository) {}

  /**
   * GET /api/audience/segments/all?rateCardId=xxx
   * Retourne tous les segments distincts disponibles pour les lignes
   * d'une grille tarifaire donnée.
   * Utilisé par le frontend pour peupler le sélecteur de segment.
   */
  allSegments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { rateCardId } = req.query as { rateCardId?: string };
      if (!rateCardId) {
        res.json({ success: true, data: [] } satisfies ApiResponse<string[]>);
        return;
      }

      const segments = await this.repo.findAllSegmentsForRateCard(rateCardId);
      res.json({ success: true, data: segments } satisfies ApiResponse<string[]>);
    } catch (err) {
      next(err);
    }
  };
}
