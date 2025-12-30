import { db, generateId } from '../lib/db';
import type { Zoo } from '../types';

// ============================================
// Zoo Service - Swap-ready for Supabase
// ============================================

export async function getZoos(): Promise<Zoo[]> {
  return db.zoos.toArray();
}

export async function getZooById(id: string): Promise<Zoo | undefined> {
  return db.zoos.get(id);
}

export async function searchZoos(query: string): Promise<Zoo[]> {
  const lowerQuery = query.toLowerCase();
  return db.zoos
    .filter(zoo =>
      zoo.name.toLowerCase().includes(lowerQuery) ||
      zoo.country.toLowerCase().includes(lowerQuery) ||
      (zoo.city?.toLowerCase().includes(lowerQuery) ?? false)
    )
    .toArray();
}

export async function createZoo(zoo: Omit<Zoo, 'id' | 'createdAt'>): Promise<Zoo> {
  const newZoo: Zoo = {
    ...zoo,
    id: generateId(),
    createdAt: new Date(),
  };
  await db.zoos.add(newZoo);
  return newZoo;
}

export async function updateZoo(id: string, updates: Partial<Zoo>): Promise<void> {
  await db.zoos.update(id, updates);
}

export async function deleteZoo(id: string): Promise<void> {
  await db.zoos.delete(id);
}

// Seed initial popular zoos
export async function seedZoos(): Promise<void> {
  const count = await db.zoos.count();
  if (count > 0) return; // Already seeded

  const popularZoos: Omit<Zoo, 'id' | 'createdAt'>[] = [
    { name: 'Chester Zoo', city: 'Chester', country: 'United Kingdom' },
    { name: 'London Zoo', city: 'London', country: 'United Kingdom' },
    { name: 'Edinburgh Zoo', city: 'Edinburgh', country: 'United Kingdom' },
    { name: 'San Diego Zoo', city: 'San Diego', country: 'United States' },
    { name: 'Bronx Zoo', city: 'New York', country: 'United States' },
    { name: 'Singapore Zoo', city: 'Singapore', country: 'Singapore' },
    { name: 'Berlin Zoological Garden', city: 'Berlin', country: 'Germany' },
    { name: 'Vienna Zoo', city: 'Vienna', country: 'Austria' },
    { name: 'Toronto Zoo', city: 'Toronto', country: 'Canada' },
    { name: 'Australia Zoo', city: 'Beerwah', country: 'Australia' },
    { name: 'Taronga Zoo', city: 'Sydney', country: 'Australia' },
    { name: 'Beijing Zoo', city: 'Beijing', country: 'China' },
    { name: 'Ueno Zoo', city: 'Tokyo', country: 'Japan' },
    { name: 'Artis Zoo', city: 'Amsterdam', country: 'Netherlands' },
    { name: 'Prague Zoo', city: 'Prague', country: 'Czech Republic' },
  ];

  for (const zoo of popularZoos) {
    await createZoo(zoo);
  }
}
