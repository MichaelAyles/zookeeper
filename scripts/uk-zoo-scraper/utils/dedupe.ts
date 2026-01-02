// Zoo Deduplication Utility
// Merges zoos from multiple sources, removing duplicates

import type { RawZoo, Zoo, ZooSource } from '../types';

export function dedupeZoos(rawZoos: RawZoo[], verbose = false): Zoo[] {
  if (verbose) console.log(`🔄 Deduplicating ${rawZoos.length} raw zoo entries...`);

  const zooMap = new Map<string, Zoo>();

  for (const raw of rawZoos) {
    const key = normalizeZooName(raw.name);

    if (zooMap.has(key)) {
      // Merge with existing entry
      const existing = zooMap.get(key)!;
      mergeZoo(existing, raw);
    } else {
      // Check for similar names
      const similarKey = findSimilarZoo(key, Array.from(zooMap.keys()));

      if (similarKey) {
        const existing = zooMap.get(similarKey)!;
        mergeZoo(existing, raw);
      } else {
        // New zoo
        zooMap.set(key, {
          name: raw.name,
          city: raw.city,
          county: raw.county,
          country: 'United Kingdom',
          website: raw.website,
          sources: [raw.source],
          wikiUrl: raw.wikiUrl,
          latitude: raw.latitude,
          longitude: raw.longitude,
        });
      }
    }
  }

  const deduped = Array.from(zooMap.values());

  if (verbose) {
    console.log(`   Reduced to ${deduped.length} unique zoos`);
    const bySources = countBySources(deduped);
    console.log(`   Sources: ${Object.entries(bySources).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
  }

  return deduped;
}

function normalizeZooName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ')
    // Remove common suffixes
    .replace(/\s*zoo$/i, '')
    .replace(/\s*safari\s*park$/i, '')
    .replace(/\s*wildlife\s*park$/i, '')
    .replace(/\s*animal\s*park$/i, '')
    .replace(/\s*aquarium$/i, '')
    .replace(/\s*sea\s*life\s*centre?$/i, '')
    // Remove common words that vary between sources
    .replace(/\s*house\s*/i, ' ') // "Manor House" -> "Manor"
    .replace(/\s*wild\s*/i, ' ')  // "Wild Animal Park" -> "Animal Park"
    // Remove common prefixes
    .replace(/^the\s+/i, '')
    .replace(/^zsl\s+/i, '') // ZSL London Zoo -> London
    // Clean up
    .replace(/\s+/g, ' ')
    .trim();
}

function findSimilarZoo(key: string, existingKeys: string[]): string | null {
  for (const existing of existingKeys) {
    // Check for exact match first
    if (key === existing) {
      return existing;
    }

    // Check if one contains the other, but only if the shorter one is substantial
    // This prevents "manor" matching "drayton manor"
    const shorter = key.length < existing.length ? key : existing;
    const longer = key.length < existing.length ? existing : key;
    if (longer.includes(shorter) && shorter.length >= 8) {
      return existing;
    }

    // Check Levenshtein distance for short strings
    if (key.length < 15 && existing.length < 15) {
      const distance = levenshteinDistance(key, existing);
      if (distance <= 2) {
        return existing;
      }
    }

    // Check if first word matches (e.g., "Chester Zoo" and "Chester")
    const keyFirst = key.split(' ')[0];
    const existingFirst = existing.split(' ')[0];
    if (keyFirst === existingFirst && keyFirst.length > 4) {
      return existing;
    }
  }

  return null;
}

function mergeZoo(existing: Zoo, raw: RawZoo): void {
  // Merge sources
  if (!existing.sources.includes(raw.source)) {
    existing.sources.push(raw.source);
  }

  // Prefer more complete data
  if (!existing.city && raw.city) {
    existing.city = raw.city;
  }
  if (!existing.county && raw.county) {
    existing.county = raw.county;
  }
  if (!existing.website && raw.website) {
    existing.website = raw.website;
  }
  if (!existing.wikiUrl && raw.wikiUrl) {
    existing.wikiUrl = raw.wikiUrl;
  }

  // Preserve coordinates from scraped sources (e.g., BIAZA has embedded map coords)
  if (!existing.latitude && raw.latitude) {
    existing.latitude = raw.latitude;
  }
  if (!existing.longitude && raw.longitude) {
    existing.longitude = raw.longitude;
  }

  // Prefer longer/better name
  if (raw.name.length > existing.name.length) {
    existing.name = raw.name;
  }
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function countBySources(zoos: Zoo[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const zoo of zoos) {
    for (const source of zoo.sources) {
      counts[source] = (counts[source] || 0) + 1;
    }
  }

  return counts;
}

// Sort zoos by quality (more sources = better, alphabetical within)
export function sortZoosByQuality(zoos: Zoo[]): Zoo[] {
  return [...zoos].sort((a, b) => {
    // More sources first
    if (b.sources.length !== a.sources.length) {
      return b.sources.length - a.sources.length;
    }
    // Prefer zoos with websites
    if (a.website && !b.website) return -1;
    if (!a.website && b.website) return 1;
    // Alphabetical
    return a.name.localeCompare(b.name);
  });
}
