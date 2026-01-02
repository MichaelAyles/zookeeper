// GET /api/auth/me - Get current user

import { getCurrentUser } from '../../lib/auth';
import { json, error } from '../../lib/db';

interface Env {
  JWT_SECRET: string;
  DB: D1Database;
  ADMIN_EMAILS?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const user = await getCurrentUser(request, env);

  if (!user) {
    return error('Not authenticated', 401);
  }

  // Check if user is admin
  const adminEmails = (env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
  const isAdmin = adminEmails.includes(user.email.toLowerCase());

  return json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    isAdmin,
  });
};
