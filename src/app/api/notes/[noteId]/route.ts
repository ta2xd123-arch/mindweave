import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured, getAuthUser } from '@/lib/supabase-server';

// PATCH: Update note content
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const { noteId } = await params;

  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content } = body;
    const authorId = authUser.id;

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    // Check if note belongs to a closed meeting
    const { data: noteCheck, error: noteError } = await supabase
      .from('notes')
      .select('meeting_id')
      .eq('id', noteId)
      .eq('author_id', authorId)
      .single();
      
    if (noteError || !noteCheck) {
      return NextResponse.json({ error: 'Note not found or unauthorized' }, { status: 404 });
    }

    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('status')
      .eq('id', noteCheck.meeting_id)
      .single();

    if (meetingError || meeting?.status === 'closed') {
      return NextResponse.json({ error: 'Cannot edit notes in a closed meeting' }, { status: 403 });
    }

    // Security: only the author can update their own note
    const { data: note, error } = await supabase
      .from('notes')
      .update({ content: content.trim() })
      .eq('id', noteId)
      .eq('author_id', authorId)
      .select()
      .single();

    if (error) throw error;
    if (!note) {
      return NextResponse.json({ error: 'Note not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ note });
  } catch (error: any) {
    console.error('Error updating note:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete a note
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const { noteId } = await params;

  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authorId = authUser.id;

    // Check if note belongs to a closed meeting
    const { data: noteCheck, error: noteError } = await supabase
      .from('notes')
      .select('meeting_id')
      .eq('id', noteId)
      .eq('author_id', authorId)
      .single();
      
    if (noteError || !noteCheck) {
      return NextResponse.json({ error: 'Note not found or unauthorized' }, { status: 404 });
    }

    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('status')
      .eq('id', noteCheck.meeting_id)
      .single();

    if (meetingError || meeting?.status === 'closed') {
      return NextResponse.json({ error: 'Cannot delete notes in a closed meeting' }, { status: 403 });
    }

    // Security: only the author can delete their own note
    const { error, count } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)
      .eq('author_id', authorId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting note:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
