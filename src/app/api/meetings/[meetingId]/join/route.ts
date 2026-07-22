import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured, getAuthUser } from '@/lib/supabase-server';

// Join a meeting directly by meetingId
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;

  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.isGuestSession && authUser.meeting_id !== meetingId) {
      return NextResponse.json({ error: 'Guest sessions are limited to their joined meeting' }, { status: 403 });
    }
    const userId = authUser.id;

    // 1. Ensure meeting exists
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, status, max_participants')
      .eq('id', meetingId)
      .maybeSingle();

    if (meetingError) throw meetingError;
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }
    if (meeting.status === 'closed') {
      return NextResponse.json({ error: 'Meeting is closed' }, { status: 403 });
    }

    // 2. Ensure user exists in users table
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .maybeSingle();
    if (userError || !user) return NextResponse.json({ error: 'User not found' }, { status: 403 });

    // 3. Add user to meeting_participants
    const { error: participantError } = await supabase
      .from('meeting_participants')
      .upsert({
        meeting_id: meetingId,
        user_id: userId,
        display_name: user.name,
        joined_at: new Date().toISOString()
      }, { onConflict: 'meeting_id,user_id' });

    if (participantError) throw participantError;

    return NextResponse.json({ success: true, meetingId });
  } catch (error: unknown) {
    console.error('Error joining meeting by ID:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
