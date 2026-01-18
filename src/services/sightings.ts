import { api } from '../lib/api';
import type { Sighting, ChecklistItem, ZooAnimal } from '../types';

// ============================================
// Sightings Service - Cloudflare D1 via API
// ============================================

export async function getSightingsByVisit(visitId: string): Promise<Sighting[]> {
  return api.get<Sighting[]>(`/api/sightings?visitId=${visitId}`);
}

export async function getAllSightings(): Promise<Sighting[]> {
  return api.get<Sighting[]>('/api/sightings');
}

export async function createSighting(sighting: Omit<Sighting, 'id'>): Promise<Sighting> {
  return api.post<Sighting>('/api/sightings', sighting);
}

export async function deleteSighting(id: string): Promise<void> {
  await api.delete(`/api/sightings?id=${id}`);
}

export async function toggleSighting(
  visitId: string,
  animalId: string
): Promise<{ added: boolean; sighting?: Sighting }> {
  // Check existing sightings
  const sightings = await getSightingsByVisit(visitId);
  const existing = sightings.find((s) => s.animalId === animalId);

  if (existing) {
    await deleteSighting(existing.id);
    return { added: false };
  }

  const sighting = await createSighting({
    visitId,
    animalId,
    seenAt: new Date().toISOString(),
    aiIdentified: false,
  });

  return { added: true, sighting };
}

// Upload photo to R2 and return the URL
async function uploadPhoto(base64Image: string): Promise<string> {
  const response = await api.post<{ photoUrl: string }>('/api/upload', {
    image: base64Image,
  });
  return response.photoUrl;
}

// Add sighting from AI identification
export async function addAISighting(
  visitId: string,
  animalId: string,
  confidence: number,
  base64Image?: string
): Promise<Sighting> {
  // Upload photo to R2 first if provided
  let photoUrl: string | undefined;
  if (base64Image) {
    try {
      photoUrl = await uploadPhoto(base64Image);
    } catch (err) {
      console.error('Failed to upload photo:', err);
      // Continue without photo if upload fails
    }
  }

  // API handles upsert - will update existing or create new
  return api.post<Sighting>('/api/sightings', {
    visitId,
    animalId,
    aiIdentified: true,
    aiConfidence: confidence,
    photoUrl,
  });
}

// Build checklist with sighting status
export async function buildChecklist(
  animals: ZooAnimal[],
  visitId: string
): Promise<ChecklistItem[]> {
  const sightings = await getSightingsByVisit(visitId);
  const sightingMap = new Map(sightings.map((s) => [s.animalId, s]));

  return animals.map((animal) => ({
    ...animal,
    seen: sightingMap.has(animal.id),
    sighting: sightingMap.get(animal.id),
  }));
}
