import { db, generateId } from '../lib/db';
import type { Sighting, ChecklistItem, ZooAnimal } from '../types';

// ============================================
// Sightings Service - Swap-ready for Supabase
// ============================================

export async function getSightingsByVisit(visitId: string): Promise<Sighting[]> {
  return db.sightings.where('visitId').equals(visitId).toArray();
}

export async function getSightingById(id: string): Promise<Sighting | undefined> {
  return db.sightings.get(id);
}

export async function getAllSightings(): Promise<Sighting[]> {
  return db.sightings.orderBy('seenAt').reverse().toArray();
}

export async function createSighting(sighting: Omit<Sighting, 'id'>): Promise<Sighting> {
  const newSighting: Sighting = {
    ...sighting,
    id: generateId(),
  };
  await db.sightings.add(newSighting);
  return newSighting;
}

export async function deleteSighting(id: string): Promise<void> {
  await db.sightings.delete(id);
}

export async function toggleSighting(
  visitId: string,
  animalId: string
): Promise<{ added: boolean; sighting?: Sighting }> {
  // Check if sighting exists
  const existing = await db.sightings
    .filter(s => s.visitId === visitId && s.animalId === animalId)
    .first();

  if (existing) {
    await deleteSighting(existing.id);
    return { added: false };
  }

  const sighting = await createSighting({
    visitId,
    animalId,
    seenAt: new Date(),
    aiIdentified: false,
  });

  return { added: true, sighting };
}

// Add sighting from AI identification
export async function addAISighting(
  visitId: string,
  animalId: string,
  confidence: number,
  photoBase64?: string
): Promise<Sighting> {
  // Check if already sighted
  const existing = await db.sightings
    .filter(s => s.visitId === visitId && s.animalId === animalId)
    .first();

  if (existing) {
    // Update with AI info
    await db.sightings.update(existing.id, {
      aiIdentified: true,
      aiConfidence: confidence,
      photoBase64,
    });
    return { ...existing, aiIdentified: true, aiConfidence: confidence, photoBase64 };
  }

  return createSighting({
    visitId,
    animalId,
    seenAt: new Date(),
    aiIdentified: true,
    aiConfidence: confidence,
    photoBase64,
  });
}

// Build checklist with sighting status
export async function buildChecklist(
  animals: ZooAnimal[],
  visitId: string
): Promise<ChecklistItem[]> {
  const sightings = await getSightingsByVisit(visitId);
  const sightingMap = new Map(sightings.map(s => [s.animalId, s]));

  return animals.map(animal => ({
    ...animal,
    seen: sightingMap.has(animal.id),
    sighting: sightingMap.get(animal.id),
  }));
}

// Get unique animals spotted (across all visits)
export async function getUniqueAnimalsSeen(): Promise<Set<string>> {
  const sightings = await getAllSightings();
  return new Set(sightings.map(s => s.animalId));
}

// Get total photo count
export async function getPhotoCount(): Promise<number> {
  const sightings = await getAllSightings();
  return sightings.filter(s => s.photoBase64 || s.photoUrl).length;
}
