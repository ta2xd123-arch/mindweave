import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase-server';

// PATCH: Close a meeting (creator only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;

  try {
    const body = await request.json();
    const { userId, status } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    // Only allow creator to change status
    const { data: meeting, error: fetchError } = await supabase
      .from('meetings')
      .select('created_by')
      .eq('id', meetingId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    if (meeting.created_by !== userId) {
      return NextResponse.json({ error: 'Only the meeting creator can change its status' }, { status: 403 });
    }

    const { data: updated, error: updateError } = await supabase
      .from('meetings')
      .update({ status: status || 'closed' })
      .eq('id', meetingId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ meeting: updated });
  } catch (error: any) {
    console.error('Error updating meeting status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
