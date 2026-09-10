/** Browser session for the server-authenticated OceanScope prototype accounts. */

export interface DemoSession {
  accessToken: string;
  identifier: string;
  displayName: string;
  role: string;
  loggedInAt: string;
}

interface SessionProfile {
  identifier: string;
  displayName: string;
  role: string;
}

interface LoginResponse {
  status: 'success' | 'error';
  data?: {
    accessToken: string;
    profile: SessionProfile;
  };
}

const SESSION_KEY = 'oceanscope.demo.session';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export function getSession(): DemoSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoSession;
    if (!parsed || typeof parsed.accessToken !== 'string' || !parsed.accessToken || typeof parsed.identifier !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function startAuthenticatedSession(session: Omit<DemoSession, 'loggedInAt'>): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, loggedInAt: new Date().toISOString() }));
}

export function endSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export async function authenticate(identifier: string, password: string): Promise<'success' | 'invalid' | 'unavailable'> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const payload = await response.json() as LoginResponse;
    if (response.ok && payload.status === 'success' && payload.data?.accessToken && payload.data.profile) {
      startAuthenticatedSession({ accessToken: payload.data.accessToken, ...payload.data.profile });
      return 'success';
    }
    return 'invalid';
  } catch {
    return 'unavailable';
  }
}

export async function validateSession(session = getSession()): Promise<boolean> {
  if (!session) return false;
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/session`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (!response.ok) {
      endSession();
      return false;
    }
    const payload = await response.json() as { status?: string; data?: { profile?: SessionProfile } };
    if (payload.status !== 'success' || !payload.data?.profile) {
      endSession();
      return false;
    }
    startAuthenticatedSession({ accessToken: session.accessToken, ...payload.data.profile });
    return true;
  } catch {
    endSession();
    return false;
  }
}
