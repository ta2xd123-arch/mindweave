'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getLocalSession, saveSession, clearSession, UserSession } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';


export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [meetings, setMeetings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const activeSession = getLocalSession();
    setSession(activeSession);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!session) return;
    const userId = session.id;

    async function fetchMeetings() {
      try {
        if (!isSupabaseConfigured) {
          const localM = localStorage.getItem('mindweave_mock_meetings') || '[]';
          setMeetings(JSON.parse(localM));
          return;
        }

        const res = await fetch(`/api/meetings?userId=${userId}`);
        if (!res.ok) throw new Error('Failed to fetch meetings');
        const data = await res.json();
        setMeetings(data.meetings || []);
      } catch (err) {
        console.error('Error fetching meetings:', err);
      }
    }

    fetchMeetings();
  }, [session]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    try {
      const newSession = await saveSession(nameInput.trim());
      setSession(newSession);
      setNameInput('');
    } catch (err) {
      console.error(err);
      setErrorMsg('로그인에 실패했습니다.');
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim() || !session) return;
    setIsJoining(true);
    setErrorMsg('');

    try {
      const cleanCode = inviteCode.toUpperCase().trim();

      if (!isSupabaseConfigured) {
        const mockMeetingsStr = localStorage.getItem('mindweave_mock_meetings') || '[]';
        const mockMeetings = JSON.parse(mockMeetingsStr);
        const found = mockMeetings.find((m: any) => m.invite_code === cleanCode);
        if (found) {
          router.push(`/meetings/${found.id}`);
        } else {
          setErrorMsg('초대 코드가 유효하지 않습니다.');
        }
        setIsJoining(false);
        return;
      }

      const res = await fetch('/api/meetings/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: cleanCode,
          userId: session.id,
          userName: session.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '모임 참여에 실패했습니다.');
      }

      router.push(`/meetings/${data.meetingId}`);
    } catch (err: any) {
      setErrorMsg(err.message || '모임 참여에 실패했습니다.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setMeetings([]);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // --- LANDING VIEW ---
  if (!session) {
    return (
      <>
        <div className="glow-orb bg-primary w-[500px] h-[500px] top-[-100px] left-[-100px]"></div>
        <div className="glow-orb bg-secondary w-[600px] h-[600px] bottom-[-200px] right-[-100px]"></div>

        <header className="fixed top-0 w-full z-50 bg-surface/40 backdrop-blur-[40px] border-b border-outline-variant/10">
          <div className="flex justify-between items-center px-gutter py-base max-w-container-max mx-auto h-20">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-fixed">terminal</span>
              <span className="font-display-lg text-[24px] tracking-tighter text-primary">MINDWEAVE</span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a className="text-primary-fixed font-bold border-b-2 border-primary-fixed py-1 transition-colors duration-300" href="#">홈</a>
              <a className="text-on-surface-variant font-medium hover:text-primary-fixed transition-colors duration-300" href="#">기능 소개</a>
              <a className="text-on-surface-variant font-medium hover:text-primary-fixed transition-colors duration-300" href="#">요금 안내</a>
              <a className="text-on-surface-variant font-medium hover:text-primary-fixed transition-colors duration-300" href="#">소개</a>
            </nav>
            <div>
              <button onClick={() => setShowLogin(!showLogin)} className="primary-gradient-btn px-6 py-2.5 rounded-full font-label-caps text-white">시작하기</button>
            </div>
          </div>
        </header>

        <main>
          <section className="relative pt-48 pb-section-padding-mobile md:pb-section-padding-desktop px-gutter max-w-container-max mx-auto text-center overflow-hidden">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full glass-card mb-8">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label-caps text-on-surface-variant text-[11px]">V2.0 업데이트 완료</span>
            </div>
            <h1 className="font-display-lg-mobile md:font-display-lg text-on-surface mb-6 max-w-4xl mx-auto leading-tight">
              아이디어를 연결하는 <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">AI 협업 플랫폼</span>
            </h1>
            <p className="font-body-lg text-on-surface-variant max-w-2xl mx-auto mb-10">
              회의 기록부터 AI 인사이트 도출까지, 팀의 지식 자산을 새롭게 정의하십시오. <br className="hidden md:block"/>
              MINDWEAVE는 모두의 생각이 하나로 모이는 혁신적인 협업 공간을 제공합니다.
            </p>

            {showLogin ? (
              <form onSubmit={handleLogin} className="glass-card max-w-md mx-auto p-6 rounded-2xl animate-fade-in-up">
                <div className="mb-4 text-left">
                  <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-primary mb-2">
                    이름 / 닉네임 입력
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="홍길동"
                    className="w-full rounded-xl border border-outline-variant/30 bg-surface/50 px-4 py-3 text-on-surface placeholder-on-surface-variant focus:border-primary focus:bg-surface focus:outline-none transition-all duration-200"
                  />
                </div>
                {errorMsg && <p className="text-error text-xs mb-4 text-left">{errorMsg}</p>}
                <button
                  type="submit"
                  className="w-full primary-gradient-btn py-3 rounded-xl font-headline-md text-[18px] text-white flex items-center justify-center gap-3"
                >
                  입장하기
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </form>
            ) : (
              <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                <button onClick={() => setShowLogin(true)} className="primary-gradient-btn px-10 py-4 rounded-xl font-headline-md text-[18px] text-white flex items-center gap-3">
                  무료로 시작하기
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
                <button className="glass-card px-10 py-4 rounded-xl font-headline-md text-[18px] text-on-surface hover:bg-white/10">
                  데모 예약
                </button>
              </div>
            )}

            <div className="mt-20 relative mx-auto max-w-5xl">
              <div className="glass-card rounded-[32px] p-2 overflow-hidden aspect-[16/9]">
                <div className="w-full h-full rounded-[24px] bg-surface-container overflow-hidden relative">
                  <img className="w-full h-full object-cover opacity-80" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCupOEejAc3e_AO4tN1WtX96dxM4TAziDN2UGMBxKmmgAFZznc695U5HOzyIBSfv_T9pqnKII6sIkK4cK6_KF9tVbin_bdluB9xX-bXkCMdhBJTIUrSRNpkGyQY4uOH4l_bAxxzWwmofH0lgumrsi-qK6b1qYjZNYEasWNUbSaRSGjwXiu9W4bcwLBDhtt7s8ffv8B2OydDx77jqyPKg7rqAUd7Q4BmXkescjroKrT9Nf_MzmVIom3tljQ9nudriRLWCccY_l1LMWc"/>
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"></div>
                </div>
              </div>
              <div className="absolute -top-10 -right-10 glass-card p-6 rounded-2xl hidden lg:block animate-bounce" style={{animationDuration: '4s'}}>
                <span className="material-symbols-outlined text-secondary text-4xl">bolt</span>
              </div>
              <div className="absolute -bottom-10 -left-10 glass-card p-6 rounded-2xl hidden lg:block animate-pulse">
                <span className="material-symbols-outlined text-primary text-4xl">shield</span>
              </div>
            </div>
          </section>

          <section className="py-section-padding-mobile md:py-section-padding-desktop px-gutter max-w-container-max mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
              <div className="max-w-xl text-left">
                <h2 className="font-headline-md text-on-surface mb-4">가치를 창출하는 <br/>핵심 기능</h2>
                <p className="text-on-surface-variant">복잡한 회의 기록을 단순화하고, 흩어진 인사이트를 하나로 모으는 강력한 도구를 경험하세요.</p>
              </div>
              <div className="font-label-caps text-primary tracking-widest border-b border-primary/20 pb-2">모든 기능 보기</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-8 rounded-3xl flex flex-col gap-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-3xl">psychology</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-[24px] text-on-surface mb-3">AI 인사이트 도출</h3>
                  <p className="text-on-surface-variant leading-relaxed">모임의 모든 기록을 실시간으로 분석하여 요약, 공통 의견, 실천 항목 등을 자동으로 정리합니다.</p>
                </div>
              </div>
              <div className="glass-card p-8 rounded-3xl flex flex-col gap-6">
                <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-secondary text-3xl">forum</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-[24px] text-on-surface mb-3">실시간 양방향 협업</h3>
                  <p className="text-on-surface-variant leading-relaxed">다양한 유형의 노트를 남기고 참여자와 실시간으로 반응을 주고받으며 아이디어를 발전시킵니다.</p>
                </div>
              </div>
              <div className="glass-card p-8 rounded-3xl flex flex-col gap-6">
                <div className="w-14 h-14 rounded-2xl bg-tertiary-container/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-tertiary text-3xl">history</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-[24px] text-on-surface mb-3">안전한 지식 저장소</h3>
                  <p className="text-on-surface-variant leading-relaxed">이전 모임의 기록과 결정 사항을 안전하게 보관하고 필요할 때 언제든 다시 확인할 수 있습니다.</p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </>
    );
  }

  // --- DASHBOARD VIEW ---
  return (
    <>
      <div className="glow-orb bg-primary top-[-50px] right-[-50px]"></div>
      <div className="glow-orb bg-secondary bottom-[-100px] left-[-100px]" style={{animationDelay: '-5s'}}></div>

      <header className="fixed top-0 w-full z-50 bg-surface/40 backdrop-blur-[40px] border-b border-outline-variant/10">
        <div className="flex justify-between items-center px-gutter py-base max-w-container-max mx-auto h-16">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">terminal</span>
            <h1 className="font-display-lg text-[24px] tracking-tighter text-primary">MINDWEAVE</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 glass-card px-3 py-1.5 rounded-full border border-outline-variant/20 text-xs">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse"></span>
              <span className="font-medium text-on-surface">{session.name} 님</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-on-surface-variant hover:text-error transition-colors flex items-center justify-center"
              title="로그아웃"
            >
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-32 px-gutter max-w-container-max mx-auto min-h-screen">
        <section className="mb-10">
          <div className="flex flex-col gap-2">
            <span className="font-label-caps text-primary tracking-widest uppercase">개요</span>
            <h2 className="font-headline-md text-on-surface">모임 목록</h2>
            <p className="font-body-md text-on-surface-variant max-w-md">동료들과 함께 새로운 아이디어를 나누어보세요.</p>
          </div>
        </section>

        {/* Join by code form & search logic combined here */}
        <form onSubmit={handleJoinByCode} className="mb-8 flex gap-4">
          <div className="relative flex-grow">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-50">search</span>
            <input 
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl pl-10 pr-4 py-3 focus:ring-1 focus:ring-primary focus:border-primary text-on-surface text-body-md uppercase tracking-wider" 
              placeholder="초대 코드 입력..." 
              maxLength={6}
              type="text"
            />
          </div>
          <button type="submit" disabled={isJoining || !inviteCode} className="glass-card px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 font-bold">
            <span className="material-symbols-outlined">login</span>
            {isJoining ? '입장 중' : '입장'}
          </button>
        </form>

        {errorMsg && <p className="text-error text-xs mb-4">{errorMsg}</p>}

        <div className="grid grid-cols-1 gap-6">
          {meetings.length === 0 ? (
            <div className="glass-card p-12 rounded-2xl flex flex-col items-center justify-center text-center opacity-70">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4">groups</span>
              <p className="text-on-surface-variant font-body-md">참여 중인 모임이 없습니다.</p>
              <p className="text-on-surface-variant text-sm mt-2">우측 하단의 + 버튼을 눌러 새 모임을 만드세요.</p>
            </div>
          ) : (
            meetings.map((meeting) => (
              <div key={meeting.id} onClick={() => router.push(`/meetings/${meeting.id}`)} className="glass-card p-6 rounded-2xl flex flex-col gap-4 relative overflow-hidden group cursor-pointer hover:border-primary/50">
                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined text-primary" style={{fontVariationSettings: "'FILL' 1"}}>arrow_forward</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                    <span className="material-symbols-outlined text-primary">code</span>
                  </div>
                  <div>
                    <h3 className="font-headline-md text-[20px] text-on-surface leading-tight">{meeting.title}</h3>
                    <p className="font-mono-code text-on-surface-variant mt-1 text-xs line-clamp-1">{meeting.topic || '주제 없음'}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-outline-variant/10">
                  <span className="font-label-caps text-on-surface-variant">{new Date(meeting.meeting_date || meeting.created_at).toLocaleDateString()}</span>
                  <span className="font-label-caps text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20 tracking-wider">
                    코드: {meeting.invite_code}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      <button onClick={() => router.push('/meetings/new')} className="fixed bottom-10 right-6 w-14 h-14 bg-primary text-on-primary rounded-full shadow-[0_0_20px_rgba(173,198,255,0.4)] flex items-center justify-center z-50 hover:scale-110 active:scale-90 transition-transform duration-200" title="새 모임 만들기">
        <span className="material-symbols-outlined text-3xl">add</span>
      </button>
    </>
  );
}
