import { describe, expect, it } from 'vitest';
import {
  canShowMeetingCreation,
  guestMeetingHref,
  resolveHomeView,
  shouldFetchMeetingList,
} from '../src/lib/home-access';

describe('home access state', () => {
  it('waits for Supabase auth initialization before selecting a view or fetching meetings', () => {
    expect(resolveHomeView(true, 'loading', true)).toBe('loading');
    expect(shouldFetchMeetingList(true, 'loading', true)).toBe(false);
  });

  it('fetches and displays the meeting dashboard for an authenticated user', () => {
    expect(resolveHomeView(true, 'authenticated', true)).toBe('dashboard');
    expect(shouldFetchMeetingList(true, 'authenticated', true)).toBe(true);
  });

  it('does not fetch the meeting list or show creation controls for a guest', () => {
    expect(resolveHomeView(true, 'unauthenticated', true)).toBe('guest');
    expect(shouldFetchMeetingList(true, 'unauthenticated', true)).toBe(false);
    expect(canShowMeetingCreation(true, 'unauthenticated')).toBe(false);
  });

  it('keeps a scoped guest on the meeting issued with its verified token', () => {
    expect(guestMeetingHref({ guestToken: 'guest_token', meetingId: 'meeting-a' })).toBe('/meetings/meeting-a');
    expect(guestMeetingHref({ meetingId: 'meeting-a' })).toBeNull();
    expect(guestMeetingHref({ guestToken: 'guest_token' })).toBeNull();
  });

  it('keeps local mock mode available without Supabase authentication', () => {
    expect(resolveHomeView(false, 'authenticated', true)).toBe('dashboard');
    expect(shouldFetchMeetingList(false, 'authenticated', true)).toBe(true);
    expect(canShowMeetingCreation(false, 'authenticated')).toBe(true);
  });
});
