import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;

  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
  }

  try {
    // 1. Fetch meeting info
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .maybeSingle();

    if (meetingError) throw meetingError;
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // 2. Fetch participant list
    const { data: participants, error: participantsError } = await supabase
      .from('meeting_participants')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('joined_at', { ascending: true });

    if (participantsError) throw participantsError;

    // 3. Fetch notes (Phase 3)
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true });

    if (notesError) throw notesError;

    return NextResponse.json({ meeting, participants, notes: notes || [] });
  } catch (error: any) {
    console.error('Error fetching meeting details:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
