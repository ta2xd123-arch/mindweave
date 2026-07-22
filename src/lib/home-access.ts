export type HomeAuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type HomeView = 'loading' | 'landing' | 'guest' | 'dashboard';

export function resolveHomeView(
  isSupabaseConfigured: boolean,
  authStatus: HomeAuthStatus,
  hasLocalSession: boolean,
): HomeView {
  if (authStatus === 'loading') return 'loading';
  if (!hasLocalSession) return 'landing';
  if (isSupabaseConfigured && authStatus !== 'authenticated') return 'guest';
  return 'dashboard';
}

export function shouldFetchMeetingList(
  isSupabaseConfigured: boolean,
  authStatus: HomeAuthStatus,
  hasLocalSession: boolean,
): boolean {
  if (!hasLocalSession || authStatus === 'loading') return false;
  return !isSupabaseConfigured || authStatus === 'authenticated';
}

export function canShowMeetingCreation(
  isSupabaseConfigured: boolean,
  authStatus: HomeAuthStatus,
): boolean {
  return !isSupabaseConfigured || authStatus === 'authenticated';
}

export function guestMeetingHref(session: { guestToken?: string; meetingId?: string }): string | null {
  return session.guestToken && session.meetingId ? `/meetings/${session.meetingId}` : null;
}
