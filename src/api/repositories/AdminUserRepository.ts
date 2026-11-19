import { Pool } from 'pg';
import type { UserRole } from '../types';

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export class AdminUserRepository {
  constructor(private readonly db: Pool) {}

  async findAll(): Promise<AdminUserRow[]> {
    const { rows } = await this.db.query(
      `SELECT id, email, name, role, is_active, created_at
       FROM "user"
       ORDER BY created_at DESC, name`
    );
    return rows.map(mapUser);
  }

  async create(data: {
    email: string;
    name: string;
    role: UserRole;
    passwordHash: string;
  }): Promise<AdminUserRow> {
    const { rows } = await this.db.query(
      `INSERT INTO "user" (email, name, role, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, is_active, created_at`,
      [data.email, data.name, data.role, data.passwordHash]
    );
    return mapUser(rows[0]);
  }

  async setActive(id: string, isActive: boolean): Promise<'UPDATED' | 'NOT_FOUND' | 'LAST_ADMIN'> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      if (!isActive) {
        await client.query(
          `SELECT id FROM "user"
           WHERE role = 'ADMIN' AND is_active = TRUE
           ORDER BY id
           FOR UPDATE`
        );
      }

      const { rows: targetRows } = await client.query(
        `SELECT id, role, is_active FROM "user" WHERE id = $1 FOR UPDATE`,
        [id]
      );
      const target = targetRows[0];
      if (!target) {
        await client.query('ROLLBACK');
        return 'NOT_FOUND';
      }

      if (!isActive && target.role === 'ADMIN' && target.is_active) {
        const { rows: activeAdmins } = await client.query(
          `SELECT id FROM "user" WHERE role = 'ADMIN' AND is_active = TRUE`
        );
        if (activeAdmins.length <= 1) {
          await client.query('ROLLBACK');
          return 'LAST_ADMIN';
        }
      }

      await client.query(`UPDATE "user" SET is_active = $2 WHERE id = $1`, [id, isActive]);
      await client.query('COMMIT');
      return 'UPDATED';
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

function mapUser(row: Record<string, unknown>): AdminUserRow {
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as UserRole,
    isActive: row.is_active as boolean,
    createdAt: String(row.created_at),
  };
}
