'use client';
import { apiFetch } from '@/lib/api-client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getLocalSession, UserSession } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ArrowLeft, BookOpen, Calendar, HelpCircle, Save } from 'lucide-react';
import Link from 'next/link';

export default function NewMeeting() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [maxParticipants, setMaxParticipants] = useState<number>(20);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const activeSession = getLocalSession();
    if (!activeSession) {
      router.push('/');
    } else {
      setSession(activeSession);
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !topic.trim() || !session) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const meetingData = {
        title: title.trim(),
        topic: topic.trim(),
        description: description.trim(),
        meetingDate: date ? new Date(date).toISOString() : new Date().toISOString(),
        userId: session.id,
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
    } catch (err: any) {
      setErrorMsg(err.message || '모임 생성 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-zinc-800 flex flex-col font-sans">
      <header className="sticky top-0 z-10 border-b border-zinc-100 bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
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

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl border border-zinc-100 p-8 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">새 모임 만들기</h2>
            <p className="text-zinc-500 text-xs mt-1">
              참여자들이 생각을 나눌 수 있도록 모임의 기본 정보와 토론 주제를 작성해 주세요.
            </p>
          </div>

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
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-zinc-800 placeholder-zinc-400 focus:border-[#3E5F58] focus:bg-white focus:outline-none transition-all duration-200 text-sm"
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
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-zinc-800 placeholder-zinc-400 focus:border-[#3E5F58] focus:bg-white focus:outline-none transition-all duration-200 text-sm"
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
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-10 pr-4 py-3 text-zinc-800 placeholder-zinc-400 focus:border-[#3E5F58] focus:bg-white focus:outline-none transition-all duration-200 text-sm"
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
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-zinc-800 placeholder-zinc-400 focus:border-[#3E5F58] focus:bg-white focus:outline-none transition-all duration-200 text-sm resize-none"
              />
            </div>

            {errorMsg && <p className="text-red-500 text-xs font-semibold">{errorMsg}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2C4D46] py-3.5 font-semibold text-white hover:bg-[#3D665D] transition-colors shadow-sm disabled:opacity-60 text-sm"
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
