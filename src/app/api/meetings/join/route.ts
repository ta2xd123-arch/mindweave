import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase-server';

// GET: Look up meeting details by invite code
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const inviteCode = searchParams.get('inviteCode');

  if (!inviteCode) {
    return NextResponse.json({ error: 'inviteCode is required' }, { status: 400 });
  }

  if (!isSupabaseConfigured) {
    // Mock Mode fallback
    return NextResponse.json({ 
      mockMode: true,
      inviteCode: inviteCode.toUpperCase()
    });
  }

  try {
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, title, topic, description, created_by, meeting_date')
      .eq('invite_code', inviteCode.toUpperCase().trim())
      .maybeSingle();

    if (meetingError) throw meetingError;
    if (!meeting) {
      return NextResponse.json({ error: 'Invalid invite code. Meeting not found.' }, { status: 404 });
    }

    return NextResponse.json({ meeting });
  } catch (error: any) {
    console.error('Error fetching meeting by invite code:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Join a meeting by invite code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inviteCode, userId, userName } = body;

    if (!inviteCode || !userId || !userName) {
      return NextResponse.json({ error: 'inviteCode, userId, and userName are required' }, { status: 400 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    // 1. Find the meeting by invite code
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, title, topic')
      .eq('invite_code', inviteCode.toUpperCase().trim())
      .maybeSingle();

    if (meetingError) throw meetingError;
    if (!meeting) {
      return NextResponse.json({ error: 'Invalid invite code. Meeting not found.' }, { status: 404 });
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
        meeting_id: meeting.id,
        user_id: userId,
        display_name: userName,
        joined_at: new Date().toISOString()
      }, { onConflict: 'meeting_id,user_id' });

    if (participantError) throw participantError;

    return NextResponse.json({ success: true, meetingId: meeting.id, meeting });
  } catch (error: any) {
    console.error('Error joining meeting by invite code:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
