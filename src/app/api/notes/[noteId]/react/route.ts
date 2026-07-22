import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured, getAuthUser } from '@/lib/supabase-server';
import { isAuthorizedForMeeting } from '@/lib/meeting-access';

// POST: Toggle reaction on a note
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const { noteId } = await params;

  try {
    const body = await request.json();
    const { reactionType = 'like' } = body;

    if (reactionType !== 'like') {
      return NextResponse.json({ error: 'Invalid reaction type' }, { status: 400 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = authUser.id;

    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('meeting_id')
      .eq('id', noteId)
      .maybeSingle();
    if (noteError) throw noteError;
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    if (!isAuthorizedForMeeting(authUser, note.meeting_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('status')
      .eq('id', note.meeting_id)
      .maybeSingle();
    if (meetingError) throw meetingError;
    if (!meeting || meeting.status === 'closed') {
      return NextResponse.json({ error: 'Cannot react to a note in a closed meeting' }, { status: 403 });
    }

    const { data: participant } = await supabase
      .from('meeting_participants')
      .select('user_id')
      .eq('meeting_id', note.meeting_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!participant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .maybeSingle();
    if (userError || !user) return NextResponse.json({ error: 'User not found' }, { status: 403 });

    // Check if reaction already exists (toggle behavior)
    const { data: existing, error: checkError } = await supabase
      .from('reactions')
      .select('id')
      .eq('note_id', noteId)
      .eq('user_id', userId)
      .eq('reaction_type', reactionType)
      .maybeSingle();

    if (checkError) throw checkError;

    if (existing) {
      // Remove reaction (un-react)
      const { error: deleteError } = await supabase
        .from('reactions')
        .delete()
        .eq('id', existing.id);

      if (deleteError) throw deleteError;
      return NextResponse.json({ action: 'removed' });
    } else {
      // Add reaction
      const { error: insertError } = await supabase
        .from('reactions')
        .insert({
          note_id: noteId,
          user_id: userId,
          user_name: user.name,
          reaction_type: reactionType,
        });

      if (insertError) throw insertError;
      return NextResponse.json({ action: 'added' });
    }
  } catch (error: unknown) {
    console.error('Error toggling reaction:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
