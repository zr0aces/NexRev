import type { ActivityContext, KanbanColumn, Opportunity } from './types';

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
  const hasBody = options?.body !== undefined && options?.body !== null;
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
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
    getHealth: () => request<{ status: string; version: string }>('/health'),
    login: (username: string, password: string) =>
      request<{ token: string; username: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    updateTelegram: (chatId: string | null) =>
      request<{ ok: boolean }>('/auth/telegram', {
        method: 'POST',
        body: JSON.stringify({ chatId }),
      }),
    getMe: () => request<{ username: string; telegram_chat_id: string | null }>('/auth/me'),
    updatePassword: (password: string) =>
      request<{ ok: boolean }>('/auth/password', {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    getTelegramLinkToken: () => request<{ token: string; botName: string }>('/auth/telegram/link-token'),
    pollTelegramLink: (token: string) => request<{ chatId: string | null }>(`/auth/telegram/poll-link?token=${token}`),
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
    add: (id: string, data: { raw: string; summary?: string; ai: boolean; sf?: boolean }) =>
      request<Opportunity>(`/opportunities/${id}/activities`, { method: 'POST', body: JSON.stringify(data) }),
  },
  steps: {
    add: (id: string, text: string, column: KanbanColumn = 'todo') =>
      request<Opportunity>(`/opportunities/${id}/steps`, {
        method: 'POST',
        body: JSON.stringify({ text, column }),
      }),
    update: (id: string, index: number, data: { done?: boolean; column?: KanbanColumn }) =>
      request<Opportunity>(`/opportunities/${id}/steps/${index}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (id: string, index: number) =>
      request<Opportunity>(`/opportunities/${id}/steps/${index}`, { method: 'DELETE' }),
  },
  ai: {
    summarize: (raw: string, id: string) =>
      request<{ summary: string }>('/ai/summarize', {
        method: 'POST',
        body: JSON.stringify({ raw, id }),
      }),
    sfNote: (id: string, context?: ActivityContext) =>
      request<{ note: string }>('/ai/sf-note', {
        method: 'POST',
        body: JSON.stringify({ id, context }),
      }),
    extractTasks: (id: string, context?: ActivityContext) =>
      request<Opportunity>('/ai/extract-tasks', {
        method: 'POST',
        body: JSON.stringify({ id, context }),
      }),
  },
};
