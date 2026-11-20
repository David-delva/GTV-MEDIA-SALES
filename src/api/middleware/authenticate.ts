// =============================================================================
// GTV Media Sales — Middleware d'authentification JWT
// POURQUOI JWT : stateless, pas de session serveur, scalable horizontalement
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { Errors } from '../errors/AppError';
import type { AuthUser } from '../types';

export function authenticate(db: Pool) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return next(new Error('JWT_SECRET non configuré — variable d\'environnement manquante'));

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(Errors.unauthenticated());
    }

    let userId: string;
    let tokenVersion = 0;
    try {
      const payload = jwt.verify(authHeader.slice(7), jwtSecret) as Partial<AuthUser> & { tokenVersion?: unknown };
      if (typeof payload.id !== 'string') return next(Errors.unauthenticated());
      if (payload.tokenVersion !== undefined &&
          (typeof payload.tokenVersion !== 'number' || !Number.isInteger(payload.tokenVersion) || payload.tokenVersion < 0)) {
        return next(Errors.unauthenticated());
      }
      userId = payload.id;
      tokenVersion = payload.tokenVersion ?? 0;
    } catch {
      return next(Errors.unauthenticated());
    }

    try {
      const { rows } = await db.query(
        `SELECT id, email, name, role, password_version
         FROM "user" WHERE id = $1 AND is_active = TRUE`,
        [userId]
      );
      if (!rows[0]) return next(Errors.unauthenticated());
      if (tokenVersion !== Number(rows[0].password_version ?? 0)) {
        return next(Errors.unauthenticated());
      }

      req.user = {
        id: rows[0].id as string,
        email: rows[0].email as string,
        name: rows[0].name as string,
        role: rows[0].role as AuthUser['role'],
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}
