import { db } from '../lib/db';
import { getUniqueAnimalsSeen, getPhotoCount } from './sightings';
import type { UserStats, CategoryStats, AnimalCategory } from '../types';

// ============================================
// Stats Service - Swap-ready for Supabase
// ============================================

export async function getUserStats(): Promise<UserStats> {
  const visits = await db.visits.toArray();
  const uniqueZoos = new Set(visits.map(v => v.zooId));
  const uniqueAnimals = await getUniqueAnimalsSeen();
  const photos = await getPhotoCount();

  return {
    totalZoosVisited: uniqueZoos.size,
    totalAnimalsSpotted: uniqueAnimals.size,
    totalPhotos: photos,
    totalVisits: visits.length,
  };
}

export async function getCategoryStats(): Promise<CategoryStats[]> {
  const sightings = await db.sightings.toArray();
  const animalIds = new Set(sightings.map(s => s.animalId));

  // Get animal details for each sighting
  const animals = await db.animals
    .filter(a => animalIds.has(a.id))
    .toArray();

  // Count by category
  const counts: Record<AnimalCategory, number> = {
    Mammals: 0,
    Birds: 0,
    Reptiles: 0,
    Amphibians: 0,
    Fish: 0,
    Invertebrates: 0,
  };

  for (const animal of animals) {
    counts[animal.category]++;
  }

  const icons: Record<AnimalCategory, string> = {
    Mammals: '🦁',
    Birds: '🦅',
    Reptiles: '🐊',
    Amphibians: '🐸',
    Fish: '🐠',
    Invertebrates: '🦋',
  };

  return Object.entries(counts).map(([category, count]) => ({
    category: category as AnimalCategory,
    count,
    icon: icons[category as AnimalCategory],
  }));
}

export async function getZooStats(): Promise<Array<{
  zooId: string;
  zooName: string;
  visitCount: number;
  animalsSpotted: number;
  totalAnimals: number;
  completionPercent: number;
  lastVisit?: Date;
}>> {
  const visits = await db.visits.orderBy('startedAt').reverse().toArray();
  const zoos = await db.zoos.toArray();
  const sightings = await db.sightings.toArray();

  const zooMap = new Map(zoos.map(z => [z.id, z]));
  const stats = new Map<string, {
    visitCount: number;
    sightedAnimals: Set<string>;
    lastVisit?: Date;
  }>();

  // Aggregate visit data
  for (const visit of visits) {
    const existing = stats.get(visit.zooId) || {
      visitCount: 0,
      sightedAnimals: new Set<string>(),
    };
    existing.visitCount++;
    if (!existing.lastVisit || visit.startedAt > existing.lastVisit) {
      existing.lastVisit = visit.startedAt;
    }
    stats.set(visit.zooId, existing);
  }

  // Add sighting counts
  for (const sighting of sightings) {
    const visit = visits.find(v => v.id === sighting.visitId);
    if (visit) {
      const stat = stats.get(visit.zooId);
      if (stat) {
        stat.sightedAnimals.add(sighting.animalId);
      }
    }
  }

  // Build result
  const result = [];
  for (const [zooId, stat] of stats) {
    const zoo = zooMap.get(zooId);
    if (!zoo) continue;

    const totalAnimals = await db.animals.where('zooId').equals(zooId).count();

    result.push({
      zooId,
      zooName: zoo.name,
      visitCount: stat.visitCount,
      animalsSpotted: stat.sightedAnimals.size,
      totalAnimals,
      completionPercent: totalAnimals > 0
        ? Math.round((stat.sightedAnimals.size / totalAnimals) * 100)
        : 0,
      lastVisit: stat.lastVisit,
    });
  }

  // Sort by completion percentage descending
  return result.sort((a, b) => b.completionPercent - a.completionPercent);
}

// Get recent sightings with animal details
export async function getRecentSightings(limit: number = 10): Promise<Array<{
  sighting: {
    id: string;
    seenAt: Date;
    photoBase64?: string;
  };
  animal: {
    commonName: string;
    category: AnimalCategory;
  };
  zooName: string;
}>> {
  const sightings = await db.sightings
    .orderBy('seenAt')
    .reverse()
    .limit(limit)
    .toArray();

  const result = [];
  for (const sighting of sightings) {
    const animal = await db.animals.get(sighting.animalId);
    if (!animal) continue;

    const visit = await db.visits.get(sighting.visitId);
    if (!visit) continue;

    const zoo = await db.zoos.get(visit.zooId);
    if (!zoo) continue;

    result.push({
      sighting: {
        id: sighting.id,
        seenAt: sighting.seenAt,
        photoBase64: sighting.photoBase64,
      },
      animal: {
        commonName: animal.commonName,
        category: animal.category,
      },
      zooName: zoo.name,
    });
  }

  return result;
}
