import { Pool } from 'pg';

export interface AdminClientRow {
  id: string;
  name: string;
  sector: string | null;
  isActive: boolean;
  createdAt: string;
}

export class AdminClientRepository {
  constructor(private readonly db: Pool) {}

  async findAll(): Promise<AdminClientRow[]> {
    const { rows } = await this.db.query(
      `SELECT id, name, sector, is_active, created_at
       FROM client
       ORDER BY created_at DESC, name`
    );
    return rows.map(mapClient);
  }

  async create(data: { name: string; sector: string | null }): Promise<AdminClientRow> {
    const { rows } = await this.db.query(
      `INSERT INTO client (name, sector)
       VALUES ($1, $2)
       RETURNING id, name, sector, is_active, created_at`,
      [data.name, data.sector]
    );
    return mapClient(rows[0]);
  }

  async update(id: string, data: { name: string; sector: string | null }): Promise<AdminClientRow | null> {
    const { rows } = await this.db.query(
      `UPDATE client
       SET name = $2, sector = $3
       WHERE id = $1
       RETURNING id, name, sector, is_active, created_at`,
      [id, data.name, data.sector]
    );
    return rows[0] ? mapClient(rows[0]) : null;
  }

  async setActive(id: string, isActive: boolean): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE client SET is_active = $2 WHERE id = $1`,
      [id, isActive]
    );
    return rowCount === 1;
  }
}

function mapClient(row: Record<string, unknown>): AdminClientRow {
  return {
    id: row.id as string,
    name: row.name as string,
    sector: row.sector as string | null,
    isActive: row.is_active as boolean,
    createdAt: String(row.created_at),
  };
}
