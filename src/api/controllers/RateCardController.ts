// =============================================================================
// GTV Media Sales — Controller : Rate Cards
// Responsabilité : valider les entrées, orchestrer, formater la réponse
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { RateCardRepository } from '../repositories/RateCardRepository';
import { Errors } from '../errors/AppError';
import type { ApiResponse } from '../types';

export class RateCardController {
  constructor(private readonly repo: RateCardRepository) {}

  /** GET /api/rate-cards/active — grille tarifaire en vigueur */
  getActive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const atDate = req.query.at ? new Date(req.query.at as string) : new Date();
      const rateCard = await this.repo.findActive(atDate);

      if (!rateCard) {
        return next(Errors.notFound('rate_card', 'active'));
      }

      const lines = await this.repo.findLinesByRateCard(rateCard.id);
      const body: ApiResponse<typeof rateCard & { lines: typeof lines }> = {
        success: true,
        data: { ...rateCard, lines },
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/rate-cards — créer une nouvelle grille (ADMIN only) */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, validFrom, validTo } = req.body as {
        name?: string;
        validFrom?: string;
        validTo?: string;
      };

      if (!name || !validFrom) {
        return next(Errors.validation({ required: ['name', 'validFrom'] }));
      }

      const id = await this.repo.create({
        name,
        validFrom: new Date(validFrom),
        validTo: validTo ? new Date(validTo) : undefined,
        createdBy: req.user!.id,
      });

      res.status(201).json({ success: true, data: { id } } satisfies ApiResponse<{ id: string }>);
    } catch (err) {
      next(err);
    }
  };

  /** PATCH /api/rate-cards/:id/activate — activer une grille (ADMIN only) */
  activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.repo.activate(id);
      res.json({ success: true } satisfies ApiResponse<never>);
    } catch (err) {
      next(err);
    }
  };
}
