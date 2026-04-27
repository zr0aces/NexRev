import type { Opportunity } from './types';

const BASE = '/api';

export function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function setToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('auth_token');
}

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(cb: () => void): void {
  onUnauthorized = cb;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (res.status === 401) {
    clearToken();
    onUnauthorized?.();
    throw new Error('Session expired. Please log in again.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
  },
  opportunities: {
    list: () => request<Opportunity[]>('/opportunities'),
    create: (data: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt' | 'activities' | 'nextSteps'>) =>
      request<Opportunity>('/opportunities', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Opportunity>) =>
      request<Opportunity>(`/opportunities/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/opportunities/${id}`, { method: 'DELETE' }),
    import: (data: Partial<Opportunity>[]) =>
      request<{ imported: number }>('/import', { method: 'POST', body: JSON.stringify(data) }),
  },
  activities: {
    add: (id: string, data: { raw: string; summary?: string; ai: boolean }) =>
      request<Opportunity>(`/opportunities/${id}/activities`, { method: 'POST', body: JSON.stringify(data) }),
    moveColumn: (id: string, index: number, column: string) =>
      request<Opportunity>(`/opportunities/${id}/activities/${index}`, {
        method: 'PATCH',
        body: JSON.stringify({ column }),
      }),
  },
  steps: {
    add: (id: string, text: string) =>
      request<Opportunity>(`/opportunities/${id}/steps`, { method: 'POST', body: JSON.stringify({ text }) }),
    toggle: (id: string, index: number, done: boolean) =>
      request<Opportunity>(`/opportunities/${id}/steps/${index}`, { method: 'PATCH', body: JSON.stringify({ done }) }),
    remove: (id: string, index: number) =>
      request<Opportunity>(`/opportunities/${id}/steps/${index}`, { method: 'DELETE' }),
  },
  ai: {
    summarize: (raw: string) =>
      request<{ summary: string }>('/ai/summarize', { method: 'POST', body: JSON.stringify({ raw }) }),
    sfNote: (data: { oppName: string; stage: string; contact: string; recentActivities: string; nextStep: string }) =>
      request<{ note: string }>('/ai/sf-note', { method: 'POST', body: JSON.stringify(data) }),
  },
};
