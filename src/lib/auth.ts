import { supabase, isSupabaseConfigured } from './supabase';
import type { ServerRole } from './auth-role';

export interface UserSession {
  id: string;
  name: string;
  email?: string;
  role: 'owner' | 'guest';
  guestToken?: string;
  meetingId?: string;
}

const USER_SESSION_KEY = 'mindweave_user_session';

async function getServerRole(accessToken: string): Promise<ServerRole> {
  const response = await fetch('/api/auth/role', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return 'guest';

  const data = await response.json() as { role?: unknown };
  return data.role === 'owner' ? 'owner' : 'guest';
}

// Get the current user session from local storage (Client-side only)
export function getLocalSession(): UserSession | null {
  if (typeof window === 'undefined') return null;
  const sessionStr = localStorage.getItem(USER_SESSION_KEY);
  if (!sessionStr) return null;
  try {
    return JSON.parse(sessionStr) as UserSession;
  } catch {
    return null;
  }
}

// Save a guest session directly (called after successfully joining a meeting)
export function saveGuestSession(session: UserSession): UserSession {
  if (typeof window === 'undefined') throw new Error('Client-side only');
  localStorage.setItem(USER_SESSION_KEY, JSON.stringify(session));
  return session;
}

// Legacy saveSession mainly for owner or backward compatibility
export async function saveSession(name: string, email?: string): Promise<UserSession> {
  if (typeof window === 'undefined') throw new Error('Client-side only');
  
  const session = getLocalSession();
  let userId = session?.id || '';
  let finalEmail = email || session?.email || '';
  let role: 'owner' | 'guest' = 'guest';
  
  // Sync to database if Supabase is configured
  if (isSupabaseConfigured) {
    const { data: { session: sbSession } } = await supabase.auth.getSession();
    if (sbSession) {
      userId = sbSession.user.id;
      finalEmail = sbSession.user.email || finalEmail;
      
      role = await getServerRole(sbSession.access_token);
    } else if (!userId) {
      // Just fallback for non-supabase local testing
      userId = 'local-guest-' + Math.random().toString(36).substr(2, 9);
    }
  } else if (!userId) {
    userId = 'local-guest-' + Math.random().toString(36).substr(2, 9);
  }

  const newSession: UserSession = {
    id: userId,
    name: name,
    email: finalEmail,
    role: role,
    guestToken: session?.guestToken,
    meetingId: session?.meetingId,
  };

  localStorage.setItem(USER_SESSION_KEY, JSON.stringify(newSession));
  return newSession;
}

// Clear the session (Logout)
export function clearSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(USER_SESSION_KEY);
  }
}
