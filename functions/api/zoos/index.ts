// GET /api/zoos - List all zoos (ordered by proximity + visited)
// POST /api/zoos - Add a new zoo

import { json, error, generateId, haversineDistance, Zoo } from '../../lib/db';
import type { User } from '../../lib/auth';

interface Env {
  DB: D1Database;
}

interface ContextData {
  user: User;
}

export const onRequestGet: PagesFunction<Env, string, ContextData> = async (context) => {
  const { request, env, data } = context;
  const url = new URL(request.url);
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');
  const userLat = lat ? parseFloat(lat) : null;
  const userLon = lon ? parseFloat(lon) : null;

  // Get user's visited zoo IDs
  const visitedResult = await env.DB.prepare(
    'SELECT DISTINCT zoo_id FROM visits WHERE user_id = ?'
  ).bind(data.user.id).all<{ zoo_id: string }>();
  const visitedIds = new Set(visitedResult.results?.map((r) => r.zoo_id) || []);

  // Get all zoos
  const zoosResult = await env.DB.prepare('SELECT * FROM zoos').all<Zoo>();
  const zoos = zoosResult.results || [];

  // Sort: nearby (top 3 within 100km) → visited → rest alphabetical
  const sortedZoos = zoos.sort((a, b) => {
    let aDistance = Infinity;
    let bDistance = Infinity;

    if (userLat !== null && userLon !== null && a.latitude && a.longitude) {
      aDistance = haversineDistance(userLat, userLon, a.latitude, a.longitude);
    }
    if (userLat !== null && userLon !== null && b.latitude && b.longitude) {
      bDistance = haversineDistance(userLat, userLon, b.latitude, b.longitude);
    }

    const aVisited = visitedIds.has(a.id);
    const bVisited = visitedIds.has(b.id);
    const aNearby = aDistance < 100;
    const bNearby = bDistance < 100;

    // 1. Nearby zoos first (sorted by distance)
    if (aNearby && !bNearby) return -1;
    if (bNearby && !aNearby) return 1;
    if (aNearby && bNearby) return aDistance - bDistance;

    // 2. Then visited zoos
    if (aVisited && !bVisited) return -1;
    if (bVisited && !aVisited) return 1;

    // 3. Then alphabetical
    return a.name.localeCompare(b.name);
  });

  // Transform to camelCase for frontend
  const response = sortedZoos.map((zoo) => ({
    id: zoo.id,
    name: zoo.name,
    city: zoo.city,
    country: zoo.country,
    latitude: zoo.latitude,
    longitude: zoo.longitude,
    websiteUrl: zoo.website_url,
    animalsGeneratedAt: zoo.animals_generated_at,
    createdAt: zoo.created_at,
    isVisited: visitedIds.has(zoo.id),
  }));

  return json(response);
};

export const onRequestPost: PagesFunction<Env, string, ContextData> = async (context) => {
  const { request, env, data } = context;

  try {
    const body = await request.json<{
      name: string;
      city?: string;
      country: string;
      latitude?: number;
      longitude?: number;
      websiteUrl?: string;
    }>();

    if (!body.name || !body.country) {
      return error('Name and country are required', 400);
    }

    const id = generateId();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO zoos (id, name, city, country, latitude, longitude, website_url, created_at, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      body.name,
      body.city || null,
      body.country,
      body.latitude || null,
      body.longitude || null,
      body.websiteUrl || null,
      now,
      data.user.id
    ).run();

    return json({
      id,
      name: body.name,
      city: body.city || null,
      country: body.country,
      latitude: body.latitude || null,
      longitude: body.longitude || null,
      websiteUrl: body.websiteUrl || null,
      animalsGeneratedAt: null,
      createdAt: now,
    }, 201);
  } catch (err) {
    console.error('Create zoo error:', err);
    return error('Failed to create zoo', 500);
  }
};
