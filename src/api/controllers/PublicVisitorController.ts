import { Request, Response, NextFunction } from 'express';
import { Errors } from '../errors/AppError';
import { PublicVisitorRepository, VisitorSubmission } from '../repositories/PublicVisitorRepository';

const OBJECTIVES = new Set([
  'NOTORIETE', 'TRAFIC', 'LANCEMENT', 'PROMOTION',
  'IMAGE', 'SENSIBILISATION', 'RECRUTEMENT', 'EVENEMENT',
]);
const DAYPARTS = new Set(['PRIME', 'DAY', 'NUIT', 'WEEKEND']);
const REQUEST_STATUSES = new Set([
  'ACCUSE_RECU', 'EN_QUALIFICATION', 'EN_ATTENTE_CLIENT',
  'DEVIS_EN_PREPARATION', 'DEVIS_ENVOYE', 'AJUSTEMENT_DEMANDE',
  'ACCEPTE', 'REFUSE', 'EXPIRE', 'CLOS',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class PublicVisitorController {
  constructor(private readonly repository: PublicVisitorRepository) {}

  catalog = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ success: true, data: await this.repository.getCatalog() });
    } catch (error) {
      next(error);
    }
  };

  score = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return next(Errors.validation({ field: 'body' }));
      }
      const body = req.body as {
        rateCardId?: unknown;
        targetSegment?: unknown;
        options?: unknown;
      };
      const defaultRateCardId = optionalUuid(body.rateCardId);
      if (body.rateCardId !== undefined && body.rateCardId !== null && !defaultRateCardId) {
        return next(Errors.validation({ field: 'rateCardId' }));
      }
      if (body.targetSegment !== undefined &&
          body.targetSegment !== null &&
          (typeof body.targetSegment !== 'string' || body.targetSegment.length > 100)) {
        return next(Errors.validation({ field: 'targetSegment' }));
      }
      if (!Array.isArray(body.options) || body.options.length < 1 || body.options.length > 100) {
        return next(Errors.validation({ field: 'options', min: 1, max: 100 }));
      }

      const options = body.options.map((option) => {
        if (!option || typeof option !== 'object' || Array.isArray(option)) {
          throw Errors.validation({ field: 'options[]' });
        }
        const item = option as Record<string, unknown>;
        const rateCardId = item.rateCardId === undefined || item.rateCardId === null
          ? defaultRateCardId
          : optionalUuid(item.rateCardId);
        if (
          !rateCardId ||
          typeof item.formatId !== 'string' ||
          !UUID_PATTERN.test(item.formatId) ||
          typeof item.channel !== 'string' ||
          item.channel.length < 1 ||
          item.channel.length > 50 ||
          typeof item.daypart !== 'string' ||
          !DAYPARTS.has(item.daypart)
        ) {
          throw Errors.validation({ field: 'options[]' });
        }
        return {
          rateCardId,
          formatId: item.formatId,
          daypart: item.daypart,
          channel: item.channel,
        };
      });

      const results = await this.repository.scoreOptions(
        defaultRateCardId,
        typeof body.targetSegment === 'string' ? body.targetSegment : null,
        options
      );
      if (!results) return next(Errors.notFound('rate_card', defaultRateCardId ?? 'selected'));
      res.json({ success: true, data: results });
    } catch (error) {
      next(error);
    }
  };

  submitRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return next(Errors.validation({ field: 'body' }));
      }
      const body = req.body as Record<string, unknown>;
      const brief = body.brief as Record<string, unknown> | undefined;
      const contact = body.contact as Record<string, unknown> | undefined;
      const selectionsInput = body.selections;
      const defaultRateCardId = optionalUuid(body.rateCardId);
      if (body.rateCardId !== undefined && body.rateCardId !== null && !defaultRateCardId) {
        return next(Errors.validation({ field: 'rateCardId' }));
      }

      const requiredContact = ['companyName', 'fullName', 'email'];
      const contactMissing = requiredContact.filter(
        (key) => typeof contact?.[key] !== 'string' || !(contact[key] as string).trim()
      );
      if (contactMissing.length) {
        return next(Errors.validation({ required: contactMissing }));
      }
      if (!contact || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contact.email)) ||
          String(contact.email).length > 150) {
        return next(Errors.validation({ field: 'contact.email' }));
      }
      if (
        !brief ||
        typeof brief.objective !== 'string' ||
        !OBJECTIVES.has(brief.objective)
      ) {
        return next(Errors.validation({ field: 'brief.objective' }));
      }
      if (
        brief.targetSegment !== undefined &&
        brief.targetSegment !== null &&
        (typeof brief.targetSegment !== 'string' || brief.targetSegment.length > 100)
      ) {
        return next(Errors.validation({ field: 'brief.targetSegment' }));
      }

      const budgetHT = brief.budgetHT === null || brief.budgetHT === '' || brief.budgetHT === undefined
        ? null
        : Number(brief.budgetHT);
      if (budgetHT !== null && (!Number.isFinite(budgetHT) || budgetHT <= 0 || budgetHT > 1_000_000_000_000)) {
        return next(Errors.validation({ field: 'brief.budgetHT' }));
      }

      const periodStart = optionalDate(brief.periodStart);
      const periodEnd = optionalDate(brief.periodEnd);
      if (periodStart === false || periodEnd === false ||
          (periodStart && periodEnd && periodEnd < periodStart)) {
        return next(Errors.validation({ field: 'brief.period', message: 'Période invalide' }));
      }

      if (!Array.isArray(selectionsInput) || selectionsInput.length > 30) {
        return next(Errors.validation({ field: 'selections', max: 30 }));
      }
      const selections = selectionsInput.map((selection) => {
        if (!selection || typeof selection !== 'object' || Array.isArray(selection)) {
          throw Errors.validation({ field: 'selections[]' });
        }
        const item = selection as Record<string, unknown>;
        const quantity = Number(item.quantity);
        const rateCardId = item.rateCardId === undefined || item.rateCardId === null
          ? defaultRateCardId
          : optionalUuid(item.rateCardId);
        if (
          !rateCardId ||
          typeof item.formatId !== 'string' ||
          !UUID_PATTERN.test(item.formatId) ||
          typeof item.daypart !== 'string' ||
          !DAYPARTS.has(item.daypart) ||
          typeof item.channel !== 'string' ||
          !item.channel.trim() ||
          item.channel.length > 50 ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 100_000
        ) {
          throw Errors.validation({ field: 'selections[]' });
        }
        return {
          rateCardId,
          formatId: item.formatId,
          daypart: item.daypart,
          channel: item.channel.trim(),
          quantity,
        };
      });
      if (new Set(selections.map((item) => `${item.rateCardId}|${item.formatId}|${item.daypart}|${item.channel}`)).size !== selections.length) {
        return next(Errors.validation({ field: 'selections', message: 'Options en doublon' }));
      }

      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (message.length > 2000) return next(Errors.validation({ field: 'message', maxLength: 2000 }));

      const submission: VisitorSubmission = {
        rateCardId: defaultRateCardId,
        brief: {
          objective: brief.objective,
          targetSegment: typeof brief.targetSegment === 'string' ? brief.targetSegment : null,
          budgetHT,
          periodStart: periodStart || null,
          periodEnd: periodEnd || null,
          sectorCode: optionalText(brief.sectorCode, 50),
        },
        contact: {
          companyName: String(contact.companyName).trim().slice(0, 200),
          fullName: String(contact.fullName).trim().slice(0, 150),
          email: String(contact.email).trim().toLowerCase(),
          phone: optionalText(contact.phone, 30),
          city: optionalText(contact.city, 100),
          consentMarketing: contact.consentMarketing === true,
        },
        selections,
        message: message || null,
      };

      const result = await this.repository.submit(submission);
      res.status(201).json({
        success: true,
        data: {
          reference: result.reference,
          trackingToken: result.token,
        },
      });
    } catch (error) {
      if (error instanceof Error &&
          (error.message.includes('grille tarifaire active a changé') ||
           error.message.includes('offre sélectionnée n’est plus disponible'))) {
        return next(Errors.validation({ message: error.message }));
      }
      next(error);
    }
  };

  trackRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.params;
      if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
        return next(Errors.notFound('quote_request', 'token'));
      }
      const request = await this.repository.track(token);
      if (!request) return next(Errors.notFound('quote_request', 'token'));
      res.json({ success: true, data: request });
    } catch (error) {
      next(error);
    }
  };

  inbox = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ success: true, data: await this.repository.findRequests() });
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return next(Errors.validation({ field: 'body' }));
      }
      const { status } = req.body as { status?: unknown };
      if (typeof status !== 'string' || !REQUEST_STATUSES.has(status)) {
        return next(Errors.validation({ field: 'status' }));
      }
      const updated = await this.repository.updateRequestStatus(req.params.reference, status);
      if (!updated) return next(Errors.notFound('quote_request', req.params.reference));
      res.json({ success: true, data: { reference: req.params.reference, status } });
    } catch (error) {
      next(error);
    }
  };
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function optionalUuid(value: unknown): string | null {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : null;
}

function optionalDate(value: unknown): string | null | false {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? false : value;
}
