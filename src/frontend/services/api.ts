// =============================================================================
// GTV Media Sales — Couche service API (client HTTP centralisé)
// POURQUOI centraliser : un seul endroit pour gérer le token JWT,
// les erreurs réseau, et le baseURL. Aucun composant ne fait de fetch direct.
// =============================================================================

import { useAuthStore } from '../store/authStore';

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

  const responseText = await res.text();
  let body: { data?: T; error?: { code?: string; message?: string } } = {};
  if (responseText) {
    try {
      body = JSON.parse(responseText) as typeof body;
    } catch {
      if (res.ok) {
        throw new ApiError('INVALID_RESPONSE', 'Réponse invalide du serveur', res.status);
      }
    }
  }

  // 206 = mode dégradé → on laisse passer, le composant gère l'avertissement
  if (!res.ok && res.status !== 206) {
    if (res.status === 401) {
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
    throw new ApiError(
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? `La requête a échoué (${res.status}).`,
      res.status
    );
  }

  return { data: body.data as T, status: res.status };
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
  currency: string;
  isNegotiable: boolean;
}

export interface ActiveRateCardDto {
  id: string;
  name: string;
  validFrom: string;
  lines: RateCardLineDto[];
}

export interface AdminRateCardDto {
  id: string;
  name: string;
  validFrom: string;
  validTo: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  lines: RateCardLineDto[];
}

export const rateCardsApi = {
  getActive: () => request<ActiveRateCardDto>('/rate-cards/active'),
  listAdmin: () => request<AdminRateCardDto[]>('/admin/rate-cards'),
  create: (payload: { name: string; validFrom: string; validTo?: string }) =>
    request<{ id: string }>('/rate-cards', { method: 'POST', body: JSON.stringify(payload) }),
  addLine: (rateCardId: string, payload: {
    formatId: string;
    daypart: string;
    channel: string;
    grossPrice: number;
    discountMaxPct: number;
    currency: string;
    isNegotiable: boolean;
  }) => request<RateCardLineDto>(`/admin/rate-cards/${rateCardId}/lines`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateLine: (rateCardId: string, lineId: string, payload: {
    formatId: string;
    daypart: string;
    channel: string;
    grossPrice: number;
    discountMaxPct: number;
    currency: string;
    isNegotiable: boolean;
  }) => request<RateCardLineDto>(`/admin/rate-cards/${rateCardId}/lines/${lineId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  deleteLine: (rateCardId: string, lineId: string) =>
    request<never>(`/admin/rate-cards/${rateCardId}/lines/${lineId}`, { method: 'DELETE' }),
  activate: (id: string) =>
    request<never>(`/rate-cards/${id}/activate`, { method: 'PATCH' }),
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
  listAdmin: () => request<AdminClientDto[]>('/admin/clients'),
  create: (payload: { name: string; sector: string | null }) =>
    request<AdminClientDto>('/admin/clients', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: { name: string; sector: string | null }) =>
    request<AdminClientDto>(`/admin/clients/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  setActive: (id: string, isActive: boolean) =>
    request<{ id: string; isActive: boolean }>(`/admin/clients/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),
};

export interface AdminClientDto extends ClientDto {
  isActive: boolean;
  createdAt: string;
}

export interface ProjectDto {
  id: string;
  reference: string;
  title: string;
  clientId: string;
  clientName: string;
  status: string;
  campaignStart: string | null;
  campaignEnd: string | null;
  budgetTarget: number | null;
  rateCardId: string;
  scoringSnapshot: unknown | null;
  updatedAt: string;
}

export interface ProjectFollowUpDto {
  id: string;
  projectId: string;
  note: string;
  dueDate: string;
  completedAt: string | null;
  createdAt: string;
  projectTitle?: string;
  projectReference?: string;
}

export const projectsApi = {
  list:   ()           => request<ProjectDto[]>('/projects'),
  getOne: (id: string) => request<ProjectDto>(`/projects/${id}`),
  update: (id: string, payload: {
    title: string;
    clientId: string;
    campaignStart: string | null;
    campaignEnd: string | null;
    budgetTarget: number | null;
  }) => request<{ id: string }>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  updateStatus: (id: string, status: string) =>
    request<{ id: string; status: string }>(`/projects/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
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

export const projectFollowUpsApi = {
  list: () => request<ProjectFollowUpDto[]>('/projects/follow-ups'),
  listForProject: (projectId: string) =>
    request<ProjectFollowUpDto[]>(`/projects/${projectId}/follow-ups`),
  create: (projectId: string, payload: { note: string; dueDate: string }) =>
    request<ProjectFollowUpDto>(`/projects/${projectId}/follow-ups`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  setCompleted: (projectId: string, followUpId: string, completed: boolean) =>
    request<{ id: string; completed: boolean }>(`/projects/${projectId}/follow-ups/${followUpId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),
};

// ── Administration ────────────────────────────────────────────────────────────

export interface AdminUserDto {
  id: string;
  email: string;
  name: string;
  role: import('../../api/types').UserRole;
  isActive: boolean;
  createdAt: string;
}

export const adminUsersApi = {
  list: () => request<AdminUserDto[]>('/admin/users'),
  create: (payload: { email: string; name: string; role: AdminUserDto['role']; password: string }) =>
    request<AdminUserDto>('/admin/users', { method: 'POST', body: JSON.stringify(payload) }),
  setActive: (id: string, isActive: boolean) =>
    request<{ id: string; isActive: boolean }>(`/admin/users/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),
  setRole: (id: string, role: AdminUserDto['role']) =>
    request<{ id: string; role: AdminUserDto['role'] }>(`/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  resetPassword: (id: string, password: string) =>
    request<{ id: string }>(`/admin/users/${id}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
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
