import { createAuthClient } from '@neon/auth';
import { BetterAuthReactAdapter } from '@neon/auth/react/adapters';

export const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL, {
  adapter: BetterAuthReactAdapter(),
});

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

async function getToken(): Promise<string | null> {
  try {
    const { data } = await authClient.token();
    // The React adapter's token() returns { session: { token }, user },
    // not the flat { token } shape the generic Better Auth docs describe.
    return (data as any)?.session?.token ?? (data as any)?.token ?? null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError((body && body.error) || `Request failed (${res.status})`, res.status, body);
  }
  return body as T;
}
