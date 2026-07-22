import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured, getAuthUser } from '@/lib/supabase-server';
import { isAuthorizedForMeeting } from '@/lib/meeting-access';

// GET: Get report data for a meeting (all notes organized by type + participants)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;

  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
  }

  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAuthorizedForMeeting(authUser, meetingId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    const { data: participant, error: participantError } = await supabase
      .from('meeting_participants')
      .select('user_id')
      .eq('meeting_id', meetingId)
      .eq('user_id', authUser.id)
      .maybeSingle();
    if (participantError) throw participantError;
    if (!participant && meeting.created_by !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
    let reactions: { note_id: string; user_id: string; reaction_type: string }[] = [];
    if (noteIds.length > 0) {
      const { data: reactData, error: reactError } = await supabase
        .from('reactions')
        .select('*')
        .in('note_id', noteIds);

      if (reactError) throw reactError;
      reactions = reactData || [];
    }

    const isMeetingCreator = meeting.created_by === authUser.id;

    let aiReport = null;
    const { data: reportData, error: reportError } = await supabase
      .from('collective_knowledge')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!reportError && reportData) {
      if (isMeetingCreator || reportData.status === 'published') {
        // Map database snake_case fields to camelCase for the frontend
        aiReport = {
          id: reportData.id,
          status: reportData.status,
          title: reportData.title,
          conclusion: reportData.conclusion,
          supportingIdeas: reportData.supporting_ideas || [],
          opposingIdeas: reportData.opposing_ideas || [],
          newInsight: reportData.new_insight || '',
          unresolvedQuestions: reportData.unresolved_questions || [],
          actionItems: reportData.action_items || []
        };
      }
    }

    return NextResponse.json({
      meeting,
      participants: participants || [],
      notes: notes || [],
      reactions,
      isMeetingCreator,
      aiReport
    });
  } catch (error: unknown) {
    console.error('Error fetching report data:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH: Update collective_knowledge (Publish)
export async function PATCH(
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

  try {
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('created_by')
      .eq('id', meetingId)
      .maybeSingle();
    if (meetingError) throw meetingError;
    if (!meeting || meeting.created_by !== authUser.id) {
      return NextResponse.json({ error: 'Only the meeting creator can publish a report' }, { status: 403 });
    }

    const body = await request.json();
    const { status, title, conclusion, supportingIdeas, opposingIdeas, newInsight, unresolvedQuestions, actionItems } = body;

    const { data, error } = await supabase
      .from('collective_knowledge')
      .update({
        status: status || 'published',
        title,
        conclusion,
        supporting_ideas: supportingIdeas,
        opposing_ideas: opposingIdeas,
        new_insight: newInsight,
        unresolved_questions: unresolvedQuestions,
        action_items: actionItems,
        updated_at: new Date().toISOString()
      })
      .eq('meeting_id', meetingId)
      .select()
      .maybeSingle();

    if (error) throw error;
    
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('Error updating knowledge:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
