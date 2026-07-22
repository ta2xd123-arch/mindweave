'use client';
import { apiFetch } from '@/lib/api-client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getLocalSession, UserSession } from '@/lib/auth';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { ArrowLeft, BookOpen, Calendar, Save } from 'lucide-react';
import Link from 'next/link';

export default function NewMeeting() {
  const router = useRouter();
  const [session] = useState<UserSession | null>(() => {
    const s = getLocalSession();
    if (!s && typeof window !== 'undefined') {
      // will redirect in useEffect
    }
    return s;
  });
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
  });
  const [maxParticipants] = useState<number>(20);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [canCreateMeeting, setCanCreateMeeting] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!session) {
      router.push('/');
      return;
    }

    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setCanCreateMeeting(true);
      } else {
        setErrorMsg('모임 개설은 모임장 로그인 후 이용할 수 있습니다.');
      }
    });
  }, [session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !topic.trim() || !session || !canCreateMeeting) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const meetingData = {
        title: title.trim(),
        topic: topic.trim(),
        description: description.trim(),
        meetingDate: date ? new Date(date).toISOString() : new Date().toISOString(),
        maxParticipants,
        userName: session.name,
      };

      if (!isSupabaseConfigured) {
        // Mock Mode: Save to local storage mock meetings list
        const mockMeetingsStr = localStorage.getItem('mindweave_mock_meetings') || '[]';
        const mockMeetings = JSON.parse(mockMeetingsStr);
        
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let inviteCode = '';
        for (let i = 0; i < 6; i++) {
          inviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const mockMeeting = {
          id: `mock_${Date.now()}`,
          title: meetingData.title,
          topic: meetingData.topic,
          description: meetingData.description,
          meeting_date: meetingData.meetingDate,
          invite_code: inviteCode,
          max_participants: maxParticipants,
          created_by: session.id,
          created_at: new Date().toISOString(),
        };

        mockMeetings.unshift(mockMeeting);
        localStorage.setItem('mindweave_mock_meetings', JSON.stringify(mockMeetings));
        
        // Mock Participant list update
        const mockPartsKey = `mindweave_mock_participants_${mockMeeting.id}`;
        localStorage.setItem(mockPartsKey, JSON.stringify([
          {
            id: `part_${Date.now()}`,
            meeting_id: mockMeeting.id,
            user_id: session.id,
            display_name: session.name,
            joined_at: new Date().toISOString()
          }
        ]));

        router.push(`/meetings/${mockMeeting.id}`);
        return;
      }

      // Real Mode
      const res = await apiFetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meetingData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '모임 생성에 실패했습니다.');
      }

      router.push(`/meetings/${data.meeting.id}`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '모임 생성 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-zinc-800 flex flex-col font-sans">
      <header className="sticky top-0 z-10 border-b border-zinc-100 bg-white/80 backdrop-blur-md mobile-page-x py-3 sm:py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 transition-colors text-sm font-semibold">
            <ArrowLeft className="h-4 w-4" />
            <span>대시보드</span>
          </Link>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#2C4D46]" />
            <span className="font-bold tracking-tight text-sm text-zinc-950">MINDWEAVE</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto mobile-page-x py-6 sm:py-10">
        <div className="bg-white rounded-2xl border border-zinc-100 p-4 sm:p-6 md:p-8 shadow-sm space-y-6">
          <div>
            <h2 className="text-2xl sm:text-xl font-bold text-zinc-900 text-readable">새 모임 만들기</h2>
            <p className="text-zinc-500 text-sm mt-1 text-readable">
              참여자들이 생각을 나눌 수 있도록 모임의 기본 정보와 토론 주제를 작성해 주세요.
            </p>
          </div>
          {!canCreateMeeting && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 text-readable">
              모임 개설은 모임장 로그인 후 이용할 수 있습니다. <Link href="/" className="font-semibold underline">로그인으로 이동</Link>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="title" className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                모임 이름
              </label>
              <input
                id="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 7월 독서모임 - 데미안"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-zinc-800 placeholder-zinc-400 focus:border-[#3E5F58] focus:bg-white focus:outline-none transition-all duration-200 text-base"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="topic" className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                오늘의 주제 / 질문
              </label>
              <input
                id="topic"
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="예: 내가 생각하는 '익숙한 세계를 깨는 성장'이란 무엇인가?"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-zinc-800 placeholder-zinc-400 focus:border-[#3E5F58] focus:bg-white focus:outline-none transition-all duration-200 text-base"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="date" className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                  모임 진행 일시
                </label>
                <div className="relative">
                  <input
                    id="date"
                    type="datetime-local"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-10 pr-4 py-3 text-zinc-800 placeholder-zinc-400 focus:border-[#3E5F58] focus:bg-white focus:outline-none transition-all duration-200 text-base"
                  />
                  <Calendar className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                모임 상세 설명
              </label>
              <textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="모임 참여자들에게 전달할 안내 내용이나 질문 배경을 적어주세요."
                className="w-full min-h-32 rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-zinc-800 placeholder-zinc-400 focus:border-[#3E5F58] focus:bg-white focus:outline-none transition-all duration-200 text-base resize-none"
              />
            </div>

            {errorMsg && <p className="text-red-500 text-sm font-semibold text-readable">{errorMsg}</p>}

            <button
              type="submit"
              disabled={isSubmitting || !canCreateMeeting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2C4D46] py-3.5 font-semibold text-white hover:bg-[#3D665D] transition-colors shadow-sm disabled:opacity-60 text-base"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? '모임 개설 중...' : '모임 개설하기'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
