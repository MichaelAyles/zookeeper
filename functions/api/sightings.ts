// GET /api/sightings - Get user's sightings
// POST /api/sightings - Record a sighting

import { json, error, generateId, Sighting } from '../lib/db';
import type { User } from '../lib/auth';

interface Env {
  DB: D1Database;
}

interface ContextData {
  user: User;
}

export const onRequestGet: PagesFunction<Env, string, ContextData> = async (context) => {
  const { request, env, data } = context;
  const url = new URL(request.url);
  const visitId = url.searchParams.get('visitId');

  let query = 'SELECT * FROM sightings WHERE user_id = ?';
  const params: string[] = [data.user.id];

  if (visitId) {
    query += ' AND visit_id = ?';
    params.push(visitId);
  }

  query += ' ORDER BY seen_at DESC';

  const result = await env.DB.prepare(query).bind(...params).all<Sighting>();

  const sightings = (result.results || []).map((s) => ({
    id: s.id,
    visitId: s.visit_id,
    animalId: s.animal_id,
    seenAt: s.seen_at,
    photoUrl: s.photo_url,
    aiIdentified: s.ai_identified === 1,
    aiConfidence: s.ai_confidence,
    notes: s.notes,
  }));

  return json(sightings);
};

export const onRequestPost: PagesFunction<Env, string, ContextData> = async (context) => {
  const { request, env, data } = context;

  try {
    const body = await request.json<{
      visitId: string;
      animalId: string;
      photoUrl?: string;
      aiIdentified?: boolean;
      aiConfidence?: number;
      notes?: string;
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

    // Check if sighting already exists for this animal in this visit
    const existing = await env.DB.prepare(
      'SELECT id FROM sightings WHERE visit_id = ? AND animal_id = ? AND user_id = ?'
    ).bind(body.visitId, body.animalId, data.user.id).first<{ id: string }>();

    if (existing) {
      // Update existing sighting
      await env.DB.prepare(
        `UPDATE sightings SET
         photo_url = COALESCE(?, photo_url),
         ai_identified = COALESCE(?, ai_identified),
         ai_confidence = COALESCE(?, ai_confidence),
         notes = COALESCE(?, notes)
         WHERE id = ?`
      ).bind(
        body.photoUrl || null,
        body.aiIdentified ? 1 : null,
        body.aiConfidence || null,
        body.notes || null,
        existing.id
      ).run();

      const updated = await env.DB.prepare(
        'SELECT * FROM sightings WHERE id = ?'
      ).bind(existing.id).first<Sighting>();

      return json({
        id: updated!.id,
        visitId: updated!.visit_id,
        animalId: updated!.animal_id,
        seenAt: updated!.seen_at,
        photoUrl: updated!.photo_url,
        aiIdentified: updated!.ai_identified === 1,
        aiConfidence: updated!.ai_confidence,
        notes: updated!.notes,
      });
    }

    // Create new sighting
    const id = generateId();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO sightings (id, user_id, visit_id, animal_id, seen_at, photo_url, ai_identified, ai_confidence, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      data.user.id,
      body.visitId,
      body.animalId,
      now,
      body.photoUrl || null,
      body.aiIdentified ? 1 : 0,
      body.aiConfidence || null,
      body.notes || null
    ).run();

    return json({
      id,
      visitId: body.visitId,
      animalId: body.animalId,
      seenAt: now,
      photoUrl: body.photoUrl || null,
      aiIdentified: body.aiIdentified || false,
      aiConfidence: body.aiConfidence || null,
      notes: body.notes || null,
    }, 201);
  } catch (err) {
    console.error('Create sighting error:', err);
    return error('Failed to create sighting', 500);
  }
};

export const onRequestDelete: PagesFunction<Env, string, ContextData> = async (context) => {
  const { request, env, data } = context;
  const url = new URL(request.url);
  const sightingId = url.searchParams.get('id');

  if (!sightingId) {
    return error('Sighting id is required', 400);
  }

  // Verify sighting belongs to user
  const sighting = await env.DB.prepare(
    'SELECT id FROM sightings WHERE id = ? AND user_id = ?'
  ).bind(sightingId, data.user.id).first();

  if (!sighting) {
    return error('Sighting not found', 404);
  }

  await env.DB.prepare('DELETE FROM sightings WHERE id = ?').bind(sightingId).run();

  return json({ success: true });
};
