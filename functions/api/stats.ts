// GET /api/stats - Get user's statistics

import { json } from '../lib/db';
import type { User } from '../lib/auth';

interface Env {
  DB: D1Database;
}

interface ContextData {
  user: User;
}

export const onRequestGet: PagesFunction<Env, string, ContextData> = async (context) => {
  const { env, data } = context;
  const userId = data.user.id;

  // Get total visits and unique zoos
  const visitsResult = await env.DB.prepare(
    'SELECT COUNT(*) as totalVisits, COUNT(DISTINCT zoo_id) as zoosVisited FROM visits WHERE user_id = ?'
  ).bind(userId).first<{ totalVisits: number; zoosVisited: number }>();

  // Get unique animals spotted
  const animalsResult = await env.DB.prepare(
    'SELECT COUNT(DISTINCT animal_id) as animalsSpotted FROM sightings WHERE user_id = ?'
  ).bind(userId).first<{ animalsSpotted: number }>();

  // Get total photos (sightings with photo_url)
  const photosResult = await env.DB.prepare(
    'SELECT COUNT(*) as totalPhotos FROM sightings WHERE user_id = ? AND photo_url IS NOT NULL'
  ).bind(userId).first<{ totalPhotos: number }>();

  // Get category breakdown
  const categoryResult = await env.DB.prepare(`
    SELECT a.category, COUNT(DISTINCT s.animal_id) as count
    FROM sightings s
    JOIN animals a ON s.animal_id = a.id
    WHERE s.user_id = ?
    GROUP BY a.category
    ORDER BY count DESC
  `).bind(userId).all<{ category: string; count: number }>();

  // Get recent sightings with animal info
  const recentResult = await env.DB.prepare(`
    SELECT
      s.id, s.seen_at as seenAt, s.photo_url as photoUrl,
      a.common_name as animalName, a.category,
      z.name as zooName
    FROM sightings s
    JOIN animals a ON s.animal_id = a.id
    JOIN visits v ON s.visit_id = v.id
    JOIN zoos z ON v.zoo_id = z.id
    WHERE s.user_id = ?
    ORDER BY s.seen_at DESC
    LIMIT 10
  `).bind(userId).all<{
    id: string;
    seenAt: string;
    photoUrl: string | null;
    animalName: string;
    category: string;
    zooName: string;
  }>();

  // Get zoo stats
  const zooStatsResult = await env.DB.prepare(`
    SELECT
      z.id, z.name,
      COUNT(DISTINCT v.id) as visitCount,
      COUNT(DISTINCT s.animal_id) as animalsSpotted,
      MAX(v.started_at) as lastVisit
    FROM zoos z
    JOIN visits v ON z.id = v.zoo_id AND v.user_id = ?
    LEFT JOIN sightings s ON v.id = s.visit_id
    GROUP BY z.id
    ORDER BY lastVisit DESC
  `).bind(userId).all<{
    id: string;
    name: string;
    visitCount: number;
    animalsSpotted: number;
    lastVisit: string;
  }>();

  return json({
    totalZoosVisited: visitsResult?.zoosVisited || 0,
    totalAnimalsSpotted: animalsResult?.animalsSpotted || 0,
    totalPhotos: photosResult?.totalPhotos || 0,
    totalVisits: visitsResult?.totalVisits || 0,
    categoryBreakdown: categoryResult.results || [],
    recentSightings: recentResult.results || [],
    zooStats: zooStatsResult.results || [],
  });
};
