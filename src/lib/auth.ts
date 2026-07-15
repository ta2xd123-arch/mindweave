import { apiFetch } from '@/lib/api-client';
import { supabase, isSupabaseConfigured } from './supabase';

export interface UserSession {
  id: string;
  name: string;
  email?: string;
  role: 'owner' | 'guest';
  guestToken?: string;
  meetingId?: string;
}

const USER_SESSION_KEY = 'mindweave_user_session';

// Get the current user session from local storage (Client-side only)
export function getLocalSession(): UserSession | null {
  if (typeof window === 'undefined') return null;
  const sessionStr = localStorage.getItem(USER_SESSION_KEY);
  if (!sessionStr) return null;
  try {
    return JSON.parse(sessionStr) as UserSession;
  } catch (e) {
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
  
  let session = getLocalSession();
  let userId = session?.id || '';
  let finalEmail = email || session?.email || '';
  let role: 'owner' | 'guest' = 'guest';
  
  // Sync to database if Supabase is configured
  if (isSupabaseConfigured) {
    const { data: { session: sbSession } } = await supabase.auth.getSession();
    if (sbSession) {
      userId = sbSession.user.id;
      finalEmail = sbSession.user.email || finalEmail;
      
      // Check if user is in app_admins
      const { data: adminData } = await supabase
        .from('app_admins')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
        
      role = adminData ? 'owner' : 'guest';
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

