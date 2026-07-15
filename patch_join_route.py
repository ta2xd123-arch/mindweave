import re

with open(r'c:\Users\IT-GOOD\MINDWEAVE\src\app\api\meetings\join\route.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update GET method to return max_participants and current_participants
get_replacement = """    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, title, topic, description, created_by, meeting_date, status, max_participants')
      .eq('invite_code', inviteCode.toUpperCase().trim())
      .maybeSingle();

    if (meetingError) throw meetingError;
    if (!meeting) {
      return NextResponse.json({ error: 'Invalid invite code. Meeting not found.' }, { status: 404 });
    }

    const { count } = await supabase
      .from('meeting_participants')
      .select('*', { count: 'exact', head: true })
      .eq('meeting_id', meeting.id);

    return NextResponse.json({ meeting: { ...meeting, current_participants: count } });"""

content = re.sub(
    r"const \{ data: meeting, error: meetingError \}.*?return NextResponse\.json\(\{ meeting \}\);",
    get_replacement,
    content,
    flags=re.DOTALL
)

# 2. Update POST method to check max participants
post_replacement = """    // 1. Find the meeting by invite code
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, title, topic, status, max_participants')
      .eq('invite_code', inviteCode.toUpperCase().trim())
      .maybeSingle();

    if (meetingError) throw meetingError;
    if (!meeting) {
      return NextResponse.json({ error: 'Invalid invite code. Meeting not found.' }, { status: 404 });
    }
    
    if (meeting.status === 'closed') {
      return NextResponse.json({ error: 'Meeting is closed' }, { status: 403 });
    }

    // 2. Check if user is already authenticated (Owner)
    const authUser = await getAuthUser(request);
    let userId = authUser?.id;
    let guestTokenRaw = null;
    let isExistingParticipant = false;

    if (userId) {
      const { data: exist } = await supabase.from('meeting_participants').select('id').eq('meeting_id', meeting.id).eq('user_id', userId).maybeSingle();
      if (exist) isExistingParticipant = true;
    }

    // Check count if not existing participant
    if (!isExistingParticipant) {
      const { count } = await supabase.from('meeting_participants').select('*', { count: 'exact', head: true }).eq('meeting_id', meeting.id);
      if (count && meeting.max_participants && count >= meeting.max_participants) {
        return NextResponse.json({ error: 'Meeting is full' }, { status: 409 });
      }
    }"""

content = re.sub(
    r"// 1\. Find the meeting by invite code.*?let guestTokenRaw = null;",
    post_replacement,
    content,
    flags=re.DOTALL
)

with open(r'c:\Users\IT-GOOD\MINDWEAVE\src\app\api\meetings\join\route.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("join route updated")
