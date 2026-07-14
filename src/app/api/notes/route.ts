import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase-server';

// POST: Create a new note
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { meetingId, authorId, authorName, noteType, content } = body;

    if (!meetingId || !authorId || !authorName || !content) {
      return NextResponse.json(
        { error: 'meetingId, authorId, authorName, and content are required' },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
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
  } catch (error: any) {
    console.error('Error creating note:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
