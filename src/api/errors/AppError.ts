// =============================================================================
// GTV Media Sales — Erreurs métier typées
// Centraliser les erreurs permet un handling uniforme et des messages clairs
// pour le jury : "toute erreur est intentionnelle, pas un crash"
// =============================================================================

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  notFound: (resource: string, id: string) =>
    new AppError(`${resource.toUpperCase()}_NOT_FOUND`, `${resource} introuvable : ${id}`, 404),

  forbidden: (action: string) =>
    new AppError('FORBIDDEN', `Action non autorisée : ${action}`, 403),

  unauthenticated: () =>
    new AppError('UNAUTHENTICATED', 'Token manquant ou invalide', 401),

  validation: (details: unknown) =>
    new AppError('VALIDATION_ERROR', 'Données invalides', 400, details),

  rateCardConflict: () =>
    new AppError('RATE_CARD_CONFLICT', 'Une grille ACTIVE existe déjà pour cette période', 409),

  degradedMode: (missing: string[]) =>
    new AppError('SCORING_DEGRADED', `Données manquantes : ${missing.join(', ')}`, 206),
} as const;
