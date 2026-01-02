import { api } from '../lib/api';
import type { ZooAnimal } from '../types';

// ============================================
// Animals Service - Cloudflare D1 via API
// ============================================

export async function getAnimalsByZoo(zooId: string): Promise<ZooAnimal[]> {
  return api.get<ZooAnimal[]>(`/api/zoos/${zooId}/animals`);
}

export async function getAnimalById(_id: string): Promise<ZooAnimal | undefined> {
  // This would need a dedicated endpoint, for now fetch all and filter
  // In practice, we usually have the animal from the list already
  return undefined;
}

export async function createAnimal(
  zooId: string,
  animal: Omit<ZooAnimal, 'id' | 'createdAt' | 'zooId'>
): Promise<ZooAnimal> {
  return api.post<ZooAnimal>(`/api/zoos/${zooId}/animals`, animal);
}

// Note: Animal generation is handled by the backend at /api/zoos/:id/animals/generate
