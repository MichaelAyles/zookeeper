// Auth middleware for /api/* routes (except /api/auth/*)

import { getCurrentUser, User } from '../lib/auth';

interface Env {
  JWT_SECRET: string;
  DB: D1Database;
}

// Extend the context with user
declare module '@cloudflare/workers-types' {
  interface EventContext<Env, P, Data> {
    data: Data & { user?: User };
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // Skip auth for auth endpoints
  if (url.pathname.startsWith('/api/auth/')) {
    return next();
  }

  // Check authentication for all other /api/* routes
  const user = await getCurrentUser(request, env);

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Attach user to context data for downstream handlers
  context.data = { ...context.data, user };

  return next();
};
