import Dexie, { type Table } from 'dexie';
import type { Zoo, ZooAnimal, Visit, Sighting, UserProfile } from '../types';

class ZookeeperDB extends Dexie {
  zoos!: Table<Zoo>;
  animals!: Table<ZooAnimal>;
  visits!: Table<Visit>;
  sightings!: Table<Sighting>;
  profile!: Table<UserProfile>;

  constructor() {
    super('zookeeper');

    this.version(1).stores({
      zoos: 'id, name, country',
      animals: 'id, zooId, category, commonName',
      visits: 'id, zooId, startedAt',
      sightings: 'id, visitId, animalId, seenAt',
      profile: 'id',
    });
  }
}

export const db = new ZookeeperDB();

// Helper to generate IDs
export function generateId(): string {
  return crypto.randomUUID();
}
