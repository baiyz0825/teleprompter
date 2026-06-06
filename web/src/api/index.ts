import type { Script, CreateScriptRequest, UpdateScriptRequest, Settings } from '../lib/types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function listScripts(): Promise<Script[]> {
  return request<Script[]>('/scripts');
}

export async function getScript(id: string): Promise<Script> {
  return request<Script>(`/scripts/${id}`);
}

export async function createScript(data: CreateScriptRequest): Promise<Script> {
  return request<Script>('/scripts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateScript(id: string, data: UpdateScriptRequest): Promise<Script> {
  return request<Script>(`/scripts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteScript(id: string): Promise<void> {
  return request<void>(`/scripts/${id}`, { method: 'DELETE' });
}

export async function getSettings(): Promise<Settings> {
  return request<Settings>('/settings');
}

export async function updateSettings(data: Settings): Promise<void> {
  return request<void>('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
