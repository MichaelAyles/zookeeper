// UK Zoo Scraper - Type Definitions

export type ZooSource = 'wikipedia' | 'biaza' | 'google';
export type AnimalCategory = 'Mammals' | 'Birds' | 'Reptiles' | 'Amphibians' | 'Fish' | 'Invertebrates';

export interface RawZoo {
  name: string;
  city?: string;
  county?: string;
  website?: string;
  source: ZooSource;
  wikiUrl?: string;
  latitude?: number;
  longitude?: number;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface Zoo {
  name: string;
  city?: string;
  county?: string;
  country: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  sources: ZooSource[];
  wikiUrl?: string;
}

export interface RawAnimal {
  common_name: string;
  scientific_name?: string;
  category: AnimalCategory;
  exhibit_area?: string;
  fun_facts?: string[];
}

export interface Animal {
  commonName: string;
  scientificName?: string;
  category: AnimalCategory;
  exhibitArea?: string;
  funFacts?: string[];
  confidence: number;
}

export interface ZooWithAnimals extends Zoo {
  animals: Animal[];
}

export interface ScraperOutput {
  generatedAt: string;
  stats: {
    totalZoos: number;
    totalAnimals: number;
    zoosBySource: Record<ZooSource, number>;
  };
  zoos: ZooWithAnimals[];
}

export interface ScraperOptions {
  dryRun?: boolean;
  source?: ZooSource;
  zooFilter?: string;
  outputFile?: string;
  limit?: number;
  skipAnimals?: boolean;
  verbose?: boolean;
}
