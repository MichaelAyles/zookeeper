import { api } from '../lib/api';
import type { Visit } from '../types';

// ============================================
// Visits Service - Cloudflare D1 via API
// ============================================

export async function getVisits(): Promise<Visit[]> {
  return api.get<Visit[]>('/api/visits');
}

export async function getVisitById(id: string): Promise<Visit | undefined> {
  try {
    return await api.get<Visit>(`/api/visits/${id}`);
  } catch {
    return undefined;
  }
}

export async function getActiveVisit(): Promise<Visit | null> {
  return api.get<Visit | null>('/api/visits/active');
}

export async function startVisit(zooId: string): Promise<Visit> {
  return api.post<Visit>('/api/visits', { zooId });
}

export async function endVisit(id: string): Promise<void> {
  await api.patch(`/api/visits/${id}`, { endedAt: new Date().toISOString() });
}

export async function updateVisitNotes(id: string, notes: string): Promise<void> {
  await api.patch(`/api/visits/${id}`, { notes });
}

// Note: deleteVisit not exposed via API for safety
// Visits are user data and deletion would be handled differently
