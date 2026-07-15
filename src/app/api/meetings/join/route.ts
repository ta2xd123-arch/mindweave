import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase, isSupabaseConfigured, getAuthUser } from '@/lib/supabase-server';

// GET: Look up meeting details by invite code
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const inviteCode = searchParams.get('inviteCode');

  if (!inviteCode) {
    return NextResponse.json({ error: 'inviteCode is required' }, { status: 400 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ mockMode: true, inviteCode: inviteCode.toUpperCase() });
  }

  try {
        const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, title, topic, description, created_by, meeting_date, status, max_participants')
      .eq('invite_code', inviteCode.toUpperCase().trim())
      .maybeSingle();

    if (meetingError) throw meetingError;
    if (!meeting) {
      return NextResponse.json({ error: 'Invalid invite code. Meeting not found.' }, { status: 404 });
    }

    const { count } = await supabase
      .from('meeting_participants')
      .select('*', { count: 'exact', head: true })
      .eq('meeting_id', meeting.id);

    return NextResponse.json({ meeting: { ...meeting, current_participants: count } });
  } catch (error: any) {
    console.error('Error fetching meeting by invite code:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Join a meeting by invite code
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { inviteCode, userName } = body;

    if (!inviteCode || !userName) {
      return NextResponse.json({ error: 'inviteCode and userName are required' }, { status: 400 });
    }

        // 1. Find the meeting by invite code
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, title, topic, status, max_participants')
      .eq('invite_code', inviteCode.toUpperCase().trim())
      .maybeSingle();

    if (meetingError) throw meetingError;
    if (!meeting) {
      return NextResponse.json({ error: 'Invalid invite code. Meeting not found.' }, { status: 404 });
    }
    
    if (meeting.status === 'closed') {
      return NextResponse.json({ error: 'Meeting is closed' }, { status: 403 });
    }

    // 2. Check if user is already authenticated (Owner)
    const authUser = await getAuthUser(request);
    let userId = authUser?.id;
    let guestTokenRaw = null;
    let isExistingParticipant = false;

    if (userId) {
      const { data: exist } = await supabase.from('meeting_participants').select('id').eq('meeting_id', meeting.id).eq('user_id', userId).maybeSingle();
      if (exist) isExistingParticipant = true;
    }

    // Check count if not existing participant
    if (!isExistingParticipant) {
      const { count } = await supabase.from('meeting_participants').select('*', { count: 'exact', head: true }).eq('meeting_id', meeting.id);
      if (count && meeting.max_participants && count >= meeting.max_participants) {
        return NextResponse.json({ error: 'Meeting is full' }, { status: 409 });
      }
    }

    if (!userId) {
      // 3. Generate Guest Session
      userId = crypto.randomUUID();
      guestTokenRaw = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(guestTokenRaw).digest('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1); // 24 hours

      // Insert guest into users table (without email)
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: userId,
          name: userName,
          created_at: new Date().toISOString()
        });

      if (userError) {
        console.error('Error creating guest user:', userError);
        throw new Error('Failed to create guest user');
      }

      // Insert guest token
      const { error: tokenError } = await supabase
        .from('guest_tokens')
        .insert({
          token_hash: tokenHash,
          participant_id: userId,
          meeting_id: meeting.id,
          expires_at: expiresAt.toISOString()
        });

      if (tokenError) throw tokenError;
    } else {
      // Update existing user's name if they join with a new name
      await supabase.from('users').update({ name: userName }).eq('id', userId);
    }

    // 4. Add user to meeting_participants
    const { error: participantError } = await supabase
      .from('meeting_participants')
      .upsert({
        meeting_id: meeting.id,
        user_id: userId,
        display_name: userName,
        joined_at: new Date().toISOString()
      }, { onConflict: 'meeting_id,user_id' });

    if (participantError) throw participantError;

    return NextResponse.json({ 
      success: true, 
      meetingId: meeting.id, 
      meeting,
      participantId: userId,
      guestToken: guestTokenRaw ? `guest_${guestTokenRaw}` : null
    });
  } catch (error: any) {
    console.error('Error joining meeting by invite code:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
