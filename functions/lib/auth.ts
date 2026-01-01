// JWT utilities for authentication

interface JWTPayload {
  sub: string; // user id
  email: string;
  name: string;
  exp: number;
}

const encoder = new TextEncoder();

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function createJWT(
  payload: Omit<JWTPayload, 'exp'>,
  secret: string,
  expiresInDays: number = 7
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60;
  const fullPayload = { ...payload, exp };

  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(fullPayload)));
  const message = `${headerB64}.${payloadB64}`;

  const key = await getKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const signatureB64 = base64UrlEncode(signature);

  return `${message}.${signatureB64}`;
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    const message = `${headerB64}.${payloadB64}`;
    const signature = base64UrlDecode(signatureB64);

    const key = await getKey(secret);
    const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(message));
    if (!valid) return null;

    const payload: JWTPayload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payloadB64))
    );

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function setAuthCookie(token: string): string {
  const maxAge = 7 * 24 * 60 * 60; // 7 days
  return `auth=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearAuthCookie(): string {
  return 'auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

export function getAuthToken(request: Request): string | null {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;

  const match = cookie.match(/auth=([^;]+)/);
  return match ? match[1] : null;
}

export interface User {
  id: string;
  googleId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

export async function getCurrentUser(
  request: Request,
  env: { JWT_SECRET?: string; DB: D1Database }
): Promise<User | null> {
  const token = getAuthToken(request);
  if (!token) return null;

  const secret = env.JWT_SECRET || 'demo-secret-not-for-production';
  const payload = await verifyJWT(token, secret);
  if (!payload) return null;

  const result = await env.DB.prepare(
    'SELECT id, google_id as googleId, email, display_name as displayName, avatar_url as avatarUrl, created_at as createdAt FROM users WHERE id = ?'
  ).bind(payload.sub).first<User>();

  return result || null;
}
