// GET /api/zoos/:id/animals - Get animals for a zoo
// POST /api/zoos/:id/animals - Add animal to zoo (for AI generation)

import { json, error, generateId, Animal, Zoo } from '../../../lib/db';
import type { User } from '../../../lib/auth';

interface Env {
  DB: D1Database;
}

interface ContextData {
  user: User;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const zooId = params.id as string;

  // Verify zoo exists
  const zoo = await env.DB.prepare('SELECT id FROM zoos WHERE id = ?').bind(zooId).first();
  if (!zoo) {
    return error('Zoo not found', 404);
  }

  const result = await env.DB.prepare(
    'SELECT * FROM animals WHERE zoo_id = ? ORDER BY category, common_name'
  ).bind(zooId).all<Animal>();

  const animals = (result.results || []).map((animal) => ({
    id: animal.id,
    zooId: animal.zoo_id,
    commonName: animal.common_name,
    scientificName: animal.scientific_name,
    category: animal.category,
    exhibitArea: animal.exhibit_area,
    funFact: animal.fun_fact,
    imageUrl: animal.image_url,
    createdAt: animal.created_at,
  }));

  return json(animals);
};

export const onRequestPost: PagesFunction<Env, string, ContextData> = async (context) => {
  const { request, env, params } = context;
  const zooId = params.id as string;

  try {
    // Verify zoo exists
    const zoo = await env.DB.prepare('SELECT id FROM zoos WHERE id = ?').bind(zooId).first();
    if (!zoo) {
      return error('Zoo not found', 404);
    }

    const body = await request.json<{
      commonName: string;
      scientificName?: string;
      category: string;
      exhibitArea?: string;
      funFact?: string;
      imageUrl?: string;
    }>();

    if (!body.commonName || !body.category) {
      return error('commonName and category are required', 400);
    }

    const id = generateId();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO animals (id, zoo_id, common_name, scientific_name, category, exhibit_area, fun_fact, image_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      zooId,
      body.commonName,
      body.scientificName || null,
      body.category,
      body.exhibitArea || null,
      body.funFact || null,
      body.imageUrl || null,
      now
    ).run();

    return json({
      id,
      zooId,
      commonName: body.commonName,
      scientificName: body.scientificName || null,
      category: body.category,
      exhibitArea: body.exhibitArea || null,
      funFact: body.funFact || null,
      imageUrl: body.imageUrl || null,
      createdAt: now,
    }, 201);
  } catch (err) {
    console.error('Create animal error:', err);
    return error('Failed to create animal', 500);
  }
};

// POST /api/zoos/:id/animals/generate - Bulk add animals (called after AI generation)
// This is handled by separate endpoint or batch insert
