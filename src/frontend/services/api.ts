// =============================================================================
// GTV Media Sales — Couche service API (client HTTP centralisé)
// POURQUOI centraliser : un seul endroit pour gérer le token JWT,
// les erreurs réseau, et le baseURL. Aucun composant ne fait de fetch direct.
// =============================================================================

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T; status: number }> {
  const token = localStorage.getItem('gtv_token');

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const body = await res.json();

  // 206 = mode dégradé → on laisse passer, le composant gère l'avertissement
  if (!res.ok && res.status !== 206) {
    throw new ApiError(
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? 'Erreur inconnue',
      res.status
    );
  }

  return { data: body.data, status: res.status };
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

// ── Formats ──────────────────────────────────────────────────────────────────

export interface FormatDto {
  id: string;
  code: string;
  label: string;
  category: string;
  durationSec: number | null;
}

export const formatsApi = {
  list: () => request<FormatDto[]>('/formats'),
};

// ── Rate Cards ────────────────────────────────────────────────────────────────

export interface RateCardLineDto {
  id: string;
  formatId: string;
  daypart: string;
  channel: string;
  grossPrice: number;
  discountMaxPct: number;
  isNegotiable: boolean;
}

export interface ActiveRateCardDto {
  id: string;
  name: string;
  validFrom: string;
  lines: RateCardLineDto[];
}

export const rateCardsApi = {
  getActive: () => request<ActiveRateCardDto>('/rate-cards/active'),
};

// ── Scoring ───────────────────────────────────────────────────────────────────

export interface ScoringBatchRequestItem {
  formatId: string;
  daypart: import('../../types').Daypart;
  channel: string;
}

export interface ScoredOptionDto {
  option: ScoringBatchRequestItem;
  scoring: import('../../types').ScoringResult;
}

export const scoringApi = {
  batch: (
    options: ScoringBatchRequestItem[],
    targetSegment: string,
    rateCardId?: string
  ) =>
    request<ScoredOptionDto[]>('/scoring/batch', {
      method: 'POST',
      body: JSON.stringify({ options, targetSegment, rateCardId }),
    }),
};

// ── Audience ──────────────────────────────────────────────────────────────────

export const audienceApi = {
  segments: (formatId: string, daypart: string, channel: string) =>
    request<string[]>(
      `/audience/segments?formatId=${formatId}&daypart=${daypart}&channel=${channel}`
    ),

  // Segments disponibles tous formats confondus pour un projet
  allSegments: (rateCardId: string) =>
    request<string[]>(`/audience/segments/all?rateCardId=${rateCardId}`),
};

// ── Projects ──────────────────────────────────────────────────────────────────

export interface ClientDto {
  id: string;
  name: string;
  sector: string | null;
}

export const clientsApi = {
  list: () => request<ClientDto[]>('/clients'),
};

export interface ProjectDto {
  id: string;
  reference: string;
  title: string;
  clientId: string;
  status: string;
  campaignStart: string | null;
  campaignEnd: string | null;
  budgetTarget: number | null;
  rateCardId: string;
  scoringSnapshot: unknown | null;
}

export const projectsApi = {
  list:   ()           => request<ProjectDto[]>('/projects'),
  getOne: (id: string) => request<ProjectDto>(`/projects/${id}`),
  create: (payload: {
    title: string;
    clientId: string;
    campaignStart?: string;
    campaignEnd?: string;
    budgetTarget?: number;
  }) => request<{ id: string }>('/projects', { method: 'POST', body: JSON.stringify(payload) }),

  submit: (id: string, scoringSnapshot: unknown) =>
    request<never>(`/projects/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ scoringSnapshot }),
    }),
};

// ── Espace visiteur public ────────────────────────────────────────────────────

export interface VisitorCatalogLine {
    formatId: string;
    formatLabel: string;
    category: string;
    durationSec: number | null;
    daypart: string;
    channel: string;
    grossPrice: number;
    discountMaxPct: number;
    currency: string;
}

export interface VisitorCatalogDto {
    rateCard: { id: string; name: string; validFrom: string } | null;
    lines: VisitorCatalogLine[];
    segments: string[];
}

export interface VisitorRequestPayload {
    rateCardId: string | null;
    brief: {
      objective: string;
      targetSegment: string | null;
      budgetHT: number | null;
      periodStart: string | null;
      periodEnd: string | null;
      sectorCode: string | null;
    };
    contact: {
      companyName: string;
      fullName: string;
      email: string;
      phone: string | null;
      city: string | null;
      consentMarketing: boolean;
    };
    selections: Array<{
      formatId: string;
      daypart: string;
      channel: string;
      quantity: number;
    }>;
    message: string | null;
}

export interface VisitorTrackedRequest {
    reference: string;
    status: string;
    submittedAt: string;
    brief: VisitorRequestPayload['brief'];
    plan: Array<VisitorRequestPayload['selections'][number] & {
      formatLabel: string;
      grossPriceUnit: number;
      grossTotal: number;
      currency: string;
    }>;
}

export interface VisitorInboxItem extends VisitorTrackedRequest {
  objective: string | null;
  companyName: string;
  fullName: string;
  email: string;
  phone: string | null;
}

export const visitorApi = {
    catalog: () => request<VisitorCatalogDto>('/public/catalog'),
    score: (
      rateCardId: string,
      targetSegment: string | null,
      options: ScoringBatchRequestItem[]
    ) => request<ScoredOptionDto[]>('/public/scoring/batch', {
      method: 'POST',
      body: JSON.stringify({ rateCardId, targetSegment, options }),
    }),
    submit: (payload: VisitorRequestPayload) =>
      request<{ reference: string; trackingToken: string }>('/public/quote-requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    track: (token: string) =>
      request<VisitorTrackedRequest>(`/public/quote-requests/${encodeURIComponent(token)}`),
    inbox: () => request<VisitorInboxItem[]>('/visitor/quote-requests'),
    updateStatus: (reference: string, status: string) =>
      request<{ reference: string; status: string }>(
        `/visitor/quote-requests/${encodeURIComponent(reference)}/status`,
        { method: 'PATCH', body: JSON.stringify({ status }) }
      ),
};
