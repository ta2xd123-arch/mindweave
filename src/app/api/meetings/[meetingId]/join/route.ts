import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase-server';

// Join a meeting directly by meetingId
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;

  try {
    const body = await request.json();
    const { userId, userName } = body;

    if (!userId || !userName) {
      return NextResponse.json({ error: 'userId and userName are required' }, { status: 400 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    // 1. Ensure meeting exists
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id')
      .eq('id', meetingId)
      .maybeSingle();

    if (meetingError) throw meetingError;
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // 2. Ensure user exists in users table
    const { error: userError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        name: userName,
        email: `${userId.slice(0, 8)}@guest.mindweave.io`,
        created_at: new Date().toISOString()
      });

    if (userError) throw userError;

    // 3. Add user to meeting_participants
    const { error: participantError } = await supabase
      .from('meeting_participants')
      .upsert({
        meeting_id: meetingId,
        user_id: userId,
        display_name: userName,
        joined_at: new Date().toISOString()
      }, { onConflict: 'meeting_id,user_id' });

    if (participantError) throw participantError;

    return NextResponse.json({ success: true, meetingId });
  } catch (error: any) {
    console.error('Error joining meeting by ID:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
