import { describe, expect, it } from 'vitest';
import { parseAnalysisPayload, parseAnalysisText, toClientAnalysis } from '../src/lib/ai-analysis';
import { roleLookupResponse, unauthorizedRoleLookupResult } from '../src/lib/auth-role';
import { isAuthorizedForMeeting, isMeetingOwner } from '../src/lib/meeting-access';

describe('guest meeting scope', () => {
  it('allows a guest token only for its issued meeting', () => {
    expect(isAuthorizedForMeeting({ isGuestSession: true, meeting_id: 'meeting-a' }, 'meeting-a')).toBe(true);
    expect(isAuthorizedForMeeting({ isGuestSession: true, meeting_id: 'meeting-a' }, 'meeting-b')).toBe(false);
  });

  it('does not scope authenticated Supabase users to a single guest meeting', () => {
    expect(isAuthorizedForMeeting({ isGuestSession: false }, 'meeting-b')).toBe(true);
  });

  it('never grants close or AI analysis ownership to a guest session', () => {
    expect(isMeetingOwner({ id: 'guest-a', isGuestSession: true, meeting_id: 'meeting-a' }, 'guest-a')).toBe(false);
  });

  it('grants owner actions only to the authenticated meeting creator', () => {
    expect(isMeetingOwner({ id: 'owner-a', isGuestSession: false }, 'owner-a')).toBe(true);
    expect(isMeetingOwner({ id: 'owner-b', isGuestSession: false }, 'owner-a')).toBe(false);
  });
});

describe('AI analysis response mapping', () => {
  it('maps database snake_case fields to the client contract', () => {
    expect(toClientAnalysis({
      status: 'draft', title: '제목', conclusion: '결론',
      supporting_ideas: ['찬성'], opposing_ideas: ['반대'], new_insight: '통찰',
      unresolved_questions: ['질문'], action_items: ['실행'],
    })).toMatchObject({
      supportingIdeas: ['찬성'], opposingIdeas: ['반대'], newInsight: '통찰',
      unresolvedQuestions: ['질문'], actionItems: ['실행'],
    });
  });

  it('uses safe defaults when the model omits optional arrays', () => {
    expect(toClientAnalysis({ title: '제목', conclusion: '결론' })).toMatchObject({
      status: 'draft', supportingIdeas: [], opposingIdeas: [], unresolvedQuestions: [], actionItems: [],
    });
  });

  it('rejects malformed provider output before it can be stored', () => {
    expect(parseAnalysisPayload({ title: '제목' })).toBeNull();
    expect(parseAnalysisPayload({ title: '', conclusion: '결론' })).toBeNull();
  });

  it('keeps only string list entries from a valid provider response', () => {
    expect(parseAnalysisPayload({
      title: '제목', conclusion: '결론', supportingIdeas: ['의견', 1],
    })).toMatchObject({ supportingIdeas: ['의견'], opposingIdeas: [], actionItems: [] });
  });

  it('accepts a fenced JSON response without persisting provider prose', () => {
    expect(parseAnalysisText('```json\n{"title":"제목","conclusion":"결론"}\n```')).toMatchObject({
      title: '제목', conclusion: '결론', supportingIdeas: [], actionItems: [],
    });
  });

  it('rejects non-JSON provider text so the server can request one safe retry', () => {
    expect(parseAnalysisText('분석 결과를 아래에 정리했습니다.')).toBeNull();
  });
});

describe('server role lookup contract', () => {
  it('uses a 401 response body when there is no verified Supabase session', () => {
    expect(unauthorizedRoleLookupResult()).toEqual({ status: 401, body: { error: 'Unauthorized' } });
  });

  it('returns no administrator authority for authenticated non-admin users', () => {
    expect(roleLookupResponse(false)).toEqual({ isAdmin: false, role: 'guest' });
  });

  it('returns owner authority only when the server finds an admin row', () => {
    expect(roleLookupResponse(true)).toEqual({ isAdmin: true, role: 'owner' });
  });
});
