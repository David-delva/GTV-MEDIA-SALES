// =============================================================================
// GTV Media Sales — Types étendus pour l'API
// =============================================================================

// Rôles métier GTV — RBAC
// ADMIN    : gestion des grilles tarifaires et des utilisateurs
// COMMERCIAL : création et gestion de ses propres projets
// VIEWER   : lecture seule (direction, client en mode consultation)
export type UserRole = 'ADMIN' | 'COMMERCIAL' | 'VIEWER';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

// Enveloppe standard de toutes les réponses API
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;      // ex: RATE_CARD_NOT_FOUND, FORBIDDEN
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    total?: number;
  };
}

// Extension de Express.Request pour porter l'utilisateur authentifié
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
