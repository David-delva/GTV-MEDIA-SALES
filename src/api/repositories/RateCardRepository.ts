// =============================================================================
// GTV Media Sales — Repository : Rate Card
// POURQUOI le pattern Repository : découple la logique métier du SQL.
// Si on migre de PostgreSQL à un autre SGBD, seul ce fichier change.
// =============================================================================

import { Pool } from 'pg';
import type { RateCardLine } from '../../types';

export interface AdminRateCard {
  id: string;
  name: string;
  validFrom: string;
  validTo: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  lines: RateCardLine[];
}

export class RateCardRepository {
  constructor(private readonly db: Pool) {}

  /** Récupère la grille ACTIVE au moment d'une date donnée */
  async findActive(atDate: Date = new Date()): Promise<{ id: string; name: string; validFrom: string } | null> {
    const { rows } = await this.db.query(
      `SELECT id, name, to_char(valid_from, 'YYYY-MM-DD') AS valid_from
       FROM rate_card
       WHERE status = 'ACTIVE'
         AND valid_from <= $1
         AND (valid_to IS NULL OR valid_to >= $1)
       LIMIT 1`,
      [atDate]
    );
    if (!rows[0]) return null;
    return { id: rows[0].id, name: rows[0].name, validFrom: rows[0].valid_from as string };
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

  async findAll(): Promise<AdminRateCard[]> {
    const { rows: cards } = await this.db.query(
      `SELECT id, name,
              to_char(valid_from, 'YYYY-MM-DD') AS valid_from,
              CASE WHEN valid_to IS NULL THEN NULL ELSE to_char(valid_to, 'YYYY-MM-DD') END AS valid_to,
              status, created_at
       FROM rate_card
       ORDER BY created_at DESC`
    );
    if (cards.length === 0) return [];

    const cardIds = cards.map((card) => card.id as string);
    const { rows: lineRows } = await this.db.query(
      `SELECT id, rate_card_id, format_id, daypart, channel,
              gross_price, discount_max_pct, currency, is_negotiable
       FROM rate_card_line
       WHERE rate_card_id = ANY($1::uuid[])
       ORDER BY channel, daypart`,
      [cardIds]
    );
    const linesByCard = new Map<string, RateCardLine[]>();
    for (const row of lineRows) {
      const line = mapLine(row);
      const lines = linesByCard.get(line.rateCardId) ?? [];
      lines.push(line);
      linesByCard.set(line.rateCardId, lines);
    }

    return cards.map((card) => ({
      id: card.id as string,
      name: card.name as string,
      validFrom: card.valid_from as string,
      validTo: card.valid_to as string | null,
      status: card.status as AdminRateCard['status'],
      createdAt: String(card.created_at),
      lines: linesByCard.get(card.id as string) ?? [],
    }));
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
    validFrom: string;
    validTo?: string;
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

  async addLine(data: {
    rateCardId: string;
    formatId: string;
    daypart: RateCardLine['daypart'];
    channel: string;
    grossPrice: number;
    discountMaxPct: number;
    currency: string;
    isNegotiable: boolean;
  }): Promise<RateCardLine | null> {
    const { rows } = await this.db.query(
      `INSERT INTO rate_card_line
         (rate_card_id, format_id, daypart, channel, gross_price,
          discount_max_pct, currency, is_negotiable, duration_s)
       SELECT rc.id, f.id, $3, $4, $5, $6, $7, $8, f.duration_sec
       FROM rate_card rc
       JOIN format f ON f.id = $2 AND f.is_active = TRUE
       WHERE rc.id = $1 AND rc.status = 'DRAFT'
         AND NOT EXISTS (
           SELECT 1 FROM rate_card_line existing
           WHERE existing.rate_card_id = rc.id
             AND existing.format_id = f.id
             AND existing.daypart = $3
             AND existing.channel = $4
         )
       RETURNING id, rate_card_id, format_id, daypart, channel,
                 gross_price, discount_max_pct, currency, is_negotiable`,
      [
        data.rateCardId, data.formatId, data.daypart, data.channel,
        data.grossPrice, data.discountMaxPct, data.currency, data.isNegotiable,
      ]
    );
    return rows[0] ? mapLine(rows[0]) : null;
  }

  async updateLine(data: {
    rateCardId: string;
    lineId: string;
    daypart: RateCardLine['daypart'];
    channel: string;
    grossPrice: number;
    discountMaxPct: number;
    currency: string;
    isNegotiable: boolean;
  }): Promise<RateCardLine | null> {
    const { rows } = await this.db.query(
      `UPDATE rate_card_line line
       SET daypart = $3, channel = $4, gross_price = $5,
           discount_max_pct = $6, currency = $7, is_negotiable = $8
       FROM rate_card card
       WHERE line.id = $2
         AND line.rate_card_id = $1
         AND card.id = line.rate_card_id
         AND card.status = 'DRAFT'
         AND NOT EXISTS (
           SELECT 1 FROM rate_card_line existing
           WHERE existing.id <> line.id
             AND existing.rate_card_id = line.rate_card_id
             AND existing.format_id = line.format_id
             AND existing.daypart = $3
             AND existing.channel = $4
             AND existing.support_id IS NOT DISTINCT FROM line.support_id
             AND existing.duration_s IS NOT DISTINCT FROM line.duration_s
         )
       RETURNING line.id, line.rate_card_id, line.format_id, line.daypart, line.channel,
                 line.gross_price, line.discount_max_pct, line.currency, line.is_negotiable`,
      [
        data.rateCardId, data.lineId, data.daypart, data.channel,
        data.grossPrice, data.discountMaxPct, data.currency, data.isNegotiable,
      ]
    );
    return rows[0] ? mapLine(rows[0]) : null;
  }

  async deleteLine(rateCardId: string, lineId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `DELETE FROM rate_card_line line
       USING rate_card card
       WHERE line.id = $2
         AND line.rate_card_id = $1
         AND card.id = line.rate_card_id
         AND card.status = 'DRAFT'`,
      [rateCardId, lineId]
    );
    return rowCount === 1;
  }

  /**
   * Active une grille : archive l'ancienne, active la nouvelle.
   * POURQUOI une transaction : les deux opérations sont atomiques.
   * Si l'une échoue, on ne se retrouve pas sans grille active.
   */
  async activate(rateCardId: string): Promise<'NOT_FOUND' | 'EMPTY' | 'INVALID_PERIOD' | 'OK'> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query('LOCK TABLE rate_card IN SHARE ROW EXCLUSIVE MODE');
      const { rows: targetRows } = await client.query(
        `SELECT id,
                (valid_from <= CURRENT_DATE AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)) AS valid
         FROM rate_card
         WHERE id = $1
         FOR UPDATE`,
        [rateCardId]
      );
      if (!targetRows[0]) {
        await client.query('ROLLBACK');
        return 'NOT_FOUND';
      }

      const { rows: lineCount } = await client.query(
        `SELECT COUNT(*)::int AS count FROM rate_card_line WHERE rate_card_id = $1`,
        [rateCardId]
      );
      if (lineCount[0].count < 1) {
        await client.query('ROLLBACK');
        return 'EMPTY';
      }

      if (!targetRows[0].valid) {
        await client.query('ROLLBACK');
        return 'INVALID_PERIOD';
      }

      // Archive toutes les grilles actives existantes
      await client.query(
        `UPDATE rate_card SET status = 'ARCHIVED', valid_to = NOW()
         WHERE status = 'ACTIVE' AND id <> $1`,
        [rateCardId]
      );
      // Active la nouvelle
      await client.query(
        `UPDATE rate_card SET status = 'ACTIVE' WHERE id = $1`,
        [rateCardId]
      );
      await client.query('COMMIT');
      return 'OK';
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
