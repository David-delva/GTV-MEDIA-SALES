import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { AppError, Errors } from '../errors/AppError';
import { AdminUserRepository } from '../repositories/AdminUserRepository';
import type { ApiResponse, UserRole } from '../types';

const ROLES = new Set<UserRole>(['ADMIN', 'COMMERCIAL', 'VIEWER']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AdminUserController {
  constructor(private readonly repository: AdminUserRepository) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ success: true, data: await this.repository.findAll() });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return next(Errors.validation({ field: 'body' }));
      }
      const body = req.body as Record<string, unknown>;
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const role = body.role;

      if (!email || email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return next(Errors.validation({ field: 'email' }));
      }
      if (!name || name.length > 100) {
        return next(Errors.validation({ field: 'name' }));
      }
      if (typeof role !== 'string' || !ROLES.has(role as UserRole)) {
        return next(Errors.validation({ field: 'role' }));
      }
      const passwordBytes = Buffer.byteLength(password, 'utf8');
      if (password.length < 12 || passwordBytes > 72) {
        return next(Errors.validation({ field: 'password', minLength: 12, maxBytes: 72 }));
      }

      const passwordHash = await bcrypt.hash(password, 12);
      try {
        const user = await this.repository.create({
          email,
          name,
          role: role as UserRole,
          passwordHash,
        });
        res.status(201).json({ success: true, data: user } satisfies ApiResponse<typeof user>);
      } catch (error) {
        if (isUniqueViolation(error)) {
          return next(new AppError('EMAIL_ALREADY_EXISTS', 'Cette adresse e-mail est déjà utilisée.', 409));
        }
        throw error;
      }
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
      if (!req.body.isActive && req.user?.id === id) {
        return next(Errors.validation({ message: 'Vous ne pouvez pas désactiver votre propre compte.' }));
      }

      const result = await this.repository.setActive(id, req.body.isActive);
      if (result === 'NOT_FOUND') return next(Errors.notFound('user', id));
      if (result === 'LAST_ADMIN') {
        return next(new AppError('LAST_ACTIVE_ADMIN', 'Au moins un compte administrateur doit rester actif.', 409));
      }

      res.json({ success: true, data: { id, isActive: req.body.isActive } } satisfies ApiResponse<{ id: string; isActive: boolean }>);
    } catch (error) {
      next(error);
    }
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    (error as { code?: unknown }).code === '23505';
}
