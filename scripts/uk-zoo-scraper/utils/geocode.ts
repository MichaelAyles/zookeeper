// Geocoding Utility
// Uses OpenStreetMap Nominatim to get lat/lng for zoos

import type { Zoo, GeoLocation } from '../types';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// Rate limiting - Nominatim requires max 1 request per second
let lastRequestTime = 0;
const MIN_DELAY_MS = 1100; // Slightly more than 1 second to be safe

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;

  if (elapsed < MIN_DELAY_MS) {
    await sleep(MIN_DELAY_MS - elapsed);
  }

  lastRequestTime = Date.now();

  return fetch(url, {
    headers: {
      'User-Agent': 'ZookeeperApp/1.0 (https://zookeeperapp.com; contact@zookeeperapp.com)',
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Extract location hint from zoo name (e.g., "Mablethorpe Seal Sanctuary" → "Mablethorpe")
function extractLocationFromName(name: string): string | null {
  // Keywords that indicate the preceding text is likely a place name
  // Order matters - longer/more specific patterns first
  const keywords = [
    'Seal Sanctuary and Wildlife Centre', 'Wild Animal Park', 'Safari and Adventure Park',
    'Wildlife Conservation Park', 'Wildlife Park', 'Wildlife Centre', 'Wildlife Center',
    'Safari Park', 'Animal Park', 'Bird Park', 'Nature Reserve',
    'Seal Sanctuary', 'Wildlife Sanctuary', 'Sea Life', 'Aquarium', 'Zoo',
  ];

  for (const keyword of keywords) {
    const pattern = new RegExp(`^(.+?)\\s+${keyword}`, 'i');
    const match = name.match(pattern);
    if (match && match[1]) {
      const location = match[1].trim();
      // Only return if it looks like a real place name
      if (location.length > 3 &&
          !['The', 'Wild', 'National', 'International', 'Royal', 'Manor House'].includes(location)) {
        return location;
      }
    }
  }

  return null;
}

// Simplify zoo names to improve geocoding matches
function simplifyZooName(name: string): string {
  return name
    // Remove common prefixes
    .replace(/^RZSS\s*[-–]\s*/i, '')
    .replace(/^ZSL\s*/i, '')
    .replace(/^Wild Planet Trust\s*[-–]\s*/i, '')
    .replace(/^WWT\s*/i, '')
    .replace(/^SEA LIFE\s*(Centre)?\s*/i, 'Sea Life ')
    // Remove common suffixes
    .replace(/\s*[-–]\s*National Zoological Society of Wales$/i, '')
    .replace(/\s*Zoological (Society|Gardens?|Park|Reserve)$/i, ' Zoo')
    .replace(/\s*Wildlife (Conservation )?Trust$/i, '')
    .replace(/\s*Conservation Park$/i, '')
    .replace(/\s*\(.*?\)$/i, '') // Remove parenthetical notes
    .replace(/\s*(Centre|Center)$/i, '')
    // Clean up
    .replace(/\s+/g, ' ')
    .trim();
}

export async function geocodeZoo(zoo: Zoo, verbose = false): Promise<GeoLocation | null> {
  // Simplify zoo name for better geocoding matches
  const simplifiedName = simplifyZooName(zoo.name);

  // Try to extract location from zoo name (e.g., "Mablethorpe Seal Sanctuary" → "Mablethorpe")
  const extractedLocation = extractLocationFromName(zoo.name);

  // Build search queries - try multiple variations
  const queries = [
    // Most specific: full name + city + UK
    zoo.city ? `${zoo.name}, ${zoo.city}, United Kingdom` : null,
    // Simplified name + city
    zoo.city && simplifiedName !== zoo.name ? `${simplifiedName}, ${zoo.city}, United Kingdom` : null,
    // Full name + county
    zoo.county ? `${zoo.name}, ${zoo.county}, United Kingdom` : null,
    // Simplified name + county
    zoo.county && simplifiedName !== zoo.name ? `${simplifiedName}, ${zoo.county}, United Kingdom` : null,
    // Just simplified name + UK
    `${simplifiedName}, United Kingdom`,
    // Just full name + UK
    simplifiedName !== zoo.name ? `${zoo.name}, United Kingdom` : null,
    // Try with "Zoo" appended if not already there
    !zoo.name.toLowerCase().includes('zoo') ? `${simplifiedName} Zoo, United Kingdom` : null,
    // Try location extracted from name
    extractedLocation ? `${extractedLocation}, United Kingdom` : null,
    // Last resort: just the city/county (zoos are big, being in the right area is fine)
    zoo.city ? `${zoo.city}, United Kingdom` : null,
    zoo.county ? `${zoo.county}, United Kingdom` : null,
  ].filter(Boolean) as string[];

  for (const query of queries) {
    try {
      const url = new URL(NOMINATIM_URL);
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '1');
      url.searchParams.set('countrycodes', 'gb'); // Restrict to Great Britain

      const response = await rateLimitedFetch(url.toString());

      if (!response.ok) {
        if (verbose) console.log(`   ⚠️  Nominatim error for "${zoo.name}": ${response.status}`);
        continue;
      }

      const results = await response.json() as Array<{
        lat: string;
        lon: string;
        display_name: string;
        importance: number;
      }>;

      if (results.length > 0) {
        const result = results[0];
        return {
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          address: result.display_name,
        };
      }
    } catch (err) {
      if (verbose) console.log(`   ⚠️  Geocode error for "${zoo.name}":`, err);
    }
  }

  return null;
}

export async function geocodeAllZoos(
  zoos: Zoo[],
  verbose = false
): Promise<Map<string, GeoLocation>> {
  if (verbose) console.log(`📍 Geocoding ${zoos.length} zoos (this will take ~${Math.ceil(zoos.length * 1.1 / 60)} minutes)...`);

  const locations = new Map<string, GeoLocation>();
  let found = 0;
  let failed = 0;

  for (let i = 0; i < zoos.length; i++) {
    const zoo = zoos[i];

    if (verbose && i % 10 === 0) {
      console.log(`   Progress: ${i}/${zoos.length} (${found} found, ${failed} failed)`);
    }

    const location = await geocodeZoo(zoo, false);

    if (location) {
      locations.set(zoo.name, location);
      found++;
    } else {
      failed++;
      if (verbose) console.log(`   ⚠️  Could not geocode: ${zoo.name}`);
    }
  }

  if (verbose) {
    console.log(`   ✅ Geocoded ${found}/${zoos.length} zoos (${failed} failed)`);
  }

  return locations;
}

// Apply geocoding results to zoos
export function applyGeocodingToZoos(
  zoos: Zoo[],
  locations: Map<string, GeoLocation>
): Zoo[] {
  return zoos.map(zoo => {
    const location = locations.get(zoo.name);
    if (location) {
      return {
        ...zoo,
        latitude: location.latitude,
        longitude: location.longitude,
      };
    }
    return zoo;
  });
}

