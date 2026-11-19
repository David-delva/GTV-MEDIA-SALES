// =============================================================================
// GTV Media Sales — Controller : Rate Cards
// Responsabilité : valider les entrées, orchestrer, formater la réponse
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { RateCardRepository } from '../repositories/RateCardRepository';
import { AppError, Errors } from '../errors/AppError';
import type { ApiResponse } from '../types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAYPARTS = new Set(['PRIME', 'DAY', 'NUIT', 'WEEKEND']);

export class RateCardController {
  constructor(private readonly repo: RateCardRepository) {}

  listAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ success: true, data: await this.repo.findAll() });
    } catch (err) {
      next(err);
    }
  };

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
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return next(Errors.validation({ field: 'body' }));
      }
      const { name, validFrom, validTo } = req.body as {
        name?: string;
        validFrom?: string;
        validTo?: string;
      };

      const trimmedName = typeof name === 'string' ? name.trim() : '';
      const start = parseDate(validFrom);
      const end = validTo ? parseDate(validTo) : null;
      if (!trimmedName || trimmedName.length > 150 || !start || (validTo && !end) ||
          (end && end <= start)) {
        return next(Errors.validation({ fields: ['name', 'validFrom', 'validTo'] }));
      }

      const id = await this.repo.create({
        name: trimmedName,
        validFrom: start,
        validTo: end ?? undefined,
        createdBy: req.user!.id,
      });

      res.status(201).json({ success: true, data: { id } } satisfies ApiResponse<{ id: string }>);
    } catch (err) {
      next(err);
    }
  };

  addLine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rateCardId = req.params.id;
      if (!UUID_PATTERN.test(rateCardId)) return next(Errors.validation({ field: 'id' }));
      const lineData = parseRateCardLine(req.body);
      if (!lineData) return next(Errors.validation({ field: 'rateCardLine' }));

      const line = await this.repo.addLine({
        rateCardId,
        ...lineData,
      });
      if (!line) {
        return next(Errors.validation({
          message: 'Vérifiez que la grille est en brouillon, que le format est actif et que la ligne n’existe pas déjà.',
        }));
      }
      res.status(201).json({ success: true, data: line } satisfies ApiResponse<typeof line>);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return next(new AppError('DUPLICATE_RATE_CARD_LINE', 'Cette ligne existe déjà dans la grille.', 409));
      }
      next(err);
    }
  };

  updateLine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id: rateCardId, lineId } = req.params;
      if (!UUID_PATTERN.test(rateCardId) || !UUID_PATTERN.test(lineId)) {
        return next(Errors.validation({ field: 'id' }));
      }
      const lineData = parseRateCardLine(req.body);
      if (!lineData) return next(Errors.validation({ field: 'rateCardLine' }));

      const line = await this.repo.updateLine({
        rateCardId,
        lineId,
        daypart: lineData.daypart,
        channel: lineData.channel,
        grossPrice: lineData.grossPrice,
        discountMaxPct: lineData.discountMaxPct,
        currency: lineData.currency,
        isNegotiable: lineData.isNegotiable,
      });
      if (!line) {
        return next(Errors.validation({
          message: 'La ligne est introuvable, la grille n’est plus en brouillon ou cette modification crée un doublon.',
        }));
      }
      res.json({ success: true, data: line } satisfies ApiResponse<typeof line>);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return next(new AppError('DUPLICATE_RATE_CARD_LINE', 'Cette ligne existe déjà dans la grille.', 409));
      }
      next(err);
    }
  };

  deleteLine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id: rateCardId, lineId } = req.params;
      if (!UUID_PATTERN.test(rateCardId) || !UUID_PATTERN.test(lineId)) {
        return next(Errors.validation({ field: 'id' }));
      }
      const deleted = await this.repo.deleteLine(rateCardId, lineId);
      if (!deleted) {
        return next(Errors.validation({ message: 'Seules les lignes d’une grille brouillon peuvent être supprimées.' }));
      }
      res.json({ success: true } satisfies ApiResponse<never>);
    } catch (err) {
      next(err);
    }
  };

  /** PATCH /api/rate-cards/:id/activate — activer une grille (ADMIN only) */
  activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!UUID_PATTERN.test(id)) return next(Errors.validation({ field: 'id' }));
      const result = await this.repo.activate(id);
      if (result === 'NOT_FOUND') return next(Errors.notFound('rate_card', id));
      if (result === 'EMPTY') {
        return next(Errors.validation({ message: 'Ajoutez au moins une ligne avant d’activer la grille.' }));
      }
      if (result === 'INVALID_PERIOD') {
        return next(Errors.validation({ message: 'La date de validité de la grille ne couvre pas aujourd’hui.' }));
      }
      res.json({ success: true } satisfies ApiResponse<never>);
    } catch (err) {
      next(err);
    }
  };
}

function parseDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

function parseRateCardLine(value: unknown): {
  formatId: string;
  daypart: 'PRIME' | 'DAY' | 'NUIT' | 'WEEKEND';
  channel: string;
  grossPrice: number;
  discountMaxPct: number;
  currency: string;
  isNegotiable: boolean;
} | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const formatId = body.formatId;
  const daypart = body.daypart;
  const channel = typeof body.channel === 'string' ? body.channel.trim() : '';
  const grossPrice = body.grossPrice;
  const discountMaxPct = body.discountMaxPct;
  const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : '';
  const isNegotiable = body.isNegotiable;

  if (
    typeof formatId !== 'string' || !UUID_PATTERN.test(formatId) ||
    typeof daypart !== 'string' || !DAYPARTS.has(daypart) ||
    !channel || channel.length > 50 ||
    typeof grossPrice !== 'number' || !Number.isFinite(grossPrice) || grossPrice < 0 || grossPrice >= 10_000_000_000 ||
    typeof discountMaxPct !== 'number' || !Number.isFinite(discountMaxPct) || discountMaxPct < 0 || discountMaxPct > 100 ||
    !/^[A-Z]{3}$/.test(currency) ||
    typeof isNegotiable !== 'boolean'
  ) return null;

  return {
    formatId,
    daypart: daypart as 'PRIME' | 'DAY' | 'NUIT' | 'WEEKEND',
    channel,
    grossPrice,
    discountMaxPct,
    currency,
    isNegotiable,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    (error as { code?: unknown }).code === '23505';
}
