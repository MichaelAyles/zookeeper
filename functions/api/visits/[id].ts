// GET /api/visits/:id - Get a single visit
// PATCH /api/visits/:id - Update visit (end it, add notes)

import { json, error, Visit } from '../../lib/db';
import type { User } from '../../lib/auth';

interface Env {
  DB: D1Database;
}

interface ContextData {
  user: User;
}

export const onRequestGet: PagesFunction<Env, string, ContextData> = async (context) => {
  const { env, params, data } = context;
  const visitId = params.id as string;

  const visit = await env.DB.prepare(
    'SELECT * FROM visits WHERE id = ? AND user_id = ?'
  ).bind(visitId, data.user.id).first<Visit>();

  if (!visit) {
    return error('Visit not found', 404);
  }

  return json({
    id: visit.id,
    zooId: visit.zoo_id,
    startedAt: visit.started_at,
    endedAt: visit.ended_at,
    notes: visit.notes,
  });
};

export const onRequestPatch: PagesFunction<Env, string, ContextData> = async (context) => {
  const { request, env, params, data } = context;
  const visitId = params.id as string;

  try {
    // Verify visit exists and belongs to user
    const visit = await env.DB.prepare(
      'SELECT * FROM visits WHERE id = ? AND user_id = ?'
    ).bind(visitId, data.user.id).first<Visit>();

    if (!visit) {
      return error('Visit not found', 404);
    }

    const body = await request.json<{
      endedAt?: string;
      notes?: string;
    }>();

    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (body.endedAt !== undefined) {
      updates.push('ended_at = ?');
      values.push(body.endedAt || new Date().toISOString());
    }

    if (body.notes !== undefined) {
      updates.push('notes = ?');
      values.push(body.notes);
    }

    if (updates.length === 0) {
      return error('No updates provided', 400);
    }

    values.push(visitId, data.user.id);

    await env.DB.prepare(
      `UPDATE visits SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
    ).bind(...values).run();

    // Fetch updated visit
    const updated = await env.DB.prepare(
      'SELECT * FROM visits WHERE id = ?'
    ).bind(visitId).first<Visit>();

    return json({
      id: updated!.id,
      zooId: updated!.zoo_id,
      startedAt: updated!.started_at,
      endedAt: updated!.ended_at,
      notes: updated!.notes,
    });
  } catch (err) {
    console.error('Update visit error:', err);
    return error('Failed to update visit', 500);
  }
};
