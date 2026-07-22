import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured, getAuthUser } from '@/lib/supabase-server';
import { isAuthorizedForMeeting } from '@/lib/meeting-access';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;

  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
  }

  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = authUser.id;
  if (!isAuthorizedForMeeting(authUser, meetingId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .maybeSingle();

    if (meetingError) throw meetingError;
    if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });

    const { data: participantData, error: partError } = await supabase
      .from('meeting_participants')
      .select('user_id')
      .eq('meeting_id', meetingId)
      .eq('user_id', userId)
      .maybeSingle();

    if (partError) throw partError;
    if (!participantData && meeting.created_by !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: participants, error: participantsError } = await supabase
      .from('meeting_participants')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('joined_at', { ascending: true });
    if (participantsError) throw participantsError;

    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true });
    if (notesError) throw notesError;

    return NextResponse.json({ 
      meeting, 
      participants, 
      notes: notes || [],
      isMeetingCreator: meeting.created_by === userId,
    });
  } catch (error: unknown) {
    console.error('Error fetching meeting details:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Server database configuration is incomplete' }, { status: 503 });
  }

  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('created_by')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    if (meeting.created_by !== authUser.id) return NextResponse.json({ error: 'Unauthorized to delete this meeting' }, { status: 403 });

    const { error: deleteError } = await supabase.from('meetings').delete().eq('id', meetingId);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting meeting:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Server database configuration is incomplete' }, { status: 503 });
  }

  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { title, topic, description } = body;

  try {
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('created_by')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    if (meeting.created_by !== authUser.id) return NextResponse.json({ error: 'Unauthorized to edit this meeting' }, { status: 403 });

    const { error: updateError } = await supabase
      .from('meetings')
      .update({ title, topic, description })
      .eq('id', meetingId);
    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error updating meeting:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
