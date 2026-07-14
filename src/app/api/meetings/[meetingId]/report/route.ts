import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase-server';

// GET: Get report data for a meeting (all notes organized by type + participants)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;

  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
  }

  try {
    // Fetch meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .maybeSingle();

    if (meetingError) throw meetingError;
    if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });

    // Fetch participants
    const { data: participants, error: partsError } = await supabase
      .from('meeting_participants')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('joined_at', { ascending: true });

    if (partsError) throw partsError;

    // Fetch all notes
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true });

    if (notesError) throw notesError;

    // Fetch reactions for all notes
    const noteIds = (notes || []).map((n: { id: string }) => n.id);
    let reactions: any[] = [];
    if (noteIds.length > 0) {
      const { data: reactData, error: reactError } = await supabase
        .from('reactions')
        .select('*')
        .in('note_id', noteIds);

      if (reactError) throw reactError;
      reactions = reactData || [];
    }

    return NextResponse.json({
      meeting,
      participants: participants || [],
      notes: notes || [],
      reactions,
    });
  } catch (error: any) {
    console.error('Error fetching report data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
