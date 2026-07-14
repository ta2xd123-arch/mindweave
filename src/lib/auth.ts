import { supabase, isSupabaseConfigured } from './supabase';

export interface UserSession {
  id: string;
  name: string;
  email?: string;
}

const USER_SESSION_KEY = 'mindweave_user_session';

// Helper to generate a random UUID on the client side if crypto.randomUUID is not available
function generateUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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

// Save session to local storage and sync with Supabase users table
export async function saveSession(name: string, email?: string): Promise<UserSession> {
  if (typeof window === 'undefined') throw new Error('Client-side only');
  
  let session = getLocalSession();
  const userId = session?.id || generateUUID();
  
  const newSession: UserSession = {
    id: userId,
    name: name,
    email: email || session?.email || `${userId.slice(0, 8)}@guest.mindweave.io`,
  };

  // Save locally
  localStorage.setItem(USER_SESSION_KEY, JSON.stringify(newSession));

  // Sync to database if Supabase is configured
  if (isSupabaseConfigured) {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          name: name,
          email: newSession.email,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        console.error('Failed to sync user with Supabase:', errData);
      }
    } catch (err) {
      console.error('Database error in saveSession:', err);
    }
  }

  return newSession;
}

// Clear the session (Logout)
export function clearSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(USER_SESSION_KEY);
  }
}
