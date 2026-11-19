import { createHash, randomBytes } from 'node:crypto';
import { nanoid } from 'nanoid';
import { Pool, PoolClient } from 'pg';

export interface VisitorBrief {
  objective: string;
  targetSegment: string | null;
  budgetHT: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  sectorCode: string | null;
}

export interface VisitorContact {
  companyName: string;
  fullName: string;
  email: string;
  phone: string | null;
  city: string | null;
  consentMarketing: boolean;
}

export interface VisitorSelection {
  formatId: string;
  daypart: string;
  channel: string;
  quantity: number;
}

export interface VisitorSubmission {
  rateCardId: string | null;
  brief: VisitorBrief;
  contact: VisitorContact;
  selections: VisitorSelection[];
  message: string | null;
}

export class PublicVisitorRepository {
  constructor(private readonly db: Pool) {}

  async getCatalog() {
    const activeCard = await this.db.query(
      `SELECT id, name, to_char(valid_from, 'YYYY-MM-DD') AS valid_from
       FROM rate_card
       WHERE status = 'ACTIVE'
         AND valid_from <= CURRENT_DATE
         AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
       ORDER BY valid_from DESC
       LIMIT 1`
    );

    if (!activeCard.rows[0]) {
      return { rateCard: null, lines: [], segments: [] };
    }

    const rateCard = activeCard.rows[0];
    const [lineResult, segmentResult] = await Promise.all([
      this.db.query(
        `SELECT rcl.format_id, f.label AS format_label, f.category,
                f.duration_sec, rcl.daypart, rcl.channel, rcl.gross_price,
                rcl.discount_max_pct, rcl.currency
         FROM rate_card_line rcl
         JOIN format f ON f.id = rcl.format_id
         WHERE rcl.rate_card_id = $1 AND f.is_active = TRUE
         ORDER BY f.category, f.label, rcl.channel, rcl.daypart`,
        [rateCard.id]
      ),
      this.db.query(
        `SELECT DISTINCT a.target_segment
         FROM audience_dataset a
         JOIN rate_card_line rcl
           ON rcl.format_id = a.format_id
          AND rcl.daypart = a.daypart
          AND rcl.channel = a.channel
         WHERE rcl.rate_card_id = $1
         ORDER BY a.target_segment`,
        [rateCard.id]
      ),
    ]);

    return {
      rateCard: {
        id: rateCard.id as string,
        name: rateCard.name as string,
        validFrom: rateCard.valid_from as string,
      },
      lines: lineResult.rows.map((row) => ({
        formatId: row.format_id as string,
        formatLabel: row.format_label as string,
        category: row.category as string,
        durationSec: row.duration_sec === null ? null : Number(row.duration_sec),
        daypart: row.daypart as string,
        channel: row.channel as string,
        grossPrice: Number(row.gross_price),
        discountMaxPct: Number(row.discount_max_pct),
        currency: row.currency as string,
      })),
      segments: segmentResult.rows.map((row) => row.target_segment as string),
    };
  }

  async scoreOptions(
    rateCardId: string,
    targetSegment: string | null,
    selections: Array<Pick<VisitorSelection, 'formatId' | 'daypart' | 'channel'>>
  ) {
    const { RateCardRepository } = await import('./RateCardRepository');
    const { AudienceRepository } = await import('./AudienceRepository');
    const { scoreCampaignOption } = await import('../../engine/scoringEngine');

    const rateCards = new RateCardRepository(this.db);
    const audiences = new AudienceRepository(this.db);

    const card = await this.db.query(
      `SELECT id FROM rate_card
       WHERE id = $1 AND status = 'ACTIVE'
         AND valid_from <= CURRENT_DATE
         AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)`,
      [rateCardId]
    );
    if (!card.rows[0]) return null;

    const results = await Promise.all(selections.map(async (option) => {
      const [rateLine, audience] = await Promise.all([
        rateCards.findLine(rateCardId, option.formatId, option.daypart, option.channel),
        targetSegment
          ? audiences.findLatest(option.formatId, option.daypart, option.channel, targetSegment)
          : Promise.resolve(null),
      ]);
      const scoring = scoreCampaignOption({
        ...option,
        daypart: option.daypart as import('../../types').Daypart,
        targetSegment: targetSegment ?? '',
      }, rateLine, audience);
      return { option, scoring };
    }));

    results.sort((a, b) => (b.scoring.score ?? -1) - (a.scoring.score ?? -1));
    return results;
  }

  async submit(submission: VisitorSubmission): Promise<{ reference: string; token: string }> {
    const client = await this.db.connect();
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const reference = `GTV-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;

    try {
      await client.query('BEGIN');

      let activeRateCardId: string | null = null;
      if (submission.selections.length) {
        const rateCard = await client.query(
          `SELECT id FROM rate_card
           WHERE id = $1 AND status = 'ACTIVE'
             AND valid_from <= CURRENT_DATE
             AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
           FOR SHARE`,
          [submission.rateCardId]
        );
        if (!rateCard.rows[0]) {
          throw new Error('La grille tarifaire active a changé. Rechargez les offres.');
        }
        activeRateCardId = rateCard.rows[0].id as string;
      }

      const snapshotLines = [];
      for (const selection of submission.selections) {
        const { rows } = await client.query(
          `SELECT rcl.gross_price, rcl.currency, f.label AS format_label
           FROM rate_card_line rcl
           JOIN format f ON f.id = rcl.format_id
           WHERE rcl.rate_card_id = $1
             AND rcl.format_id = $2
             AND rcl.daypart = $3
             AND rcl.channel = $4
             AND f.is_active = TRUE
           FOR SHARE OF rcl`,
          [activeRateCardId, selection.formatId, selection.daypart, selection.channel]
        );
        if (!rows[0]) {
          throw new Error('Une offre sélectionnée n’est plus disponible. Rechargez les offres.');
        }

        const unitPrice = Number(rows[0].gross_price);
        const grossTotal = Math.round(unitPrice * 100) * selection.quantity / 100;
        snapshotLines.push({
          ...selection,
          formatLabel: rows[0].format_label as string,
          grossPriceUnit: unitPrice,
          currency: rows[0].currency as string,
          grossTotal,
        });
      }

      const advertiser = await client.query(
        `INSERT INTO advertiser (company_name, sector_code, city)
         VALUES ($1, $2, $3) RETURNING id`,
        [submission.contact.companyName, submission.brief.sectorCode, submission.contact.city]
      );

      const contact = await client.query(
        `INSERT INTO contact
           (advertiser_id, full_name, email, phone, consent_marketing)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          advertiser.rows[0].id,
          submission.contact.fullName,
          submission.contact.email,
          submission.contact.phone,
          submission.contact.consentMarketing,
        ]
      );

      const briefJson = JSON.stringify(submission.brief);
      const planJson = JSON.stringify(snapshotLines);
      const request = await client.query(
        `INSERT INTO quote_request
           (reference, project_id, advertiser_id, contact_id, objective, message,
            campaign_brief, plan_snapshot, rate_card_id, status, submitted_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, 'SOUMISE', NOW())
         RETURNING id`,
        [
          reference,
          advertiser.rows[0].id,
          contact.rows[0].id,
          submission.brief.objective,
          submission.message,
          briefJson,
          planJson,
          activeRateCardId,
        ]
      );

      await client.query(
        `INSERT INTO tracking_token (token_hash, subject_type, subject_id, expires_at)
         VALUES ($1, 'quote_request', $2, NOW() + INTERVAL '30 days')`,
        [tokenHash, request.rows[0].id]
      );

      await client.query('COMMIT');
      return { reference, token: rawToken };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async track(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const { rows } = await this.db.query(
      `UPDATE tracking_token t
       SET last_used_at = NOW(), use_count = use_count + 1
       FROM quote_request qr
       WHERE t.token_hash = $1
         AND t.subject_type = 'quote_request'
         AND t.subject_id = qr.id
         AND t.revoked_at IS NULL
         AND t.expires_at > NOW()
         AND qr.deleted_at IS NULL
       RETURNING qr.reference, qr.status, qr.submitted_at,
                 qr.campaign_brief, qr.plan_snapshot`,
      [tokenHash]
    );
    if (!rows[0]) return null;
    return {
      reference: rows[0].reference as string,
      status: rows[0].status as string,
      submittedAt: rows[0].submitted_at,
      brief: rows[0].campaign_brief,
      plan: rows[0].plan_snapshot,
    };
  }

  async findRequests() {
    const { rows } = await this.db.query(
      `SELECT qr.reference, qr.status, qr.submitted_at, qr.objective,
              qr.campaign_brief, qr.plan_snapshot,
              a.company_name, c.full_name, c.email, c.phone
       FROM quote_request qr
       JOIN advertiser a ON a.id = qr.advertiser_id
       JOIN contact c ON c.id = qr.contact_id
       WHERE qr.deleted_at IS NULL
         AND qr.campaign_brief IS NOT NULL
       ORDER BY qr.submitted_at DESC NULLS LAST
       LIMIT 100`
    );
    return rows.map((row) => ({
      reference: row.reference as string,
      status: row.status as string,
      submittedAt: row.submitted_at,
      objective: row.objective as string | null,
      brief: row.campaign_brief,
      plan: row.plan_snapshot,
      companyName: row.company_name as string,
      fullName: row.full_name as string,
      email: row.email as string,
      phone: row.phone as string | null,
    }));
  }

  async updateRequestStatus(reference: string, status: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE quote_request
       SET status = $2
       WHERE reference = $1 AND deleted_at IS NULL`,
      [reference, status]
    );
    return rowCount === 1;
  }
}
