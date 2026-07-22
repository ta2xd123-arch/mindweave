import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured, getAuthUser } from '@/lib/supabase-server';
import { isMeetingOwner } from '@/lib/meeting-access';

// PATCH: Close a meeting (creator only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;

  try {
    const body = await request.json();
    const { status = 'closed' } = body;

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (status !== 'active' && status !== 'closed') {
      return NextResponse.json({ error: 'Invalid meeting status' }, { status: 400 });
    }

    // Only allow creator to change status
    const { data: meeting, error: fetchError } = await supabase
      .from('meetings')
      .select('created_by')
      .eq('id', meetingId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    if (!isMeetingOwner(authUser, meeting.created_by)) {
      return NextResponse.json({ error: 'Only the meeting creator can change its status' }, { status: 403 });
    }

    const { data: updated, error: updateError } = await supabase
      .from('meetings')
      .update({ status })
      .eq('id', meetingId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Closing blocks writes in the note and reaction routes. Keep scoped guest
    // sessions valid so participants can read a report once the host publishes it.

    return NextResponse.json({ meeting: updated });
  } catch (error: unknown) {
    console.error('Error updating meeting status:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
