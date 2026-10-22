import {
  AnalyticsSummary,
  CheckRecord,
  CreateMonitorPayload,
  Incident,
  Monitor,
  User,
} from '../types';

const API_BASE = '/api/v1';

class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem('api_sentinel_token');
}

export function setStoredToken(token: string): void {
  localStorage.setItem('api_sentinel_token', token);
}

export function removeStoredToken(): void {
  localStorage.removeItem('api_sentinel_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData = { code: 'HTTP_ERROR', message: `Request failed with status ${response.status}` };
    try {
      const json = await response.json();
      if (json.error) {
        errorData = json.error;
      }
    } catch {
      // JSON parsing fallback
    }
    throw new ApiError(response.status, errorData.code, errorData.message);
  }

  return response.json() as Promise<T>;
}

export const api = {
  auth: {
    login: async (email: string, name?: string): Promise<{ token: string; user: User }> => {
      const res = await request<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, name }),
      });
      setStoredToken(res.token);
      return res;
    },
    getMe: async (): Promise<{ user: User }> => {
      return request<{ user: User }>('/auth/me');
    },
  },
  monitors: {
    list: async (isActive?: boolean): Promise<{ monitors: Monitor[]; pagination: any }> => {
      const query = isActive !== undefined ? `?isActive=${isActive}` : '';
      return request<{ monitors: Monitor[]; pagination: any }>(`/monitors${query}`);
    },
    get: async (id: string): Promise<{ monitor: Monitor }> => {
      return request<{ monitor: Monitor }>(`/monitors/${id}`);
    },
    create: async (data: CreateMonitorPayload): Promise<{ monitor: Monitor }> => {
      return request<{ monitor: Monitor }>('/monitors', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id: string, data: Partial<CreateMonitorPayload>): Promise<{ monitor: Monitor }> => {
      return request<{ monitor: Monitor }>(`/monitors/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    delete: async (id: string): Promise<{ message: string }> => {
      return request<{ message: string }>(`/monitors/${id}`, {
        method: 'DELETE',
      });
    },
    pause: async (id: string): Promise<{ monitor: Monitor }> => {
      return request<{ monitor: Monitor }>(`/monitors/${id}/pause`, {
        method: 'POST',
      });
    },
    resume: async (id: string): Promise<{ monitor: Monitor }> => {
      return request<{ monitor: Monitor }>(`/monitors/${id}/resume`, {
        method: 'POST',
      });
    },
    getChecks: async (
      id: string,
      limit = 25,
      offset = 0,
      outcome?: string
    ): Promise<{ checks: CheckRecord[]; pagination: any }> => {
      let q = `?limit=${limit}&offset=${offset}`;
      if (outcome) q += `&outcome=${outcome}`;
      return request<{ checks: CheckRecord[]; pagination: any }>(`/monitors/${id}/checks${q}`);
    },
    getAnalytics: async (id: string, window = '24h'): Promise<AnalyticsSummary> => {
      return request<AnalyticsSummary>(`/monitors/${id}/analytics?window=${window}`);
    },
    getIncidents: async (id: string, limit = 20): Promise<{ incidents: Incident[]; total: number }> => {
      return request<{ incidents: Incident[]; total: number }>(`/monitors/${id}/incidents?limit=${limit}`);
    },
  },
};
