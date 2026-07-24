'use client';
import { apiFetch } from '@/lib/api-client';
import { useUpdateActivity } from '@/components/app-update-manager';

import { useState, useEffect, use, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getLocalSession, UserSession } from '@/lib/auth';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { renderFormattedText } from '@/lib/linkify';
import {
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Participant {
  id: string;
  user_id: string;
  display_name: string;
  joined_at: string;
}

interface Meeting {
  id: string;
  title: string;
  topic: string;
  description: string;
  invite_code: string;
  created_by: string;
  meeting_date: string;
  created_at: string;
  status: string;
}

interface Note {
  id: string;
  meeting_id: string;
  author_id: string;
  author_name: string;
  note_type: NoteType;
  content: string;
  created_at: string;
  updated_at: string;
}

interface Reaction {
  note_id: string;
  user_id: string;
  user_name: string;
  reaction_type: string;
}

type NoteType =
  | 'thought' | 'question' | 'impression'
  | 'opposite' | 'idea' | 'action'
  | 'decision' | 'reference';

// ── Note type config ──────────────────────────────────────────────────────────

const NOTE_TYPES: { value: NoteType; label: string; emoji: string }[] = [
  { value: 'thought',    label: '내 생각',       emoji: '💭' },
  { value: 'question',   label: '질문',           emoji: '❓' },
  { value: 'impression', label: '인상 깊은 문장', emoji: '✨' },
  { value: 'opposite',   label: '반대 의견',      emoji: '⚡' },
  { value: 'idea',       label: '아이디어',       emoji: '💡' },
  { value: 'action',     label: '실천할 점',      emoji: '🎯' },
  { value: 'decision',   label: '결정 사항',      emoji: '✅' },
  { value: 'reference',  label: '참고 자료',      emoji: '📎' },
];

function getNoteTypeMeta(type: NoteType) {
  return NOTE_TYPES.find(t => t.value === type) ?? NOTE_TYPES[0];
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

function mockGetNotes(meetingId: string): Note[] {
  return JSON.parse(localStorage.getItem(`mindweave_mock_notes_${meetingId}`) || '[]');
}
function mockSaveNotes(meetingId: string, notes: Note[]) {
  localStorage.setItem(`mindweave_mock_notes_${meetingId}`, JSON.stringify(notes));
}

type ReactionsMap = Record<string, Reaction[]>;

function mockGetReactions(meetingId: string): ReactionsMap {
  return JSON.parse(localStorage.getItem(`mindweave_mock_reactions_${meetingId}`) || '{}');
}
function mockSaveReactions(meetingId: string, reactions: ReactionsMap) {
  localStorage.setItem(`mindweave_mock_reactions_${meetingId}`, JSON.stringify(reactions));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MeetingRoom({ params }: { params: Promise<{ meetingId: string }> }) {
  const router = useRouter();
  const { meetingId } = use(params);

  const [session] = useState<UserSession | null>(() => getLocalSession());
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [reactions, setReactions] = useState<ReactionsMap>({});

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [isEditingMeeting, setIsEditingMeeting] = useState(false);
  const [editMeetingForm, setEditMeetingForm] = useState({ title: '', topic: '', description: '' });
  const [isSavingMeeting, setIsSavingMeeting] = useState(false);

  // Input
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('thought');
  const [isSending, setIsSending] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filter & Edit
  const [activeFilter, setActiveFilter] = useState<NoteType | 'all'>('all');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // Sidebar - reserved for future use
  // const [sidebarOpen, setSidebarOpen] = useState(false);

  const feedBottomRef = useRef<HTMLDivElement>(null);

  const [isMeetingCreator, setIsMeetingCreator] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async (showIndicator = false) => {
    if (!meetingId) return;
    if (showIndicator) setIsRefreshing(true);

    try {
      if (!isSupabaseConfigured) {
        const all: Meeting[] = JSON.parse(localStorage.getItem('mindweave_mock_meetings') || '[]');
        const found = all.find(m => m.id === meetingId);
        if (!found) { setErrorMsg('모임을 찾을 수 없습니다.'); return; }
        setMeeting(found);
        setIsMeetingCreator(found.created_by === session?.id);
        setParticipants(JSON.parse(localStorage.getItem(`mindweave_mock_participants_${meetingId}`) || '[]'));
        setNotes(mockGetNotes(meetingId));
        setReactions(mockGetReactions(meetingId));
        return;
      }

      const res = await apiFetch(`/api/meetings/${meetingId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '데이터 로드 실패');

      setMeeting(data.meeting);
      setParticipants(data.participants || []);
      setNotes(data.notes || []);
      setIsMeetingCreator(Boolean(data.isMeetingCreator));

      // Build reactions map
      const reactionMap: ReactionsMap = {};
      for (const r of data.reactions || []) {
        if (!reactionMap[r.note_id]) reactionMap[r.note_id] = [];
        reactionMap[r.note_id].push(r);
      }
      setReactions(reactionMap);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '데이터 로드 실패');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [meetingId, session]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!session) { router.push('/'); }
  }, [session, router]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (session) fetchData(); }, [session, fetchData]);

  // Realtime + polling
  useEffect(() => {
    if (!session || !meetingId) return;

    if (isSupabaseConfigured) {
      const interval = setInterval(() => fetchData(), 5000);
      const channel = supabase
        .channel(`room-${meetingId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `meeting_id=eq.${meetingId}` }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_participants', filter: `meeting_id=eq.${meetingId}` }, () => fetchData())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meetings', filter: `id=eq.${meetingId}` }, () => fetchData())
        .subscribe();
      return () => { clearInterval(interval); supabase.removeChannel(channel); };
    } else {
      const interval = setInterval(() => fetchData(), 3000);
      return () => clearInterval(interval);
    }
  }, [session, meetingId, fetchData]);

  // Auto-scroll
  useEffect(() => {
    feedBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notes.length]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [content]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCopyLink = () => {
    if (!meeting) return;
    navigator.clipboard.writeText(`${window.location.origin}/join/${meeting.invite_code}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleSendNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !session || !meeting || meeting.status === 'closed') return;
    setIsSending(true);

    const tempId = `temp_${Date.now()}`;
    const tempNote: Note = {
      id: tempId,
      meeting_id: meetingId,
      author_id: session.id,
      author_name: session.name,
      note_type: noteType,
      content: content.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setNotes(prev => [...prev, tempNote]);
    setContent('');
    setTypeDropdownOpen(false);

    try {
      if (!isSupabaseConfigured) {
        const finalNote = { ...tempNote, id: `mock_note_${Date.now()}` };
        const existing = mockGetNotes(meetingId);
        mockSaveNotes(meetingId, [...existing, finalNote]);
        setNotes(prev => prev.map(n => n.id === tempId ? finalNote : n));
        return;
      }

      const res = await apiFetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId, authorName: session.name, noteType, content: tempNote.content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNotes(prev => prev.map(n => n.id === tempId ? data.note : n));
    } catch {
      setNotes(prev => prev.filter(n => n.id !== tempId));
      setContent(tempNote.content);
    } finally {
      setIsSending(false);
    }
  };

  const handleStartEdit = (note: Note) => {
    setEditingNoteId(note.id);
    setEditingContent(note.content);
  };

  const handleSaveEdit = async (noteId: string) => {
    if (!session || !editingContent.trim()) return;
    const original = notes.find(n => n.id === noteId);
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, content: editingContent.trim() } : n));
    setEditingNoteId(null);

    try {
      if (!isSupabaseConfigured) {
        const updated = mockGetNotes(meetingId).map(n =>
          n.id === noteId ? { ...n, content: editingContent.trim(), updated_at: new Date().toISOString() } : n
        );
        mockSaveNotes(meetingId, updated);
        return;
      }
      const res = await apiFetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingContent.trim() }),
      });
      if (!res.ok) throw new Error('수정 실패');
    } catch {
      if (original) setNotes(prev => prev.map(n => n.id === noteId ? original : n));
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!session) return;
    const original = notes.find(n => n.id === noteId);
    setNotes(prev => prev.filter(n => n.id !== noteId));

    try {
      if (!isSupabaseConfigured) {
        mockSaveNotes(meetingId, mockGetNotes(meetingId).filter(n => n.id !== noteId));
        return;
      }
      await apiFetch(`/api/notes/${noteId}`, { method: 'DELETE' });
    } catch {
      if (original) setNotes(prev => [...prev, original].sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ));
    }
  };

  const handleToggleReaction = async (noteId: string) => {
    if (!session) return;

    const existing = reactions[noteId] || [];
    const hasReacted = existing.some(r => r.user_id === session.id);

    // Optimistic update
    setReactions(prev => {
      const cur = prev[noteId] || [];
      if (hasReacted) {
        return { ...prev, [noteId]: cur.filter(r => r.user_id !== session.id) };
      } else {
        return { ...prev, [noteId]: [...cur, { note_id: noteId, user_id: session.id, user_name: session.name, reaction_type: 'like' }] };
      }
    });

    try {
      if (!isSupabaseConfigured) {
        const reactionMap = mockGetReactions(meetingId);
        const cur = reactionMap[noteId] || [];
        if (hasReacted) {
          reactionMap[noteId] = cur.filter(r => r.user_id !== session.id);
        } else {
          reactionMap[noteId] = [...cur, { note_id: noteId, user_id: session.id, user_name: session.name, reaction_type: 'like' }];
        }
        mockSaveReactions(meetingId, reactionMap);
        return;
      }

      await apiFetch(`/api/notes/${noteId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactionType: 'like' }),
      });
    } catch {
      // Rollback
      setReactions(prev => {
        const cur = prev[noteId] || [];
        if (hasReacted) {
          return { ...prev, [noteId]: [...cur, { note_id: noteId, user_id: session.id, user_name: session.name, reaction_type: 'like' }] };
        } else {
          return { ...prev, [noteId]: cur.filter(r => r.user_id !== session.id) };
        }
      });
    }
  };

  const handleCloseMeeting = async () => {
    if (!session || !meeting) return;
    setIsClosing(true);

    try {
      if (!isSupabaseConfigured) {
        const all: Meeting[] = JSON.parse(localStorage.getItem('mindweave_mock_meetings') || '[]');
        const updated = all.map(m => m.id === meetingId ? { ...m, status: 'closed' } : m);
        localStorage.setItem('mindweave_mock_meetings', JSON.stringify(updated));
        setMeeting(prev => prev ? { ...prev, status: 'closed' } : prev);
        setShowCloseConfirm(false);
        return;
      }

      const res = await apiFetch(`/api/meetings/${meetingId}/close`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      });
      if (!res.ok) throw new Error('종료 실패');
      setMeeting(prev => prev ? { ...prev, status: 'closed' } : prev);
      setShowCloseConfirm(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '종료 실패');
    } finally {
      setIsClosing(false);
    }
  };

  const handleOpenEditMeeting = () => {
    if (!meeting) return;
    setEditMeetingForm({ title: meeting.title, topic: meeting.topic || '', description: meeting.description || '' });
    setIsEditingMeeting(true);
  };

  const handleSaveMeeting = async () => {
    if (!session || !meeting || !editMeetingForm.title.trim() || !editMeetingForm.topic.trim()) return;
    setIsSavingMeeting(true);

    try {
      if (!isSupabaseConfigured) {
        const all: Meeting[] = JSON.parse(localStorage.getItem('mindweave_mock_meetings') || '[]');
        const updated = all.map(m => m.id === meetingId ? { ...m, title: editMeetingForm.title, topic: editMeetingForm.topic, description: editMeetingForm.description } : m);
        localStorage.setItem('mindweave_mock_meetings', JSON.stringify(updated));
        setMeeting(prev => prev ? { ...prev, title: editMeetingForm.title, topic: editMeetingForm.topic, description: editMeetingForm.description } : prev);
        setIsEditingMeeting(false);
        return;
      }

      const res = await apiFetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editMeetingForm),
      });
      if (!res.ok) throw new Error('수정 실패');
      
      setMeeting(prev => prev ? { ...prev, title: editMeetingForm.title, topic: editMeetingForm.topic, description: editMeetingForm.description } : prev);
      setIsEditingMeeting(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '수정 실패');
    } finally {
      setIsSavingMeeting(false);
    }
  };

  const handleDeleteMeeting = async () => {
    if (!session || !meeting) return;
    if (!confirm('이 모임을 정말 삭제하시겠습니까? (복구 불가)')) return;
    
    try {
      if (localStorage.getItem('mindweave_mock_meetings')) {
        const all = JSON.parse(localStorage.getItem('mindweave_mock_meetings') || '[]');
        localStorage.setItem('mindweave_mock_meetings', JSON.stringify(all.filter((m: Meeting) => m.id !== meetingId)));
      }
      await apiFetch(`/api/meetings/${meetingId}`, { method: 'DELETE' });
      router.push('/');
    } catch {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const isClosed = meeting?.status === 'closed';
  const isCreator = isMeetingCreator;

  const filteredNotes = activeFilter === 'all'
    ? notes
    : notes.filter(n => n.note_type === activeFilter);

  const typeCounts = NOTE_TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t.value] = notes.filter(n => n.note_type === t.value).length;
    return acc;
  }, {});

  const currentNoteTypeMeta = getNoteTypeMeta(noteType);

  useUpdateActivity(
    `meeting-in-progress-${meetingId}`,
    isLoading || Boolean(meeting && meeting.status !== 'closed'),
  );
  useUpdateActivity(
    `meeting-draft-${meetingId}`,
    Boolean(content.trim() || editingNoteId || isSending || isSavingMeeting || isClosing),
  );

  // ── States ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2C4D46] border-t-transparent" />
          <p className="text-xs text-zinc-400 font-medium">모임 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !meeting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6] p-6">
        <div className="max-w-md w-full text-center bg-white border border-zinc-100 p-4 sm:p-6 md:p-8 rounded-2xl shadow-sm space-y-4">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold">오류가 발생했습니다</h2>
          <p className="text-zinc-400 text-sm text-readable">{errorMsg || '모임을 불러올 수 없습니다.'}</p>
          <button onClick={() => router.push('/')} className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors">
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Background glow orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 blur-[120px] pointer-events-none rounded-full"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-secondary/10 blur-[150px] pointer-events-none rounded-full"></div>

      {showCloseConfirm && isCreator && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm mobile-page-x py-6">
          <div className="bg-surface rounded-2xl p-4 sm:p-6 max-w-sm w-full max-h-[calc(100dvh-48px)] overflow-y-auto shadow-2xl border border-outline-variant/20 space-y-4 animate-fade-in-up">
            <h3 className="font-bold text-on-surface">모임을 종료하시겠습니까?</h3>
            <p className="text-sm text-on-surface-variant text-readable">종료 후에는 새 기록을 추가할 수 없습니다. 결과 리포트를 확인할 수 있습니다.</p>
            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2 pt-2">
              <button onClick={() => setShowCloseConfirm(false)} className="w-full py-2.5 rounded-xl border border-outline-variant/30 text-sm font-semibold text-on-surface hover:bg-surface-variant transition-colors">취소</button>
              <button onClick={handleCloseMeeting} disabled={isClosing} className="w-full py-2.5 rounded-xl bg-error text-sm font-semibold text-white hover:opacity-90 transition-opacity">
                {isClosing ? '종료 중...' : '종료 확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditingMeeting && isCreator && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm mobile-page-x py-6">
          <div className="bg-surface rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 max-w-md w-full max-h-[calc(100dvh-48px)] overflow-y-auto shadow-2xl border border-outline-variant/20 space-y-5 animate-fade-in-up">
            <h3 className="font-headline-md text-on-surface">모임 정보 수정</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">모임 이름</label>
                <input value={editMeetingForm.title} onChange={e => setEditMeetingForm({...editMeetingForm, title: e.target.value})} className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary text-on-surface text-base" placeholder="모임 이름" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">주제 (선택)</label>
                <input value={editMeetingForm.topic} onChange={e => setEditMeetingForm({...editMeetingForm, topic: e.target.value})} className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary text-on-surface text-base" placeholder="주제" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">설명 (선택)</label>
                <textarea value={editMeetingForm.description} onChange={e => setEditMeetingForm({...editMeetingForm, description: e.target.value})} className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary text-on-surface text-base resize-none" placeholder="간단한 설명" rows={3} />
              </div>
            </div>
            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2 pt-2">
              <button onClick={() => setIsEditingMeeting(false)} className="w-full py-2.5 rounded-xl bg-surface-variant text-sm font-semibold text-on-surface hover:bg-surface-variant/80 transition-colors">취소</button>
              <button onClick={handleSaveMeeting} disabled={isSavingMeeting || !editMeetingForm.title.trim() || !editMeetingForm.topic.trim()} className="w-full py-2.5 rounded-xl primary-gradient-btn text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50">
                {isSavingMeeting ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-surface/40 backdrop-blur-[40px] border-b border-outline-variant/10 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center px-3 sm:px-4 md:px-gutter py-2.5 md:py-base max-w-container-max mx-auto min-h-[4.5rem] gap-2 md:gap-4">
          <Link href="/" className="text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center w-11 h-11 md:w-12 md:h-12 rounded-full hover:bg-surface-variant shrink-0" title="뒤로 가기" aria-label="뒤로 가기">
            <span className="material-symbols-outlined text-[20px] md:text-[24px]">arrow_back</span>
          </Link>
          <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
            <div className="hidden md:flex p-2 glass-card rounded-lg items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined">terminal</span>
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="font-display-lg text-[17px] md:text-[24px] text-primary leading-tight truncate">
                {meeting.title}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-nowrap overflow-hidden">
                {!isClosed ? (
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-primary shrink-0">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
                    <span className="hidden md:inline">진행 중</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-error shrink-0">종료됨</span>
                )}
                <span className="flex items-center text-[10px] uppercase tracking-widest font-medium text-on-surface-variant shrink-0">
                  <span className="material-symbols-outlined text-[12px] mr-1 md:hidden">group</span>
                  {participants.length} <span className="hidden md:inline ml-1">참여자</span>
                  <span className="md:hidden ml-0.5">명</span>
                </span>
                {!isClosed && (
                  <button onClick={handleCopyLink} className="flex items-center text-[10px] font-mono tracking-widest font-bold text-primary bg-primary/10 px-2 py-0.5 rounded transition-all hover:bg-primary/20 shrink-0">
                    <span className="material-symbols-outlined text-[12px] mr-1 md:hidden">share</span>
                    <span className="hidden md:inline">{copied ? '복사됨: ' : '코드: '}</span>{copied ? '복사됨' : meeting.invite_code}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-4 shrink-0 pl-0 sm:pl-2">
            {isClosed && (
              <Link href={`/meetings/${meetingId}/report`} className="text-primary font-bold text-xs md:text-sm bg-primary/10 px-3 py-2 md:px-4 md:py-2 rounded-full hover:bg-primary/20 transition-colors whitespace-nowrap">
                리포트
              </Link>
            )}
            {isCreator && isClosed && (
              <button onClick={handleDeleteMeeting} className="text-error hover:bg-error/10 px-3 py-2 md:px-4 md:py-2 rounded-full font-bold text-xs md:text-sm transition-colors whitespace-nowrap">
                <span className="hidden md:inline">모임 삭제</span>
                <span className="inline md:hidden">삭제</span>
              </button>
            )}
            {isCreator && !isClosed && (
              <button onClick={() => setShowCloseConfirm(true)} className="text-error hover:bg-error/10 px-3 py-2 md:px-4 md:py-2 rounded-full font-bold text-xs md:text-sm transition-colors whitespace-nowrap">
                <span className="hidden md:inline">모임 종료</span>
                <span className="inline md:hidden">종료</span>
              </button>
            )}
            <button onClick={() => fetchData(true)} disabled={isRefreshing} className="hidden md:flex text-on-surface-variant hover:text-primary transition-colors items-center justify-center w-11 h-11 md:w-12 md:h-12" title="동기화">
              <span className={`material-symbols-outlined text-[20px] md:text-[24px] ${isRefreshing ? 'animate-spin' : ''}`}>sync</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col md:flex-row max-w-container-max mx-auto w-full pt-24 md:pt-28 pb-[calc(8.5rem+env(safe-area-inset-bottom))] md:pb-[calc(11rem+env(safe-area-inset-bottom))] px-3 sm:px-4 md:px-gutter gap-4 md:gap-6 min-h-screen relative">
        
        {/* Left Column: Notes */}
        <main className="flex-1 min-w-0">
          
          {/* Topic Banner */}
          <div className="glass-card p-3 md:p-4 rounded-xl md:rounded-2xl mb-4 md:mb-8 flex items-start gap-2 md:gap-3 border-l-4 border-primary/50 relative group">
            <span className="material-symbols-outlined text-primary text-[20px] md:text-[24px] shrink-0 mt-0.5 md:mt-0">topic</span>
            <div className="flex-grow min-w-0 pr-6 md:pr-10">
              <p className="text-[10px] uppercase font-bold text-primary tracking-widest mb-1">주제</p>
              <p className="text-base md:text-sm text-on-surface text-readable font-medium md:font-normal">{meeting.topic}</p>
              {meeting.description && <p className="text-sm text-on-surface-variant mt-1.5 md:mt-2 text-readable">{meeting.description}</p>}
            </div>
            {isCreator && !isClosed && (
              <button 
                onClick={handleOpenEditMeeting} 
                className="absolute top-3 right-3 md:top-4 md:right-4 opacity-50 hover:opacity-100 hover:bg-primary/10 text-primary p-2 rounded-full min-w-[44px] min-h-[44px] transition-all flex items-center justify-center"
                title="정보 수정"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className="flex overflow-x-auto gap-2 mb-4 md:mb-8 pb-2 custom-scrollbar -mx-3 px-3 md:mx-0 md:px-0 md:flex-wrap snap-x" aria-label="기록 유형 필터">
            <button onClick={() => setActiveFilter('all')} className={`shrink-0 snap-start whitespace-nowrap px-3 md:px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${activeFilter === 'all' ? 'bg-primary text-on-primary border border-primary' : 'glass-card text-on-surface-variant hover:text-on-surface'}`}>
              전체 {notes.length > 0 && <span className="opacity-70 ml-1">{notes.length}</span>}
            </button>
            {NOTE_TYPES.map(t => (
              <button key={t.value} onClick={() => setActiveFilter(t.value)} className={`shrink-0 snap-start whitespace-nowrap px-3 md:px-4 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 ${activeFilter === t.value ? 'bg-primary text-on-primary border border-primary' : 'glass-card text-on-surface-variant hover:text-on-surface'}`}>
                <span>{t.emoji}</span> <span className="md:inline">{t.label}</span>
                {typeCounts[t.value] > 0 && <span className="opacity-70 ml-1">{typeCounts[t.value]}</span>}
              </button>
            ))}
          </div>

          {/* Feed */}
          <div className="space-y-6 flex flex-col">
            {filteredNotes.length === 0 ? (
              <div className="glass-card p-6 sm:p-10 md:p-12 rounded-2xl md:rounded-3xl flex flex-col items-center justify-center text-center opacity-70 mt-4 max-w-lg mx-auto">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 opacity-50">edit_note</span>
                <p className="text-on-surface font-bold text-lg mb-2">기록이 없습니다</p>
                <p className="text-on-surface-variant text-sm">첫 번째 생각을 입력해 시작해 보세요.</p>
              </div>
            ) : (
              filteredNotes.map(note => {
                const isOwn = session?.id === note.author_id;
                const meta = getNoteTypeMeta(note.note_type);
                const rCount = reactions[note.id]?.length || 0;
                const hasReacted = session ? (reactions[note.id] || []).some(r => r.user_id === session.id) : false;
                const isEditing = editingNoteId === note.id;

                return (
                  <div key={note.id} className={`flex gap-2.5 md:gap-4 max-w-3xl w-full sm:w-auto ${isOwn ? 'self-end flex-row-reverse' : 'self-start'}`}>
                    <div className="flex-shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-full bg-surface-variant border border-outline-variant/20 flex items-center justify-center font-bold text-on-surface uppercase shadow-md text-xs md:text-base">
                      {note.author_name.slice(0,1)}
                    </div>
                    <div className={`flex flex-col gap-1 md:gap-1.5 min-w-0 ${isOwn ? 'items-end' : 'items-start'} max-w-full`}>
                      <div className={`flex items-center gap-1.5 md:gap-2 flex-wrap ${isOwn ? 'flex-row-reverse' : ''}`}>
                        <span className="font-bold text-on-surface text-xs md:text-sm max-w-[10rem] truncate">{note.author_name}</span>
                        <span className="text-[9px] md:text-[10px] text-primary font-bold uppercase px-1.5 md:px-2 py-0.5 rounded border border-primary/20 bg-primary/10 tracking-widest">{meta.label}</span>
                        <span className="text-[9px] md:text-[10px] text-on-surface-variant font-mono">{new Date(note.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      
                      <div className={`glass-card p-3 md:p-4 shadow-lg w-full ${isOwn ? 'rounded-tl-xl rounded-bl-xl rounded-br-xl md:rounded-tl-2xl md:rounded-bl-2xl md:rounded-br-2xl bg-primary/5 border-primary/20' : 'rounded-tr-xl rounded-br-xl rounded-bl-xl md:rounded-tr-2xl md:rounded-br-2xl md:rounded-bl-2xl'}`}>
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              autoFocus
                              value={editingContent}
                              onChange={e => setEditingContent(e.target.value)}
                              className="w-full rounded-xl border border-primary/30 bg-surface px-3 py-2 text-base text-on-surface focus:outline-none focus:border-primary transition-all"
                              rows={3}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveEdit(note.id);
                                if (e.key === 'Escape') setEditingNoteId(null);
                              }}
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <button onClick={() => handleSaveEdit(note.id)} className="px-3 py-2 rounded-lg bg-primary text-on-primary text-sm font-bold hover:bg-primary/90 transition-colors">저장</button>
                              <button onClick={() => setEditingNoteId(null)} className="px-3 py-2 rounded-lg bg-surface-variant text-on-surface-variant text-sm font-bold hover:text-on-surface transition-colors">취소</button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-on-surface whitespace-pre-wrap text-[15px] md:text-[15px] text-readable">{renderFormattedText(note.content)}</p>
                        )}
                      </div>

                      <div className={`flex gap-2 md:gap-3 mt-1 px-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                        <button onClick={() => handleToggleReaction(note.id)} disabled={isClosed && !isOwn} className={`text-xs font-bold flex items-center gap-1.5 transition-colors ${hasReacted ? 'text-primary bg-primary/10 px-2 py-1 rounded-full' : 'text-on-surface-variant hover:text-primary px-2 py-1 rounded-full hover:bg-surface-variant'}`}>
                          <span className="material-symbols-outlined text-[14px] md:text-[16px]" style={{fontVariationSettings: hasReacted ? "'FILL' 1" : "'FILL' 0"}}>thumb_up</span>
                          {rCount > 0 && rCount}
                        </button>
                        {isOwn && !isClosed && !isEditing && (
                          <>
                            <button onClick={() => handleStartEdit(note)} className="text-xs text-on-surface-variant opacity-70 hover:opacity-100 flex items-center gap-1 transition-opacity p-1">
                              <span className="material-symbols-outlined text-[14px] md:text-[16px]">edit</span>
                            </button>
                            <button onClick={() => handleDeleteNote(note.id)} className="text-xs text-error opacity-70 hover:opacity-100 flex items-center gap-1 transition-opacity p-1">
                              <span className="material-symbols-outlined text-[14px] md:text-[16px]">delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={feedBottomRef} />
          </div>
        </main>

        {/* Right Column: Sidebar (Desktop only or togglable) */}
        <aside className="hidden lg:flex flex-col gap-4 w-64 shrink-0">
          <div className="glass-card p-5 rounded-2xl flex flex-col gap-4 sticky top-28">
            <span className="font-label-caps text-on-surface-variant tracking-widest uppercase text-[10px]">참여자 ({participants.length})</span>
            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {participants.map(p => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center font-bold text-xs text-on-surface uppercase">
                    {p.display_name.slice(0, 1)}
                  </div>
                  <span className="text-sm font-semibold text-on-surface truncate">{p.display_name}</span>
                  {p.user_id === meeting.created_by && (
                    <span className="ml-auto text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase tracking-wider">방장</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile note-type picker */}
      {typeDropdownOpen && !isClosed && (
        <div className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm md:hidden" onClick={() => setTypeDropdownOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-type-title"
            className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] rounded-3xl border border-outline-variant/30 bg-surface-container-highest p-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p id="note-type-title" className="font-bold text-on-surface">기록 유형 선택</p>
                <p className="mt-0.5 text-xs text-on-surface-variant">작성할 생각에 가장 잘 맞는 유형을 골라주세요.</p>
              </div>
              <button type="button" onClick={() => setTypeDropdownOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-variant" aria-label="닫기">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {NOTE_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => { setNoteType(t.value); setTypeDropdownOpen(false); }} className={`min-w-0 rounded-xl px-3 py-3 text-left text-sm flex gap-2 items-center transition-colors ${noteType === t.value ? 'text-primary bg-primary/15 ring-1 ring-primary/40' : 'text-on-surface bg-surface/60 hover:bg-surface-variant'}`}>
                  <span className="text-lg shrink-0">{t.emoji}</span>
                  <span className="font-bold truncate">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Footer */}
      {!isClosed && (
        <footer className="fixed bottom-0 w-full z-50 p-2 pb-[calc(env(safe-area-inset-bottom)+8px)] md:p-4 md:pb-[calc(env(safe-area-inset-bottom)+32px)]">
          <form onSubmit={handleSendNote} className="max-w-4xl mx-auto w-full glass-card-elevated rounded-[20px] md:rounded-[32px] p-1.5 md:p-2 flex items-end gap-1.5 md:gap-2 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] bg-surface/90 backdrop-blur-2xl border border-outline-variant/30">
            <div className="flex-grow min-w-0 px-3 py-2 md:px-4 md:py-3 relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSendNote(e as React.FormEvent); }}
                className="w-full bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-on-surface-variant/50 text-base resize-none max-h-32 outline-none"
                placeholder="생각을 입력하세요…"
                rows={1}
              />
            </div>
            <div className="p-1 sm:p-2 flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className="relative">
                <button type="button" onClick={() => setTypeDropdownOpen(!typeDropdownOpen)} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors text-primary border border-primary/20 bg-primary/5 shadow-sm" aria-label={`기록 유형: ${currentNoteTypeMeta.label}`} aria-expanded={typeDropdownOpen}>
                  <span className="text-lg">{currentNoteTypeMeta.emoji}</span>
                </button>
                {typeDropdownOpen && (
                  <div className="hidden md:block absolute bottom-full right-0 mb-4 bg-surface-container-highest border border-outline-variant/20 rounded-2xl shadow-2xl overflow-hidden z-[100] w-56 py-2">
                    {NOTE_TYPES.map(t => (
                      <button key={t.value} type="button" onClick={() => { setNoteType(t.value); setTypeDropdownOpen(false); }} className={`w-full whitespace-nowrap text-left px-4 py-3 hover:bg-surface-variant text-sm flex gap-3 items-center transition-colors ${noteType === t.value ? 'text-primary bg-primary/10' : 'text-on-surface'}`}>
                        <span className="text-lg">{t.emoji}</span> <span className="font-bold">{t.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" disabled={!content.trim() || isSending} className="primary-gradient-btn text-white min-h-11 h-11 px-4 sm:px-5 rounded-full font-bold flex items-center justify-center gap-2 hover:scale-[0.98] active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed">
                <span className="hidden md:inline">{isSending ? '저장 중' : '전송'}</span>
                <span className="material-symbols-outlined text-[18px]">send</span>
              </button>
            </div>
          </form>
        </footer>
      )}
    </>
  );
}
