// =============================================================================
// GTV Media Sales — Repository : Project
// =============================================================================

import { Pool } from 'pg';

export interface ProjectRow {
  id: string;
  reference: string;
  title: string;
  clientId: string;
  clientName: string;
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

export interface ProjectFollowUpRow {
  id: string;
  projectId: string;
  note: string;
  dueDate: string;
  completedAt: string | null;
  createdAt: string;
  projectTitle?: string;
  projectReference?: string;
}

export class ProjectRepository {
  constructor(private readonly db: Pool) {}

  async findById(id: string): Promise<ProjectRow | null> {
    const { rows } = await this.db.query(
      `SELECT p.id, p.reference, p.title, p.client_id, c.name AS client_name,
              p.owner_id, p.status,
              to_char(p.campaign_start, 'YYYY-MM-DD') AS campaign_start,
              to_char(p.campaign_end, 'YYYY-MM-DD') AS campaign_end,
              p.budget_target, p.rate_card_id,
              p.scoring_snapshot, p.created_at, p.updated_at
       FROM project p
       JOIN client c ON c.id = p.client_id
       WHERE p.id = $1`,
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
      `SELECT p.id, p.reference, p.title, p.client_id, c.name AS client_name,
              p.owner_id, p.status,
              to_char(p.campaign_start, 'YYYY-MM-DD') AS campaign_start,
              to_char(p.campaign_end, 'YYYY-MM-DD') AS campaign_end,
              p.budget_target, p.rate_card_id,
              p.scoring_snapshot, p.created_at, p.updated_at
       FROM project p
       JOIN client c ON c.id = p.client_id
       ${where}
       ORDER BY p.updated_at DESC`,
      params
    );
    return rows.map(mapProject);
  }

  async update(id: string, data: {
    title: string;
    clientId: string;
    campaignStart: string | null;
    campaignEnd: string | null;
    budgetTarget: number | null;
  }): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE project AS p
       SET title = $2, client_id = $3, campaign_start = $4,
           campaign_end = $5, budget_target = $6
       FROM client AS c
       WHERE p.id = $1 AND p.status = 'DRAFT'
         AND c.id = $3 AND c.is_active = TRUE`,
      [id, data.title, data.clientId, data.campaignStart, data.campaignEnd, data.budgetTarget]
    );
    return rowCount === 1;
  }

  async create(data: {
    title: string;
    clientId: string;
    ownerId: string;
    rateCardId: string;
    campaignStart?: string;
    campaignEnd?: string;
    budgetTarget?: number;
  }): Promise<string | null> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const { rows: activeClients } = await client.query(
        `SELECT id FROM client WHERE id = $1 AND is_active = TRUE FOR SHARE`,
        [data.clientId]
      );
      if (!activeClients[0]) {
        await client.query('ROLLBACK');
        return null;
      }

      // Génération de la référence lisible : PRJ-YYYY-XXXX
      const year = new Date().getFullYear();
      const { rows: countRows } = await client.query(
        `SELECT COUNT(*) FROM project WHERE EXTRACT(YEAR FROM created_at) = $1`, [year]
      );
      const seq = String(Number(countRows[0].count) + 1).padStart(4, '0');
      const reference = `PRJ-${year}-${seq}`;

      const { rows } = await client.query(
        `INSERT INTO project (reference, title, client_id, owner_id, rate_card_id,
                              campaign_start, campaign_end, budget_target)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [
          reference, data.title, data.clientId, data.ownerId, data.rateCardId,
          data.campaignStart ?? null, data.campaignEnd ?? null, data.budgetTarget ?? null,
        ]
      );
      await client.query('COMMIT');
      return rows[0].id;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async hasActiveClient(clientId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `SELECT id FROM client WHERE id = $1 AND is_active = TRUE`,
      [clientId]
    );
    return rowCount === 1;
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

  async updateStatus(id: string, currentStatus: string, nextStatus: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE project SET status = $3
       WHERE id = $1 AND status = $2`,
      [id, currentStatus, nextStatus]
    );
    return rowCount === 1;
  }

  async findFollowUps(ownerId?: string): Promise<ProjectFollowUpRow[]> {
    const params: unknown[] = [];
    const ownerFilter = ownerId ? 'AND p.owner_id = $1' : '';
    if (ownerId) params.push(ownerId);
    const { rows } = await this.db.query(
      `SELECT f.id, f.project_id, f.note,
              to_char(f.due_date, 'YYYY-MM-DD') AS due_date,
              f.completed_at, f.created_at,
              p.title AS project_title, p.reference AS project_reference
       FROM project_follow_up f
       JOIN project p ON p.id = f.project_id
       WHERE f.completed_at IS NULL ${ownerFilter}
       ORDER BY f.due_date ASC, f.created_at ASC`,
      params
    );
    return rows.map(mapFollowUp);
  }

  async findProjectFollowUps(projectId: string): Promise<ProjectFollowUpRow[]> {
    const { rows } = await this.db.query(
      `SELECT id, project_id, note,
              to_char(due_date, 'YYYY-MM-DD') AS due_date,
              completed_at, created_at
       FROM project_follow_up
       WHERE project_id = $1
       ORDER BY (completed_at IS NOT NULL), due_date ASC, created_at DESC`,
      [projectId]
    );
    return rows.map(mapFollowUp);
  }

  async createFollowUp(data: {
    projectId: string;
    authorId: string;
    note: string;
    dueDate: string;
  }): Promise<ProjectFollowUpRow> {
    const { rows } = await this.db.query(
      `INSERT INTO project_follow_up (project_id, author_id, note, due_date)
       VALUES ($1, $2, $3, $4)
       RETURNING id, project_id, note,
                 to_char(due_date, 'YYYY-MM-DD') AS due_date,
                 completed_at, created_at`,
      [data.projectId, data.authorId, data.note, data.dueDate]
    );
    return mapFollowUp(rows[0]);
  }

  async setFollowUpCompletion(projectId: string, followUpId: string, completed: boolean): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE project_follow_up
       SET completed_at = CASE WHEN $3 THEN COALESCE(completed_at, NOW()) ELSE NULL END
       WHERE project_id = $1 AND id = $2`,
      [projectId, followUpId, completed]
    );
    return rowCount === 1;
  }
}

function mapProject(row: Record<string, unknown>): ProjectRow {
  return {
    id:              row.id as string,
    reference:       row.reference as string,
    title:           row.title as string,
    clientId:        row.client_id as string,
    clientName:      row.client_name as string,
    ownerId:         row.owner_id as string,
    status:          row.status as string,
    campaignStart:   row.campaign_start as string | null,
    campaignEnd:     row.campaign_end as string | null,
    budgetTarget:    row.budget_target  ? Number(row.budget_target) : null,
    rateCardId:      row.rate_card_id as string,
    scoringSnapshot: row.scoring_snapshot ?? null,
    createdAt:       String(row.created_at),
    updatedAt:       String(row.updated_at),
  };
}

function mapFollowUp(row: Record<string, unknown>): ProjectFollowUpRow {
  return {
    id:              row.id as string,
    projectId:       row.project_id as string,
    note:            row.note as string,
    dueDate:         row.due_date as string,
    completedAt:     row.completed_at ? String(row.completed_at) : null,
    createdAt:       String(row.created_at),
    ...(row.project_title ? { projectTitle: row.project_title as string } : {}),
    ...(row.project_reference ? { projectReference: row.project_reference as string } : {}),
  };
}
