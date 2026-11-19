// =============================================================================
// GTV Media Sales — Middleware de gestion globale des erreurs
// POURQUOI centraliser : évite les try/catch dupliqués dans chaque controller,
// garantit un format de réponse uniforme pour le frontend.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import type { ApiResponse } from '../types';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  // Erreur inattendue — on ne leak pas les détails internes en production
  console.error('[UNHANDLED ERROR]', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur' },
  });
}
