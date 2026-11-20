import { Request, Response, NextFunction } from 'express';
import { Errors } from '../errors/AppError';
import { AdminClientRepository } from '../repositories/AdminClientRepository';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AdminClientController {
  constructor(private readonly repository: AdminClientRepository) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ success: true, data: await this.repository.findAll() });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = parseClient(req.body);
      if (!input) return next(Errors.validation({ fields: ['name', 'sector'] }));
      res.status(201).json({ success: true, data: await this.repository.create(input) });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!UUID_PATTERN.test(id)) return next(Errors.validation({ field: 'id' }));
      const input = parseClient(req.body);
      if (!input) return next(Errors.validation({ fields: ['name', 'sector'] }));
      const client = await this.repository.update(id, input);
      if (!client) return next(Errors.notFound('client', id));
      res.json({ success: true, data: client });
    } catch (error) {
      next(error);
    }
  };

  setActive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!UUID_PATTERN.test(id)) return next(Errors.validation({ field: 'id' }));
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
          typeof req.body.isActive !== 'boolean') {
        return next(Errors.validation({ field: 'isActive' }));
      }
      const updated = await this.repository.setActive(id, req.body.isActive);
      if (!updated) return next(Errors.notFound('client', id));
      res.json({ success: true, data: { id, isActive: req.body.isActive } });
    } catch (error) {
      next(error);
    }
  };
}

function parseClient(body: unknown): { name: string; sector: string | null } | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 150) return null;
  if (input.sector !== undefined && input.sector !== null && typeof input.sector !== 'string') return null;
  const sector = typeof input.sector === 'string' ? input.sector.trim() : '';
  if (sector.length > 50) return null;
  return { name, sector: sector || null };
}
