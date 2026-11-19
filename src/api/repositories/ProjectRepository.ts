// =============================================================================
// GTV Media Sales — Repository : Project
// =============================================================================

import { Pool } from 'pg';

export interface ProjectRow {
  id: string;
  reference: string;
  title: string;
  clientId: string;
  ownerId: string;
  status: string;
  campaignStart: string | null;
  campaignEnd: string | null;
  budgetTarget: number | null;
  rateCardId: string;
  scoringSnapshot: unknown | null;
  createdAt: string;
  updatedAt: string;
}

export class ProjectRepository {
  constructor(private readonly db: Pool) {}

  async findById(id: string): Promise<ProjectRow | null> {
    const { rows } = await this.db.query(
      `SELECT id, reference, title, client_id, owner_id, status,
              campaign_start, campaign_end, budget_target, rate_card_id,
              scoring_snapshot, created_at, updated_at
       FROM project WHERE id = $1`,
      [id]
    );
    return rows[0] ? mapProject(rows[0]) : null;
  }

  /** Liste les projets — un COMMERCIAL ne voit que les siens */
  async findAll(filters: { ownerId?: string; status?: string }): Promise<ProjectRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.ownerId) {
      params.push(filters.ownerId);
      conditions.push(`owner_id = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.db.query(
      `SELECT id, reference, title, client_id, owner_id, status,
              campaign_start, campaign_end, budget_target, rate_card_id,
              scoring_snapshot, created_at, updated_at
       FROM project ${where}
       ORDER BY created_at DESC`,
      params
    );
    return rows.map(mapProject);
  }

  async create(data: {
    title: string;
    clientId: string;
    ownerId: string;
    rateCardId: string;
    campaignStart?: Date;
    campaignEnd?: Date;
    budgetTarget?: number;
  }): Promise<string> {
    // Génération de la référence lisible : PRJ-YYYY-XXXX
    const year = new Date().getFullYear();
    const { rows: countRows } = await this.db.query(
      `SELECT COUNT(*) FROM project WHERE EXTRACT(YEAR FROM created_at) = $1`, [year]
    );
    const seq = String(Number(countRows[0].count) + 1).padStart(4, '0');
    const reference = `PRJ-${year}-${seq}`;

    const { rows } = await this.db.query(
      `INSERT INTO project (reference, title, client_id, owner_id, rate_card_id,
                            campaign_start, campaign_end, budget_target)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        reference, data.title, data.clientId, data.ownerId, data.rateCardId,
        data.campaignStart ?? null, data.campaignEnd ?? null, data.budgetTarget ?? null,
      ]
    );
    return rows[0].id;
  }

  /** Soumet le projet : fige le scoring_snapshot et change le statut */
  async submit(id: string, scoringSnapshot: unknown): Promise<void> {
    await this.db.query(
      `UPDATE project
       SET status = 'SUBMITTED', scoring_snapshot = $2
       WHERE id = $1 AND status = 'DRAFT'`,
      [id, JSON.stringify(scoringSnapshot)]
    );
  }
}

function mapProject(row: Record<string, unknown>): ProjectRow {
  return {
    id:              row.id as string,
    reference:       row.reference as string,
    title:           row.title as string,
    clientId:        row.client_id as string,
    ownerId:         row.owner_id as string,
    status:          row.status as string,
    campaignStart:   row.campaign_start ? String(row.campaign_start).slice(0, 10) : null,
    campaignEnd:     row.campaign_end   ? String(row.campaign_end).slice(0, 10)   : null,
    budgetTarget:    row.budget_target  ? Number(row.budget_target) : null,
    rateCardId:      row.rate_card_id as string,
    scoringSnapshot: row.scoring_snapshot ?? null,
    createdAt:       String(row.created_at),
    updatedAt:       String(row.updated_at),
  };
}
