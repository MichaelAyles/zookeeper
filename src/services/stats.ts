import { api } from '../lib/api';
import type { UserStats, CategoryStats, AnimalCategory } from '../types';

// ============================================
// Stats Service - Cloudflare D1 via API
// ============================================

export async function getUserStats(): Promise<UserStats> {
  return api.get<UserStats>('/api/stats');
}

export async function getCategoryStats(): Promise<CategoryStats[]> {
  const stats = await api.get<UserStats>('/api/stats');

  const icons: Record<string, string> = {
    Mammals: '🦁',
    Birds: '🦅',
    Reptiles: '🐊',
    Amphibians: '🐸',
    Fish: '🐠',
    Invertebrates: '🦋',
  };

  return (stats.categoryBreakdown || []).map((cat) => ({
    category: cat.category as AnimalCategory,
    count: cat.count,
    icon: icons[cat.category] || '🐾',
  }));
}

export async function getZooStats(): Promise<
  Array<{
    zooId: string;
    zooName: string;
    visitCount: number;
    animalsSpotted: number;
    lastVisit?: string;
  }>
> {
  const stats = await api.get<UserStats>('/api/stats');

  return (stats.zooStats || []).map((zoo) => ({
    zooId: zoo.id,
    zooName: zoo.name,
    visitCount: zoo.visitCount,
    animalsSpotted: zoo.animalsSpotted,
    lastVisit: zoo.lastVisit,
  }));
}

export async function getRecentSightings(limit: number = 10): Promise<
  Array<{
    sighting: {
      id: string;
      seenAt: string;
      photoUrl?: string | null;
    };
    animal: {
      commonName: string;
      category: AnimalCategory;
    };
    zooName: string;
  }>
> {
  const stats = await api.get<UserStats>('/api/stats');

  return (stats.recentSightings || []).slice(0, limit).map((s) => ({
    sighting: {
      id: s.id,
      seenAt: s.seenAt,
      photoUrl: s.photoUrl,
    },
    animal: {
      commonName: s.animalName,
      category: s.category as AnimalCategory,
    },
    zooName: s.zooName,
  }));
}
