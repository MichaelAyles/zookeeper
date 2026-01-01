// POST /api/auth/demo - Demo login (no Google required)

import { createJWT, setAuthCookie } from '../../lib/auth';
import { generateId } from '../../lib/db';

interface Env {
  JWT_SECRET: string;
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body = await request.json() as { name: string; email?: string };
    const name = body.name?.trim();

    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create a demo email from the name
    const email = body.email || `${name.toLowerCase().replace(/\s+/g, '.')}@demo.zookeeperapp.com`;
    const demoGoogleId = `demo_${name.toLowerCase().replace(/\s+/g, '_')}`;

    // Find or create user
    let user = await env.DB.prepare(
      'SELECT id, google_id, email, display_name, avatar_url FROM users WHERE google_id = ?'
    ).bind(demoGoogleId).first<{
      id: string;
      google_id: string;
      email: string;
      display_name: string;
      avatar_url: string | null;
    }>();

    if (!user) {
      const userId = generateId();
      await env.DB.prepare(
        'INSERT INTO users (id, google_id, email, display_name, avatar_url) VALUES (?, ?, ?, ?, ?)'
      ).bind(userId, demoGoogleId, email, name, null).run();

      user = {
        id: userId,
        google_id: demoGoogleId,
        email,
        display_name: name,
        avatar_url: null,
      };
    }

    // Use a fallback secret if JWT_SECRET not set
    const jwtSecret = env.JWT_SECRET || 'demo-secret-not-for-production';

    // Create JWT
    const token = await createJWT(
      { sub: user.id, email: user.email, name: user.display_name },
      jwtSecret
    );

    // Return success with auth cookie
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': setAuthCookie(token),
      },
    });
  } catch (err) {
    console.error('Demo auth error:', err);
    return new Response(JSON.stringify({ error: 'Login failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
