// GET /api/auth/google - Redirect to Google OAuth

interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_REDIRECT_URI: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  // Generate CSRF state token
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  // Set state in a secure cookie for validation in callback
  return new Response(null, {
    status: 302,
    headers: {
      Location: googleAuthUrl,
      'Set-Cookie': `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
};
