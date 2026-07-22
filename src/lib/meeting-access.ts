export interface MeetingAuthContext {
  id?: string;
  isGuestSession: boolean;
  meeting_id?: string;
}

export function isAuthorizedForMeeting(authUser: MeetingAuthContext, meetingId: string): boolean {
  return !authUser.isGuestSession || authUser.meeting_id === meetingId;
}

export function isMeetingOwner(authUser: MeetingAuthContext, createdBy: string): boolean {
  return !authUser.isGuestSession && authUser.id === createdBy;
}
