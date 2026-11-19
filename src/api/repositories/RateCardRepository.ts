// =============================================================================
// GTV Media Sales — Repository : Rate Card
// POURQUOI le pattern Repository : découple la logique métier du SQL.
// Si on migre de PostgreSQL à un autre SGBD, seul ce fichier change.
// =============================================================================

import { Pool } from 'pg';
import type { RateCardLine } from '../../types';

export class RateCardRepository {
  constructor(private readonly db: Pool) {}

  /** Récupère la grille ACTIVE au moment d'une date donnée */
  async findActive(atDate: Date = new Date()): Promise<{ id: string; name: string; validFrom: Date } | null> {
    const { rows } = await this.db.query(
      `SELECT id, name, valid_from
       FROM rate_card
       WHERE status = 'ACTIVE'
         AND valid_from <= $1
         AND (valid_to IS NULL OR valid_to >= $1)
       LIMIT 1`,
      [atDate]
    );
    if (!rows[0]) return null;
    return { id: rows[0].id, name: rows[0].name, validFrom: rows[0].valid_from };
  }

  /** Récupère toutes les lignes d'une grille */
  async findLinesByRateCard(rateCardId: string): Promise<RateCardLine[]> {
    const { rows } = await this.db.query(
      `SELECT id, rate_card_id, format_id, daypart, channel,
              gross_price, discount_max_pct, currency, is_negotiable
       FROM rate_card_line
       WHERE rate_card_id = $1
       ORDER BY channel, daypart`,
      [rateCardId]
    );
    return rows.map(mapLine);
  }

  /** Récupère une ligne tarifaire précise pour le moteur de scoring */
  async findLine(
    rateCardId: string,
    formatId: string,
    daypart: string,
    channel: string
  ): Promise<RateCardLine | null> {
    const { rows } = await this.db.query(
      `SELECT id, rate_card_id, format_id, daypart, channel,
              gross_price, discount_max_pct, currency, is_negotiable
       FROM rate_card_line
       WHERE rate_card_id = $1 AND format_id = $2 AND daypart = $3 AND channel = $4
       LIMIT 1`,
      [rateCardId, formatId, daypart, channel]
    );
    return rows[0] ? mapLine(rows[0]) : null;
  }

  /** Crée une nouvelle grille (DRAFT) — seul ADMIN peut le faire */
  async create(data: {
    name: string;
    validFrom: Date;
    validTo?: Date;
    createdBy: string;
  }): Promise<string> {
    const { rows } = await this.db.query(
      `INSERT INTO rate_card (name, valid_from, valid_to, status, created_by)
       VALUES ($1, $2, $3, 'DRAFT', $4)
       RETURNING id`,
      [data.name, data.validFrom, data.validTo ?? null, data.createdBy]
    );
    return rows[0].id;
  }

  /**
   * Active une grille : archive l'ancienne, active la nouvelle.
   * POURQUOI une transaction : les deux opérations sont atomiques.
   * Si l'une échoue, on ne se retrouve pas sans grille active.
   */
  async activate(rateCardId: string): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      // Archive toutes les grilles actives existantes
      await client.query(
        `UPDATE rate_card SET status = 'ARCHIVED', valid_to = NOW()
         WHERE status = 'ACTIVE'`
      );
      // Active la nouvelle
      await client.query(
        `UPDATE rate_card SET status = 'ACTIVE' WHERE id = $1`,
        [rateCardId]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

// Mapping snake_case (BDD) → camelCase (TypeScript)
function mapLine(row: Record<string, unknown>): RateCardLine {
  return {
    id:             row.id as string,
    rateCardId:     row.rate_card_id as string,
    formatId:       row.format_id as string,
    daypart:        row.daypart as RateCardLine['daypart'],
    channel:        row.channel as string,
    grossPrice:     Number(row.gross_price),
    discountMaxPct: Number(row.discount_max_pct),
    currency:       row.currency as string,
    isNegotiable:   row.is_negotiable as boolean,
  };
}
