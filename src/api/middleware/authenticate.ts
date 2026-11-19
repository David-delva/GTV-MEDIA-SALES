// =============================================================================
// GTV Media Sales — Middleware d'authentification JWT
// POURQUOI JWT : stateless, pas de session serveur, scalable horizontalement
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Errors } from '../errors/AppError';
import type { AuthUser } from '../types';

const JWT_SECRET = process.env.JWT_SECRET;

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  if (!JWT_SECRET) throw new Error('JWT_SECRET non configuré — variable d\'environnement manquante');

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(Errors.unauthenticated());
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    next(Errors.unauthenticated());
  }
}
