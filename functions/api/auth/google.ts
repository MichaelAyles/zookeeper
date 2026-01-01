// GET /api/auth/google - Redirect to Google OAuth

interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_REDIRECT_URI: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  return Response.redirect(googleAuthUrl, 302);
};
