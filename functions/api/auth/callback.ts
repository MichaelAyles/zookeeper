// GET /api/auth/callback - Handle Google OAuth callback

import { createJWT, setAuthCookie } from '../../lib/auth';
import { generateId } from '../../lib/db';

interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  JWT_SECRET: string;
  DB: D1Database;
}

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return Response.redirect('/?error=auth_denied', 302);
  }

  if (!code) {
    return Response.redirect('/?error=no_code', 302);
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text());
      return Response.redirect('/?error=token_exchange', 302);
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      return Response.redirect('/?error=user_info', 302);
    }

    const googleUser: GoogleUserInfo = await userInfoResponse.json();

    // Find or create user in database
    let user = await env.DB.prepare(
      'SELECT id, google_id, email, display_name, avatar_url FROM users WHERE google_id = ?'
    ).bind(googleUser.sub).first<{
      id: string;
      google_id: string;
      email: string;
      display_name: string;
      avatar_url: string | null;
    }>();

    if (!user) {
      // Create new user
      const userId = generateId();
      await env.DB.prepare(
        'INSERT INTO users (id, google_id, email, display_name, avatar_url) VALUES (?, ?, ?, ?, ?)'
      ).bind(userId, googleUser.sub, googleUser.email, googleUser.name, googleUser.picture).run();

      user = {
        id: userId,
        google_id: googleUser.sub,
        email: googleUser.email,
        display_name: googleUser.name,
        avatar_url: googleUser.picture,
      };
    } else {
      // Update existing user's info (name/avatar might change)
      await env.DB.prepare(
        'UPDATE users SET email = ?, display_name = ?, avatar_url = ? WHERE id = ?'
      ).bind(googleUser.email, googleUser.name, googleUser.picture, user.id).run();
    }

    // Create JWT
    const token = await createJWT(
      { sub: user.id, email: user.email, name: user.display_name },
      env.JWT_SECRET
    );

    // Redirect to home with auth cookie
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
        'Set-Cookie': setAuthCookie(token),
      },
    });
  } catch (err) {
    console.error('Auth callback error:', err);
    return Response.redirect('/?error=server_error', 302);
  }
};
