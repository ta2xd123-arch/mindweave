'use client';
import { apiFetch } from '@/lib/api-client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { getLocalSession, saveSession, saveGuestSession, UserSession } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { BookOpen, Users, Clock, LogIn, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface MeetingDetails {
  id: string;
  title: string;
  topic: string;
  description: string;
  meeting_date: string;
  status?: string;
  max_participants?: number;
  current_participants?: number;
}

export default function JoinMeeting({ params }: { params: Promise<{ inviteCode: string }> }) {
  const router = useRouter();
  const { inviteCode } = use(params);

  const [session, setSession] = useState<UserSession | null>(null);
  const [meeting, setMeeting] = useState<MeetingDetails | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isMockMode, setIsMockMode] = useState(false);

  // 1. Check local session and fetch meeting info
  useEffect(() => {
    const activeSession = getLocalSession();
    setSession(activeSession);
    if (activeSession) {
      setNameInput(activeSession.name);
    }

    async function fetchMeetingDetails() {
      if (!inviteCode) return;

      try {
        if (!isSupabaseConfigured) {
          // Mock mode
          setIsMockMode(true);
          const mockMeetingsStr = localStorage.getItem('mindweave_mock_meetings') || '[]';
          const mockMeetings = JSON.parse(mockMeetingsStr);
          const found = mockMeetings.find((m: any) => m.invite_code === inviteCode.toUpperCase());
          
          if (!found) {
            setErrorMsg('초대 코드가 유효하지 않습니다. (Supabase 미연결 상태의 모의 데이터입니다)');
            setIsLoading(false);
            return;
          }

          setMeeting({
            id: found.id,
            title: found.title,
            topic: found.topic,
            description: found.description || '',
            meeting_date: found.meeting_date || found.created_at,
          });
          setIsLoading(false);
          return;
        }

        // Real Mode
        const res = await apiFetch(`/api/meetings/join?inviteCode=${inviteCode}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || '모임 정보를 불러오지 못했습니다.');
        }

        setMeeting(data.meeting);
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || '모임 정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchMeetingDetails();
  }, [inviteCode]);

  // 2. Handle joining the meeting
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim() || !inviteCode) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      if (!isSupabaseConfigured) {
        const activeSession = await saveSession(nameInput.trim());
        // Mock Mode: update mock participants
        const mockPartsKey = `mindweave_mock_participants_${meeting?.id}`;
        const mockParticipants = JSON.parse(localStorage.getItem(mockPartsKey) || '[]');
        
        // Avoid duplicate joining
        if (!mockParticipants.some((p: any) => p.user_id === activeSession.id)) {
          mockParticipants.push({
            id: `part_${Date.now()}`,
            meeting_id: meeting?.id,
            user_id: activeSession.id,
            display_name: activeSession.name,
            joined_at: new Date().toISOString()
          });
          localStorage.setItem(mockPartsKey, JSON.stringify(mockParticipants));
        }

        // Add to user's personal mock meetings list if not exists
        const userMockMKey = 'mindweave_mock_meetings';
        const userMockMeetings = JSON.parse(localStorage.getItem(userMockMKey) || '[]');
        if (!userMockMeetings.some((m: any) => m.id === meeting?.id) && meeting) {
          const mockMeetingsStr = localStorage.getItem('mindweave_mock_meetings') || '[]';
          const allMockMeetings = JSON.parse(mockMeetingsStr);
          const originalMock = allMockMeetings.find((m: any) => m.id === meeting.id);
          if (originalMock) {
            userMockMeetings.unshift(originalMock);
            localStorage.setItem(userMockMKey, JSON.stringify(userMockMeetings));
          }
        }

        router.push(`/meetings/${meeting?.id}`);
        return;
      }

      // Real Mode
      const res = await apiFetch('/api/meetings/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: inviteCode.toUpperCase().trim(),
          userName: nameInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '모임 참여에 실패했습니다.');
      }

      // If they joined as a guest, we save the guest token
      // If they joined as owner, data.guestToken will be null and we can just sync the name
      if (data.guestToken) {
        saveGuestSession({
          id: data.participantId,
          name: nameInput.trim(),
          role: 'guest',
          guestToken: data.guestToken,
          meetingId: data.meetingId
        });
      } else {
        await saveSession(nameInput.trim());
      }

      router.push(`/meetings/${data.meetingId}`);
    } catch (err: any) {
      setErrorMsg(err.message || '참여하는 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#3E5F58] border-t-transparent"></div>
      </div>
    );
  }

  if (errorMsg || !meeting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6] p-6 text-zinc-800">
        <div className="max-w-md w-full text-center bg-white border border-zinc-100 p-8 rounded-2xl shadow-sm space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-zinc-950">참여가 불가능합니다</h2>
          <p className="text-zinc-500 text-sm leading-relaxed">{errorMsg || '해당 모임을 찾을 수 없습니다.'}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full rounded-xl bg-zinc-950 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
          >
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF9F6] p-4 text-zinc-800">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-zinc-100 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F0EE] text-[#2C4D46] mb-3">
            <Users className="h-5 w-5" />
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">모임 초대장</span>
          <h1 className="text-xl font-bold text-zinc-900 mt-1">{meeting.title}</h1>
        </div>

        {/* Meeting details */}
        <div className="bg-[#FAF9F6] border border-zinc-50 p-4 rounded-xl space-y-3">
          <div>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">토론 주제</span>
            <p className="text-zinc-800 text-xs font-semibold mt-0.5">{meeting.topic}</p>
          </div>
          {meeting.description && (
            <div>
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">모임 안내</span>
              <p className="text-zinc-500 text-[11px] mt-0.5 leading-relaxed">{meeting.description}</p>
            </div>
          )}
          <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-medium pt-1 border-t border-zinc-100">
            <Clock className="h-3 w-3" />
            <span>진행 일시: {new Date(meeting.meeting_date).toLocaleString()}</span>
          </div>
        </div>

        {isMockMode && (
          <div className="flex gap-2 rounded-xl bg-amber-50 p-3.5 text-xs text-amber-800 border border-amber-100">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">로컬 미리보기 상태</span>
              Supabase 미연결로 로컬 저장소 상의 가상 모임에 참여합니다.
            </div>
          </div>
        )}

        {/* Name input & Join Form */}
                      {meeting.status === 'closed' ? (
                <div className="text-center p-4 bg-error/10 text-error rounded-xl font-bold border border-error/20">
                  <span className="material-symbols-outlined block text-2xl mb-1">cancel</span>
                  이미 종료된 모임입니다.
                </div>
              ) : meeting.max_participants && meeting.current_participants && meeting.current_participants >= meeting.max_participants && !session ? (
                <div className="text-center p-4 bg-error/10 text-error rounded-xl font-bold border border-error/20">
                  <span className="material-symbols-outlined block text-2xl mb-1">group_off</span>
                  인원이 가득 찼습니다.
                </div>
              ) : (
                <form onSubmit={handleJoin} className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold text-on-surface mb-2 pl-1">
                      {session ? '참여자 이름 (수정 가능)' : '참여할 이름을 입력하세요'}
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">person</span>
                      </div>
                      <input
                        type="text"
                        id="name"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="w-full bg-surface-container border border-outline-variant/30 rounded-2xl pl-11 pr-4 py-3.5 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all font-medium"
                        placeholder="예: 홍길동"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!nameInput.trim() || isSubmitting}
                    className={`w-full primary-gradient-btn text-white font-bold py-3.5 md:py-4 px-6 rounded-2xl transition-all shadow-lg flex justify-center items-center gap-2 group ${
                      (!nameInput.trim() || isSubmitting) ? 'opacity-50 cursor-not-allowed transform-none shadow-none' : 'hover:shadow-xl hover:-translate-y-0.5'
                    }`}
                  >
                    {isSubmitting ? (
                      <span className="material-symbols-outlined animate-spin">refresh</span>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-1">login</span>
                        <span>모임 입장하기</span>
                      </>
                    )}
                  </button>
                </form>
              )}

        <div className="text-center">
          <Link href="/" className="text-[11px] font-semibold text-[#2C4D46] hover:underline">
            대시보드로 가기
          </Link>
        </div>
      </div>
    </main>
  );
}

