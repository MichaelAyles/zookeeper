// ============================================
// Core Types
// ============================================

export interface Zoo {
  id: string;
  name: string;
  city?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  websiteUrl?: string;
  animalsGeneratedAt?: Date;
  createdAt: Date;
}

export interface ZooAnimal {
  id: string;
  zooId: string;
  commonName: string;
  scientificName?: string;
  category: AnimalCategory;
  exhibitArea?: string;
  funFact?: string;
  imageUrl?: string;
  createdAt: Date;
}

export type AnimalCategory =
  | 'Mammals'
  | 'Birds'
  | 'Reptiles'
  | 'Amphibians'
  | 'Fish'
  | 'Invertebrates';

export interface Visit {
  id: string;
  zooId: string;
  startedAt: Date;
  endedAt?: Date;
  notes?: string;
}

export interface Sighting {
  id: string;
  visitId: string;
  animalId: string;
  seenAt: Date;
  photoUrl?: string;
  photoBase64?: string;
  aiIdentified: boolean;
  aiConfidence?: number;
  notes?: string;
}

// ============================================
// UI State Types
// ============================================

export interface ChecklistItem extends ZooAnimal {
  seen: boolean;
  sighting?: Sighting;
}

export interface VisitProgress {
  total: number;
  seen: number;
  percentage: number;
}

export interface UserStats {
  totalZoosVisited: number;
  totalAnimalsSpotted: number;
  totalPhotos: number;
  totalVisits: number;
}

export interface CategoryStats {
  category: AnimalCategory;
  count: number;
  icon: string;
}

// ============================================
// API Types
// ============================================

export interface GeneratedAnimal {
  common_name: string;
  scientific_name?: string;
  category: AnimalCategory;
  exhibit_area?: string;
  fun_fact?: string;
}

export interface IdentificationResult {
  animal: string | null;
  confidence: number;
  funFact?: string;
}

// ============================================
// Store Types
// ============================================

export interface UserProfile {
  id: string;
  displayName: string;
  createdAt: Date;
}
