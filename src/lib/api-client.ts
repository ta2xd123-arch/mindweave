import { isSupabaseConfigured, supabase } from './supabase';
import { getLocalSession } from './auth';

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const { data: { session } } = isSupabaseConfigured
    ? await supabase.auth.getSession()
    : { data: { session: null } };
  
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  } else {
    const localSession = getLocalSession();
    if (localSession?.guestToken) {
      headers.set('Authorization', `Bearer ${localSession.guestToken}`);
    }
  }
  
  return fetch(input, { ...init, headers });
}
