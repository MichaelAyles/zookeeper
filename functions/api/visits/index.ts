// GET /api/visits - Get user's visits
// POST /api/visits - Start a new visit

import { json, error, generateId, Visit } from '../../lib/db';
import type { User } from '../../lib/auth';

interface Env {
  DB: D1Database;
}

interface ContextData {
  user: User;
}

export const onRequestGet: PagesFunction<Env, string, ContextData> = async (context) => {
  const { env, data } = context;

  const result = await env.DB.prepare(
    'SELECT * FROM visits WHERE user_id = ? ORDER BY started_at DESC'
  ).bind(data.user.id).all<Visit>();

  const visits = (result.results || []).map((visit) => ({
    id: visit.id,
    zooId: visit.zoo_id,
    startedAt: visit.started_at,
    endedAt: visit.ended_at,
    notes: visit.notes,
  }));

  return json(visits);
};

export const onRequestPost: PagesFunction<Env, string, ContextData> = async (context) => {
  const { request, env, data } = context;

  try {
    const body = await request.json<{ zooId: string }>();

    if (!body.zooId) {
      return error('zooId is required', 400);
    }

    // Verify zoo exists
    const zoo = await env.DB.prepare('SELECT id FROM zoos WHERE id = ?').bind(body.zooId).first();
    if (!zoo) {
      return error('Zoo not found', 404);
    }

    // End any active visits for this user
    await env.DB.prepare(
      'UPDATE visits SET ended_at = ? WHERE user_id = ? AND ended_at IS NULL'
    ).bind(new Date().toISOString(), data.user.id).run();

    // Create new visit
    const id = generateId();
    const now = new Date().toISOString();

    await env.DB.prepare(
      'INSERT INTO visits (id, user_id, zoo_id, started_at) VALUES (?, ?, ?, ?)'
    ).bind(id, data.user.id, body.zooId, now).run();

    return json({
      id,
      zooId: body.zooId,
      startedAt: now,
      endedAt: null,
      notes: null,
    }, 201);
  } catch (err) {
    console.error('Create visit error:', err);
    return error('Failed to create visit', 500);
  }
};
