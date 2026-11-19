// =============================================================================
// GTV Media Sales — Controller : Auth
// Authentification JWT — POST /api/auth/login
// POURQUOI bcrypt : les mots de passe ne sont jamais stockés en clair.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Errors } from '../errors/AppError';
import type { ApiResponse, AuthUser } from '../types';

export class AuthController {
  constructor(private readonly db: Pool) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };

      if (!email || !password) {
        return next(Errors.validation({ required: ['email', 'password'] }));
      }

      const { rows } = await this.db.query(
        `SELECT id, email, name, role, password_hash
         FROM "user" WHERE email = $1 LIMIT 1`,
        [email]
      );

      const user = rows[0];

      // Comparaison en temps constant pour éviter les timing attacks
      const passwordMatch = user
        ? await bcrypt.compare(password, user.password_hash)
        : await bcrypt.compare(password, '$2b$10$invalidhashtopreventtimingattack'); // dummy

      if (!user || !passwordMatch) {
        return next(new (await import('../errors/AppError')).AppError(
          'INVALID_CREDENTIALS', 'Email ou mot de passe incorrect', 401
        ));
      }

      const JWT_SECRET = process.env.JWT_SECRET;
      if (!JWT_SECRET) throw new Error('JWT_SECRET non configuré');

      const payload: AuthUser = {
        id:    user.id,
        email: user.email,
        name:  user.name,
        role:  user.role,
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

      res.json({
        success: true,
        data: { token, user: payload },
      } satisfies ApiResponse<{ token: string; user: AuthUser }>);
    } catch (err) {
      next(err);
    }
  };
}
