// POST /api/auth/logout - Clear auth cookie

import { clearAuthCookie } from '../../lib/auth';
import { json } from '../../lib/db';

export const onRequestPost: PagesFunction = async () => {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearAuthCookie(),
    },
  });
};
