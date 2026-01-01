// GET /api/visits/active - Get user's active visit (if any)

import { json, Visit } from '../../lib/db';
import type { User } from '../../lib/auth';

interface Env {
  DB: D1Database;
}

interface ContextData {
  user: User;
}

export const onRequestGet: PagesFunction<Env, string, ContextData> = async (context) => {
  const { env, data } = context;

  const visit = await env.DB.prepare(
    'SELECT * FROM visits WHERE user_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1'
  ).bind(data.user.id).first<Visit>();

  if (!visit) {
    return json(null);
  }

  return json({
    id: visit.id,
    zooId: visit.zoo_id,
    startedAt: visit.started_at,
    endedAt: visit.ended_at,
    notes: visit.notes,
  });
};
