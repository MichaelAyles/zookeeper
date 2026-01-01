// D1 Database helpers

export function generateId(): string {
  return crypto.randomUUID();
}

// Haversine formula for distance between two coordinates (in km)
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Type definitions for D1 results
export interface Zoo {
  id: string;
  name: string;
  city: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  website_url: string | null;
  animals_generated_at: string | null;
  created_at: string;
  created_by_user_id: string | null;
}

export interface Animal {
  id: string;
  zoo_id: string;
  common_name: string;
  scientific_name: string | null;
  category: string;
  exhibit_area: string | null;
  fun_fact: string | null;
  image_url: string | null;
  created_at: string;
}

export interface Visit {
  id: string;
  user_id: string;
  zoo_id: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
}

export interface Sighting {
  id: string;
  user_id: string;
  visit_id: string;
  animal_id: string;
  seen_at: string;
  photo_url: string | null;
  ai_identified: number;
  ai_confidence: number | null;
  notes: string | null;
}

// JSON response helpers
export function json<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}
