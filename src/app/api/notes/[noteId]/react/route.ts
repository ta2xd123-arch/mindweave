import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase-server';

// POST: Toggle reaction on a note
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const { noteId } = await params;

  try {
    const body = await request.json();
    const { userId, userName, reactionType = 'like' } = body;

    if (!userId || !userName) {
      return NextResponse.json({ error: 'userId and userName are required' }, { status: 400 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

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
          user_name: userName,
          reaction_type: reactionType,
        });

      if (insertError) throw insertError;
      return NextResponse.json({ action: 'added' });
    }
  } catch (error: any) {
    console.error('Error toggling reaction:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
