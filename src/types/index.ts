// ============================================
// Core Types
// ============================================

export interface Zoo {
  id: string;
  name: string;
  city?: string | null;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  websiteUrl?: string | null;
  animalsGeneratedAt?: string | null;
  createdAt: string;
  isVisited?: boolean; // Added by API
}

export interface ZooAnimal {
  id: string;
  zooId: string;
  commonName: string;
  scientificName?: string | null;
  category: AnimalCategory;
  exhibitArea?: string | null;
  funFact?: string | null;
  imageUrl?: string | null;
  createdAt: string;
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
  startedAt: string;
  endedAt?: string | null;
  notes?: string | null;
}

export interface Sighting {
  id: string;
  visitId: string;
  animalId: string;
  seenAt: string;
  photoUrl?: string | null;
  aiIdentified: boolean;
  aiConfidence?: number | null;
  notes?: string | null;
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
  categoryBreakdown?: { category: string; count: number }[];
  recentSightings?: {
    id: string;
    seenAt: string;
    photoUrl: string | null;
    animalName: string;
    category: string;
    zooName: string;
  }[];
  zooStats?: {
    id: string;
    name: string;
    visitCount: number;
    animalsSpotted: number;
    lastVisit: string;
  }[];
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
  failMessage?: string;
  failEmoji?: string;
}

// ============================================
// Auth Types
// ============================================

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  createdAt: string;
  isAdmin?: boolean;
}

// Legacy type - now aliases to User
export interface UserProfile {
  id: string;
  displayName: string;
  createdAt: string;
}
