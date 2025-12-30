import { db, generateId } from '../lib/db';
import type { Visit } from '../types';

// ============================================
// Visits Service - Swap-ready for Supabase
// ============================================

export async function getVisits(): Promise<Visit[]> {
  return db.visits.orderBy('startedAt').reverse().toArray();
}

export async function getVisitById(id: string): Promise<Visit | undefined> {
  return db.visits.get(id);
}

export async function getVisitsByZoo(zooId: string): Promise<Visit[]> {
  return db.visits.where('zooId').equals(zooId).toArray();
}

export async function getActiveVisit(): Promise<Visit | undefined> {
  // Find the most recent visit without an endedAt
  const visits = await db.visits
    .filter(v => !v.endedAt)
    .reverse()
    .sortBy('startedAt');
  return visits[0];
}

export async function startVisit(zooId: string): Promise<Visit> {
  // End any active visits first
  const activeVisit = await getActiveVisit();
  if (activeVisit) {
    await endVisit(activeVisit.id);
  }

  const visit: Visit = {
    id: generateId(),
    zooId,
    startedAt: new Date(),
  };
  await db.visits.add(visit);
  return visit;
}

export async function endVisit(id: string): Promise<void> {
  await db.visits.update(id, { endedAt: new Date() });
}

export async function updateVisitNotes(id: string, notes: string): Promise<void> {
  await db.visits.update(id, { notes });
}

export async function deleteVisit(id: string): Promise<void> {
  // Also delete associated sightings
  await db.sightings.where('visitId').equals(id).delete();
  await db.visits.delete(id);
}

// Get visit count per zoo
export async function getVisitCountByZoo(): Promise<Map<string, number>> {
  const visits = await db.visits.toArray();
  const counts = new Map<string, number>();

  for (const visit of visits) {
    const current = counts.get(visit.zooId) || 0;
    counts.set(visit.zooId, current + 1);
  }

  return counts;
}
