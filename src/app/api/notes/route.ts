import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured, getAuthUser } from '@/lib/supabase-server';
import { isAuthorizedForMeeting } from '@/lib/meeting-access';

// POST: Create a new note
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { meetingId, authorName, noteType, content } = body;
    const authorId = authUser.id;

    if (!meetingId || !authorName || !content) {
      return NextResponse.json(
        { error: 'meetingId, authorName, and content are required' },
        { status: 400 }
      );
    }
    if (!isAuthorizedForMeeting(authUser, meetingId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify meeting is active
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('status')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }
    if (meeting.status === 'closed') {
      return NextResponse.json({ error: 'Cannot add notes to a closed meeting' }, { status: 403 });
    }

    // Verify user is a participant
    const { data: participantData, error: partError } = await supabase
      .from('meeting_participants')
      .select('user_id')
      .eq('meeting_id', meetingId)
      .eq('user_id', authorId)
      .maybeSingle();

    if (partError || !participantData) {
      return NextResponse.json({ error: 'Forbidden. Not a participant.' }, { status: 403 });
    }

    const { data: note, error } = await supabase
      .from('notes')
      .insert({
        meeting_id: meetingId,
        author_id: authorId,
        author_name: authorName,
        note_type: noteType || 'thought',
        content: content.trim(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ note });
  } catch (error: unknown) {
    console.error('Error creating note:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
