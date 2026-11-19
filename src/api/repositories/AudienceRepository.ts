// =============================================================================
// GTV Media Sales — Repository : Audience Dataset
// =============================================================================

import { Pool } from 'pg';
import type { AudienceDataset } from '../../types';

export class AudienceRepository {
  constructor(private readonly db: Pool) {}

  /**
   * Récupère la donnée d'audience la plus récente pour une combinaison donnée.
   * POURQUOI ORDER BY period_end DESC LIMIT 1 :
   * on veut toujours la mesure la plus fraîche, sans supprimer l'historique.
   */
  async findLatest(
    formatId: string,
    daypart: string,
    channel: string,
    targetSegment: string
  ): Promise<AudienceDataset | null> {
    const { rows } = await this.db.query(
      `SELECT id, format_id, daypart, channel, period_start, period_end,
              source, target_segment, grp, reach_pct, affinity_index, imported_at
       FROM audience_dataset
       WHERE format_id = $1 AND daypart = $2 AND channel = $3 AND target_segment = $4
       ORDER BY period_end DESC
       LIMIT 1`,
      [formatId, daypart, channel, targetSegment]
    );
    return rows[0] ? mapAudience(rows[0]) : null;
  }

  /** Récupère tous les segments disponibles pour une combinaison format/daypart/channel */
  async findAvailableSegments(
    formatId: string,
    daypart: string,
    channel: string
  ): Promise<string[]> {
    const { rows } = await this.db.query(
      `SELECT DISTINCT target_segment
       FROM audience_dataset
       WHERE format_id = $1 AND daypart = $2 AND channel = $3
       ORDER BY target_segment`,
      [formatId, daypart, channel]
    );
    return rows.map((r) => r.target_segment as string);
  }

  /**
   * Tous les segments distincts couverts par les lignes d'une grille tarifaire.
   * Joint rate_card_line → audience_dataset pour ne retourner que les segments
   * effectivement mesurés sur les formats/dayparts/channels de la grille.
   */
  async findAllSegmentsForRateCard(rateCardId: string): Promise<string[]> {
    const { rows } = await this.db.query(
      `SELECT DISTINCT a.target_segment
       FROM audience_dataset a
       INNER JOIN rate_card_line rcl
         ON rcl.format_id = a.format_id
        AND rcl.daypart   = a.daypart
        AND rcl.channel   = a.channel
       WHERE rcl.rate_card_id = $1
       ORDER BY a.target_segment`,
      [rateCardId]
    );
    return rows.map((r) => r.target_segment as string);
  }
}

function mapAudience(row: Record<string, unknown>): AudienceDataset {
  return {
    id:             row.id as string,
    formatId:       row.format_id as string,
    daypart:        row.daypart as AudienceDataset['daypart'],
    channel:        row.channel as string,
    periodStart:    String(row.period_start).slice(0, 10),
    periodEnd:      String(row.period_end).slice(0, 10),
    source:         row.source as string,
    targetSegment:  row.target_segment as string,
    grp:            row.grp !== null ? Number(row.grp) : null,
    reachPct:       row.reach_pct !== null ? Number(row.reach_pct) : null,
    affinityIndex:  row.affinity_index !== null ? Number(row.affinity_index) : null,
  };
}
