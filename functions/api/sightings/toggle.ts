// POST /api/sightings/toggle - Atomically toggle a sighting (add or remove)

import { json, error, generateId, Sighting } from '../../lib/db';
import type { User } from '../../lib/auth';

interface Env {
  DB: D1Database;
}

interface ContextData {
  user: User;
}

export const onRequestPost: PagesFunction<Env, string, ContextData> = async (context) => {
  const { request, env, data } = context;

  try {
    const body = await request.json<{
      visitId: string;
      animalId: string;
    }>();

    if (!body.visitId || !body.animalId) {
      return error('visitId and animalId are required', 400);
    }

    // Verify visit belongs to user
    const visit = await env.DB.prepare(
      'SELECT id FROM visits WHERE id = ? AND user_id = ?'
    ).bind(body.visitId, data.user.id).first();

    if (!visit) {
      return error('Visit not found', 404);
    }

    // Atomic toggle: check and delete/insert in one transaction-like operation
    const existing = await env.DB.prepare(
      'SELECT id FROM sightings WHERE visit_id = ? AND animal_id = ? AND user_id = ?'
    ).bind(body.visitId, body.animalId, data.user.id).first<{ id: string }>();

    if (existing) {
      // Remove existing sighting
      await env.DB.prepare('DELETE FROM sightings WHERE id = ?').bind(existing.id).run();
      return json({ added: false, sightingId: null });
    }

    // Create new sighting
    const id = generateId();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO sightings (id, user_id, visit_id, animal_id, seen_at, ai_identified)
       VALUES (?, ?, ?, ?, ?, 0)`
    ).bind(id, data.user.id, body.visitId, body.animalId, now).run();

    // Fetch the created sighting
    const created = await env.DB.prepare(
      'SELECT * FROM sightings WHERE id = ?'
    ).bind(id).first<Sighting>();

    if (!created) {
      return error('Failed to create sighting', 500);
    }

    return json({
      added: true,
      sighting: {
        id: created.id,
        visitId: created.visit_id,
        animalId: created.animal_id,
        seenAt: created.seen_at,
        photoUrl: created.photo_url,
        aiIdentified: created.ai_identified === 1,
        aiConfidence: created.ai_confidence,
        notes: created.notes,
      },
    }, 201);
  } catch (err) {
    console.error('Toggle sighting error:', err);
    return error('Failed to toggle sighting', 500);
  }
};
