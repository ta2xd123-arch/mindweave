import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured, getAuthUser } from '@/lib/supabase-server';

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

    const authUser = await getAuthUser(request);
    const currentUserRole = authUser?.role || 'guest';

    let aiReport = null;
    const { data: reportData, error: reportError } = await supabase
      .from('collective_knowledge')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!reportError && reportData) {
      if (currentUserRole === 'owner' || reportData.status === 'published') {
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
      currentUserRole,
      aiReport
    });
  } catch (error: any) {
    console.error('Error fetching report data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  if (!authUser || authUser.role !== 'owner') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
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
  } catch (error: any) {
    console.error('Error updating knowledge:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

