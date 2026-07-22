import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured, getAuthUser } from '@/lib/supabase-server';

// Helper to generate a 6-character random alphanumeric code
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET: List meetings for a user
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Server database configuration is incomplete' }, { status: 503 });
  }

  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;

  try {
    const { data: participantData, error: participantError } = await supabase
      .from('meeting_participants')
      .select('meeting_id')
      .eq('user_id', userId);

    if (participantError) throw participantError;

    const participantMeetingIds = participantData?.map((p: { meeting_id: string }) => p.meeting_id) || [];

    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('*')
      .or(`created_by.eq.${userId}${participantMeetingIds.length > 0 ? `,id.in.(${participantMeetingIds.join(',')})` : ''}`)
      .order('created_at', { ascending: false });

    if (meetingsError) throw meetingsError;

    return NextResponse.json({ meetings });
  } catch (error: unknown) {
    console.error('Error fetching meetings:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST: Create a new meeting
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { title, topic, description, meetingDate, userName, maxParticipants } = body;

    const authUser = await getAuthUser(request);

    if (!authUser || authUser.isGuestSession) {
      return NextResponse.json({ error: 'A signed-in user is required to create a meeting' }, { status: 401 });
    }
    const userId = authUser.id;

    if (!title || !topic || !userName) {
      return NextResponse.json({ error: 'title, topic, and userName are required' }, { status: 400 });
    }

    // 1. Ensure user exists in users table
    const { error: userError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        name: userName,
        email: authUser?.email || `${userId.slice(0, 8)}@guest.mindweave.io`,
        created_at: new Date().toISOString()
      });

    if (userError) throw userError;

    // 2. Generate unique invite code
    let inviteCode = generateInviteCode();
    let codeUnique = false;
    let attempts = 0;

    while (!codeUnique && attempts < 5) {
      const { data, error } = await supabase
        .from('meetings')
        .select('id')
        .eq('invite_code', inviteCode)
        .maybeSingle();

      if (error) throw error;
      if (!data) codeUnique = true;
      else { inviteCode = generateInviteCode(); attempts++; }
    }

    // 3. Insert meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert({
        title, topic, description,
        meeting_date: meetingDate || new Date().toISOString(),
        invite_code: inviteCode,
        created_by: userId,
        status: 'active',
        max_participants: maxParticipants || 20
      })
      .select().single();

    if (meetingError) throw meetingError;

    // 4. Add the creator as a participant
    const { error: participantError } = await supabase
      .from('meeting_participants')
      .insert({
        meeting_id: meeting.id,
        user_id: userId,
        display_name: userName
      });

    if (participantError) throw participantError;

    return NextResponse.json({ meeting });
  } catch (error: unknown) {
    console.error('Error creating meeting:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
