import { api } from '../lib/api';
import type { Zoo } from '../types';

// ============================================
// Zoo Service - Cloudflare D1 via API
// ============================================

export async function getZoos(lat?: number, lon?: number): Promise<Zoo[]> {
  const params = new URLSearchParams();
  if (lat !== undefined) params.set('lat', String(lat));
  if (lon !== undefined) params.set('lon', String(lon));

  const query = params.toString();
  return api.get<Zoo[]>(`/api/zoos${query ? `?${query}` : ''}`);
}

export async function getZooById(id: string): Promise<Zoo | undefined> {
  try {
    return await api.get<Zoo>(`/api/zoos/${id}`);
  } catch {
    return undefined;
  }
}

export async function searchZoos(query: string): Promise<Zoo[]> {
  const zoos = await getZoos();
  const lowerQuery = query.toLowerCase();
  return zoos.filter(
    (zoo) =>
      zoo.name.toLowerCase().includes(lowerQuery) ||
      zoo.country.toLowerCase().includes(lowerQuery) ||
      (zoo.city?.toLowerCase().includes(lowerQuery) ?? false)
  );
}

export async function createZoo(
  zoo: Omit<Zoo, 'id' | 'createdAt' | 'isVisited'>
): Promise<Zoo> {
  return api.post<Zoo>('/api/zoos', zoo);
}

// Note: seedZoos is no longer needed - zoos are seeded in D1 migration
export async function seedZoos(): Promise<void> {
  // No-op - zoos are pre-seeded in the database
}
