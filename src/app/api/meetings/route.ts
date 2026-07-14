import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase-server';

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
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  if (!isSupabaseConfigured) {
    // Return empty list if Supabase is not configured yet
    return NextResponse.json({ meetings: [], warning: 'Supabase is not configured' });
  }

  try {
    // Fetch meetings created by the user or where the user is a participant
    // First, get meeting IDs the user participates in
    const { data: participantData, error: participantError } = await supabase
      .from('meeting_participants')
      .select('meeting_id')
      .eq('user_id', userId);

    if (participantError) throw participantError;

    const participantMeetingIds = participantData?.map((p: { meeting_id: string }) => p.meeting_id) || [];

    // Next, get all meetings either created by the user or where user is a participant
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('*')
      .or(`created_by.eq.${userId}${participantMeetingIds.length > 0 ? `,id.in.(${participantMeetingIds.join(',')})` : ''}`)
      .order('created_at', { ascending: false });

    if (meetingsError) throw meetingsError;

    return NextResponse.json({ meetings });
  } catch (error: any) {
    console.error('Error fetching meetings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new meeting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, topic, description, meetingDate, userId, userName } = body;

    if (!title || !topic || !userId || !userName) {
      return NextResponse.json({ error: 'title, topic, userId, and userName are required' }, { status: 400 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    // 1. Ensure user exists in users table (for FK constraint)
    const { error: userError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        name: userName,
        email: `${userId.slice(0, 8)}@guest.mindweave.io`,
        created_at: new Date().toISOString()
      });

    if (userError) throw userError;

    // 2. Generate unique invite code
    let inviteCode = generateInviteCode();
    let codeUnique = false;
    let attempts = 0;

    // Verify uniqueness of the code (retry up to 5 times)
    while (!codeUnique && attempts < 5) {
      const { data, error } = await supabase
        .from('meetings')
        .select('id')
        .eq('invite_code', inviteCode)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        codeUnique = true;
      } else {
        inviteCode = generateInviteCode();
        attempts++;
      }
    }

    // 3. Insert meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert({
        title,
        topic,
        description,
        meeting_date: meetingDate || new Date().toISOString(),
        invite_code: inviteCode,
        created_by: userId,
        status: 'active'
      })
      .select()
      .single();

    if (meetingError) throw meetingError;

    // 4. Automatically add the creator as a participant
    const { error: participantError } = await supabase
      .from('meeting_participants')
      .insert({
        meeting_id: meeting.id,
        user_id: userId,
        display_name: userName
      });

    if (participantError) throw participantError;

    return NextResponse.json({ meeting });
  } catch (error: any) {
    console.error('Error creating meeting:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
