// API client for Cloudflare Pages Functions

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function fetchApi<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: 'include', // Send cookies for auth
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    // Not authenticated - redirect to login
    window.location.href = '/api/auth/google';
    throw new ApiError('Unauthorized', 401);
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(error.error || 'Request failed', res.status);
  }

  // Handle empty responses
  const text = await res.text();
  if (!text) return null as T;

  return JSON.parse(text);
}

// Convenience methods
export const api = {
  get: <T>(path: string) => fetchApi<T>(path, { method: 'GET' }),

  post: <T>(path: string, data?: unknown) =>
    fetchApi<T>(path, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(path: string, data: unknown) =>
    fetchApi<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: <T>(path: string) => fetchApi<T>(path, { method: 'DELETE' }),
};
