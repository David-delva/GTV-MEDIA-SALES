// =============================================================================
// GTV Media Sales — Middleware RBAC (Role-Based Access Control)
// POURQUOI RBAC : les commerciaux ne doivent pas modifier les grilles tarifaires.
// La séparation des droits est une exigence métier ET de sécurité.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { Errors } from '../errors/AppError';
import type { UserRole } from '../types';

/**
 * Factory : retourne un middleware qui vérifie que l'utilisateur
 * possède au moins l'un des rôles autorisés.
 *
 * Usage : router.post('/rate-cards', authenticate, authorize('ADMIN'), controller)
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(Errors.unauthenticated());

    if (!allowedRoles.includes(req.user.role)) {
      return next(Errors.forbidden(`${req.method} ${req.path} requiert le rôle : ${allowedRoles.join(' | ')}`));
    }
    next();
  };
}
