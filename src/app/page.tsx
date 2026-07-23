'use client';
import { apiFetch } from '@/lib/api-client';
import { AppVersionBadge } from '@/components/app-update-manager';
import Image from 'next/image';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getLocalSession, saveGuestSession, saveSession, clearSession, UserSession } from '@/lib/auth';
import {
  canShowMeetingCreation,
  guestMeetingHref,
  HomeAuthStatus,
  resolveHomeView,
  shouldFetchMeetingList,
} from '@/lib/home-access';
import { isAndroidBrowser, isEmbeddedOAuthBrowser } from '@/lib/browser-environment';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

interface Meeting {
  id: string;
  title: string;
  topic: string;
  description?: string;
  status: string;
  invite_code: string;
  created_by: string;
  created_at: string;
  meeting_date?: string;
  max_participants?: number;
}

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(() => getLocalSession());
  const [nameInput, setNameInput] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginMode, setLoginMode] = useState<'guest' | 'owner'>('guest');
  const [ownerAuthMode, setOwnerAuthMode] = useState<'login' | 'signup'>('login');
  const [authNotice, setAuthNotice] = useState('');
  const [showExternalBrowserNotice, setShowExternalBrowserNotice] = useState(false);
  const [canOpenChrome, setCanOpenChrome] = useState(false);
  const [authStatus, setAuthStatus] = useState<HomeAuthStatus>(() =>
    isSupabaseConfigured ? 'loading' : 'authenticated'
  );
  const homeView = resolveHomeView(isSupabaseConfigured, authStatus, Boolean(session));
  const canCreateMeeting = canShowMeetingCreation(isSupabaseConfigured, authStatus);
  const scopedGuestMeetingHref = session ? guestMeetingHref(session) : null;

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;

    const syncAuthenticatedSession = async () => {
      const { data: { session: supabaseSession } } = await supabase.auth.getSession();
      if (!active) return;
      if (!supabaseSession) {
        setMeetings([]);
        setAuthStatus('unauthenticated');
        return;
      }
      setAuthStatus('authenticated');
      const name = supabaseSession.user.user_metadata?.name || supabaseSession.user.email?.split('@')[0] || '모임장';
      setSession(await saveSession(name));
    };

    void syncAuthenticatedSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, supabaseSession) => {
      if (!supabaseSession) {
        setMeetings([]);
        setAuthStatus('unauthenticated');
        return;
      }
      setAuthStatus('authenticated');
      const name = supabaseSession.user.user_metadata?.name || supabaseSession.user.email?.split('@')[0] || '모임장';
      void saveSession(name).then(setSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleOwnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput.trim()) return;
    setErrorMsg('');
    setAuthNotice('');
    try {
      let data;
      if (ownerAuthMode === 'signup') {
        const response = await supabase.auth.signUp({
          email: emailInput.trim(),
          password: passwordInput,
          options: { data: { name: emailInput.trim().split('@')[0] } },
        });
        if (response.error) throw response.error;
        data = response.data;
        if (!response.data.session) {
          setAuthNotice('가입 확인 메일을 보냈습니다. 이메일 인증 후 로그인해 주세요.');
          return;
        }
      } else {
        const response = await supabase.auth.signInWithPassword({
          email: emailInput.trim(),
          password: passwordInput,
        });
        if (response.error) throw response.error;
        data = response.data;
      }
      // After successful Supabase login, save to local session
      const newSession = await saveSession(data.user?.user_metadata?.name || '모임장');
      setAuthStatus('authenticated');
      setSession(newSession);
      setEmailInput('');
      setPasswordInput('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      setErrorMsg(
        message.includes('Invalid login credentials')
          ? '이메일 또는 비밀번호가 올바르지 않습니다. 계정이 없다면 회원가입을 선택해 주세요.'
          : message || (ownerAuthMode === 'signup' ? '회원가입에 실패했습니다.' : '로그인에 실패했습니다.')
      );
    }
  };
  
  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setAuthNotice('');
    const userAgent = navigator.userAgent;
    if (isEmbeddedOAuthBrowser(userAgent)) {
      setShowExternalBrowserNotice(true);
      setCanOpenChrome(isAndroidBrowser(userAgent));
      return;
    }
    setShowExternalBrowserNotice(false);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      setErrorMsg(
        message.includes('provider is not enabled') || message.includes('Unsupported provider')
          ? 'Google 로그인이 아직 Supabase에서 활성화되지 않았습니다.'
          : message || '구글 로그인에 실패했습니다.'
      );
    }
  };

  const handleOpenInChrome = () => {
    const target = window.location.origin;
    const url = new URL(target);
    window.location.href = `intent://${url.host}${url.pathname}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(target)};end`;
  };



  useEffect(() => {
    if (!shouldFetchMeetingList(isSupabaseConfigured, authStatus, Boolean(session))) return;
    async function fetchMeetings() {
      try {
        if (!isSupabaseConfigured) {
          const localM = localStorage.getItem('mindweave_mock_meetings') || '[]';
          setMeetings(JSON.parse(localM));
          return;
        }

        const res = await apiFetch('/api/meetings');
        if (!res.ok) throw new Error('Failed to fetch meetings');
        const data = await res.json();
        setMeetings(data.meetings || []);
      } catch (err) {
        console.error('Error fetching meetings:', err);
      }
    }

    fetchMeetings();
  }, [authStatus, session]);

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
        const found = mockMeetings.find((m: Meeting) => m.invite_code === cleanCode);
        if (found) {
          router.push(`/meetings/${found.id}`);
        } else {
          setErrorMsg('초대 코드가 유효하지 않습니다.');
        }
        setIsJoining(false);
        return;
      }

      const res = await apiFetch('/api/meetings/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: cleanCode,
          userName: session.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '모임 참여에 실패했습니다.');
      }

      if (data.guestToken) {
        const guestSession = saveGuestSession({
          id: data.participantId,
          name: session.name,
          role: 'guest',
          guestToken: data.guestToken,
          meetingId: data.meetingId,
        });
        setSession(guestSession);
      }

      router.push(`/meetings/${data.meetingId}`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '모임 참여에 실패했습니다.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    clearSession();
    setAuthStatus(isSupabaseConfigured ? 'unauthenticated' : 'authenticated');
    setSession(null);
    setMeetings([]);
  };

  if (homeView === 'loading') {
    return (
      <main className="min-h-screen mobile-page-x flex items-center justify-center" aria-live="polite">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="material-symbols-outlined text-primary text-4xl animate-pulse">hub</span>
          <p className="text-on-surface-variant text-readable">로그인 상태를 확인하고 있습니다.</p>
        </div>
      </main>
    );
  }

  // --- LANDING VIEW ---
  if (homeView === 'landing' || !session) {
    return (
      <div className="relative isolate min-h-screen">
        <div aria-hidden="true" className="glow-orb-layer">
          <div className="glow-orb bg-primary w-[500px] h-[500px] top-[-100px] left-[-100px]"></div>
          <div className="glow-orb bg-secondary w-[600px] h-[600px] bottom-[-200px] right-[-100px]"></div>
        </div>

        <header className="fixed top-0 w-full z-50 bg-surface/40 backdrop-blur-[40px] border-b border-outline-variant/10">
          <div className="flex justify-between items-center mobile-page-x py-base max-w-container-max mx-auto h-16 md:h-20 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-primary-fixed text-xl sm:text-2xl flex-shrink-0">terminal</span>
              <span className="text-xl sm:text-2xl font-bold leading-none text-primary whitespace-nowrap">MINDWEAVE</span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
            </nav>
            <div>
              <button onClick={() => setShowLogin(!showLogin)} className="primary-gradient-btn px-4 sm:px-5 py-2.5 rounded-full text-xs font-bold text-white whitespace-nowrap">입장하기</button>
            </div>
          </div>
        </header>

        <main>
          <section className="relative pt-28 sm:pt-36 md:pt-48 pb-section-padding-mobile md:pb-section-padding-desktop mobile-page-x max-w-container-max mx-auto text-center overflow-hidden">
            <AppVersionBadge />
            <h1 className="text-[30px] min-[390px]:text-[38px] md:text-[64px] font-bold text-on-surface mb-6 max-w-4xl mx-auto leading-tight">
              <span className="block whitespace-nowrap">아이디어를 연결하는</span>
              <span className="block mt-3 text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">AI 협업 플랫폼</span>
            </h1>
            <p className="text-base sm:text-lg text-on-surface-variant max-w-2xl mx-auto mb-10 text-readable">
              회의 기록부터 AI 인사이트 도출까지, 팀의 지식 자산을 새롭게 정의하십시오. <br className="hidden md:block"/>
              MINDWEAVE는 모두의 생각이 하나로 모이는 혁신적인 협업 공간을 제공합니다.
            </p>

            {showLogin ? (
                            <div className="glass-card w-full max-w-md mx-auto p-4 sm:p-6 rounded-2xl animate-fade-in-up">
                <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2 mb-6">
                  <button onClick={() => { setLoginMode('guest'); setErrorMsg(''); setAuthNotice(''); setShowExternalBrowserNotice(false); }} className={`w-full py-2.5 px-3 text-sm font-bold rounded-lg transition-colors ${loginMode === 'guest' ? 'bg-primary text-white' : 'bg-surface-variant text-on-surface-variant'}`}>게스트 참여</button>
                  <button onClick={() => { setLoginMode('owner'); setErrorMsg(''); setAuthNotice(''); setShowExternalBrowserNotice(false); }} className={`w-full py-2.5 px-3 text-sm font-bold rounded-lg transition-colors ${loginMode === 'owner' ? 'bg-secondary text-white' : 'bg-surface-variant text-on-surface-variant'}`}>모임장 로그인</button>
                </div>

                {loginMode === 'guest' ? (
                  <form onSubmit={handleLogin}>
                    <div className="mb-4 text-left">
                      <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-primary mb-2">
                        이름 / 닉네임 입력 (게스트용)
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
                    {errorMsg && <p className="text-error text-sm mb-4 text-left text-readable">{errorMsg}</p>}
                    <button
                      type="submit"
                      className="w-full primary-gradient-btn py-3 rounded-xl font-bold text-base text-white flex items-center justify-center gap-3"
                    >
                      게스트로 입장하기
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleOwnerLogin}>
                    <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-surface-variant p-1">
                      <button type="button" onClick={() => { setOwnerAuthMode('login'); setErrorMsg(''); setAuthNotice(''); }} className={`flex-1 rounded-md py-2 text-sm font-semibold ${ownerAuthMode === 'login' ? 'bg-surface text-secondary shadow-sm' : 'text-on-surface-variant'}`}>로그인</button>
                      <button type="button" onClick={() => { setOwnerAuthMode('signup'); setErrorMsg(''); setAuthNotice(''); }} className={`flex-1 rounded-md py-2 text-sm font-semibold ${ownerAuthMode === 'signup' ? 'bg-surface text-secondary shadow-sm' : 'text-on-surface-variant'}`}>회원가입</button>
                    </div>
                    <div className="mb-4 text-left">
                      <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-2">이메일</label>
                      <input
                        id="email"
                        type="email"
                        required
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="admin@mindweave.io"
                        className="w-full rounded-xl border border-outline-variant/30 bg-surface/50 px-4 py-3 text-on-surface placeholder-on-surface-variant focus:border-secondary focus:bg-surface focus:outline-none transition-all duration-200 mb-3"
                      />
                      <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-2">비밀번호</label>
                      <input
                        id="password"
                        type="password"
                        required
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-outline-variant/30 bg-surface/50 px-4 py-3 text-on-surface placeholder-on-surface-variant focus:border-secondary focus:bg-surface focus:outline-none transition-all duration-200"
                      />
                    </div>
                    {errorMsg && <p className="text-error text-sm mb-4 text-left text-readable">{errorMsg}</p>}
                    {authNotice && <p className="text-primary text-sm mb-4 text-left text-readable">{authNotice}</p>}
                    {showExternalBrowserNotice && (
                      <div role="alert" className="mb-4 rounded-lg border border-primary/30 bg-primary/10 p-4 text-left">
                        <div className="flex items-start gap-3">
                          <span className="material-symbols-outlined text-primary flex-shrink-0">open_in_new</span>
                          <div className="min-w-0">
                            <p className="font-bold text-on-surface text-sm">앱 안 브라우저에서는 Google 로그인이 차단됩니다.</p>
                            <p className="mt-2 text-sm text-on-surface-variant text-readable">
                              오른쪽 위 메뉴에서 Chrome 또는 기본 브라우저로 열어 다시 로그인해 주세요.
                            </p>
                          </div>
                        </div>
                        {canOpenChrome && (
                          <button
                            type="button"
                            onClick={handleOpenInChrome}
                            className="mt-4 w-full rounded-lg border border-primary/40 bg-surface px-4 py-2.5 text-sm font-bold text-primary"
                          >
                            Chrome에서 다시 열기
                          </button>
                        )}
                      </div>
                    )}
                    <button
                      type="submit"
                      className="w-full bg-secondary hover:bg-secondary/90 py-3 rounded-xl font-bold text-base text-white flex items-center justify-center gap-3 mb-3 transition-colors"
                    >
                      {ownerAuthMode === 'signup' ? '이메일로 회원가입' : '이메일로 로그인'}
                      <span className="material-symbols-outlined">login</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      className="w-full bg-surface-container border border-outline-variant/30 hover:bg-surface-variant py-3 rounded-xl font-bold text-base text-on-surface flex items-center justify-center gap-3 transition-colors"
                    >
                      Google 계정으로 로그인
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                <button onClick={() => setShowLogin(true)} className="primary-gradient-btn w-full sm:w-auto px-8 sm:px-10 py-4 rounded-xl font-bold text-base sm:text-lg text-white flex items-center justify-center gap-3">
                  MINDWEAVE 시작하기
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            )}

            <div className="mt-20 relative mx-auto max-w-5xl">
              <div className="glass-card rounded-[32px] p-2 overflow-hidden aspect-[16/9]">
                <div className="w-full h-full rounded-[24px] bg-surface-container overflow-hidden relative">
                  <Image className="w-full h-full object-cover opacity-80" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCupOEejAc3e_AO4tN1WtX96dxM4TAziDN2UGMBxKmmgAFZznc695U5HOzyIBSfv_T9pqnKII6sIkK4cK6_KF9tVbin_bdluB9xX-bXkCMdhBJTIUrSRNpkGyQY4uOH4l_bAxxzWwmofH0lgumrsi-qK6b1qYjZNYEasWNUbSaRSGjwXiu9W4bcwLBDhtt7s8ffv8B2OydDx77jqyPKg7rqAUd7Q4BmXkescjroKrT9Nf_MzmVIom3tljQ9nudriRLWCccY_l1LMWc" alt="MINDWEAVE 앱 미리보기" width={1200} height={675} loading="eager" unoptimized />
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

          <section className="py-section-padding-mobile md:py-section-padding-desktop mobile-page-x max-w-container-max mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
              <div className="max-w-xl text-left">
                <h2 className="font-headline-md text-on-surface mb-4 text-readable">가치를 창출하는 <br/>핵심 기능</h2>
                <p className="text-on-surface-variant text-readable">복잡한 회의 기록을 단순화하고, 흩어진 인사이트를 하나로 모으는 강력한 도구를 경험하세요.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-4 sm:p-6 md:p-8 rounded-2xl flex flex-col gap-5">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-3xl">psychology</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-[20px] md:text-[24px] text-on-surface mb-3">AI 인사이트 도출</h3>
                  <p className="text-on-surface-variant text-readable">모임의 모든 기록을 실시간으로 분석하여 요약, 공통 의견, 실천 항목 등을 자동으로 정리합니다.</p>
                </div>
              </div>
              <div className="glass-card p-4 sm:p-6 md:p-8 rounded-2xl flex flex-col gap-5">
                <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-secondary text-3xl">forum</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-[20px] md:text-[24px] text-on-surface mb-3">실시간 양방향 협업</h3>
                  <p className="text-on-surface-variant text-readable">다양한 유형의 노트를 남기고 참여자와 실시간으로 반응을 주고받으며 아이디어를 발전시킵니다.</p>
                </div>
              </div>
              <div className="glass-card p-4 sm:p-6 md:p-8 rounded-2xl flex flex-col gap-5">
                <div className="w-14 h-14 rounded-2xl bg-tertiary-container/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-tertiary text-3xl">history</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-[20px] md:text-[24px] text-on-surface mb-3">안전한 지식 저장소</h3>
                  <p className="text-on-surface-variant text-readable">이전 모임의 기록과 결정 사항을 안전하게 보관하고 필요할 때 언제든 다시 확인할 수 있습니다.</p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (homeView === 'guest') {
    return (
      <div className="relative isolate min-h-screen">
        <div aria-hidden="true" className="glow-orb-layer">
          <div className="glow-orb bg-primary w-[500px] h-[500px] top-[-100px] left-[-100px]"></div>
          <div className="glow-orb bg-secondary w-[600px] h-[600px] bottom-[-200px] right-[-100px]"></div>
        </div>

        <header className="fixed top-0 w-full z-50 bg-surface/40 backdrop-blur-[40px] border-b border-outline-variant/10">
          <div className="flex justify-between items-center mobile-page-x py-base max-w-container-max mx-auto min-h-16 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-primary text-2xl">terminal</span>
              <h1 className="text-xl sm:text-2xl font-bold leading-none text-primary whitespace-nowrap">MINDWEAVE</h1>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="hidden min-[360px]:block text-sm text-on-surface-variant truncate max-w-[8rem]">{session.name} 님</span>
              <button
                onClick={handleLogout}
                className="text-on-surface-variant hover:text-error transition-colors flex items-center justify-center w-11 h-11 rounded-full hover:bg-surface-variant"
                title="로그아웃"
              >
                <span className="material-symbols-outlined">logout</span>
              </button>
            </div>
          </div>
        </header>

        <main className="pt-28 pb-16 mobile-page-x max-w-2xl mx-auto min-h-screen w-full">
          <section className="mb-8">
            <span className="font-label-caps text-primary uppercase">게스트 참여</span>
            <h2 className="font-headline-md text-on-surface mt-3 mb-3 text-readable">초대받은 모임으로 이동하세요</h2>
            <p className="font-body-md text-on-surface-variant text-readable">
              게스트는 초대 코드를 통해 참여한 모임만 볼 수 있습니다.
            </p>
          </section>

          {scopedGuestMeetingHref && (
            <button
              onClick={() => router.push(scopedGuestMeetingHref)}
              className="w-full mb-6 primary-gradient-btn px-6 py-4 rounded-xl font-bold text-base text-white flex items-center justify-center gap-3"
            >
              참여 중인 모임으로 돌아가기
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          )}

          <form onSubmit={handleJoinByCode} className="glass-card p-4 sm:p-6 rounded-2xl">
            <label htmlFor="guest-invite-code" className="block text-sm font-semibold text-on-surface mb-3">
              초대 코드
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="guest-invite-code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="min-w-0 flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-3 focus:ring-1 focus:ring-primary focus:border-primary text-on-surface text-base uppercase"
                placeholder="6자리 초대 코드"
                maxLength={6}
                type="text"
              />
              <button
                type="submit"
                disabled={isJoining || !inviteCode}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-on-primary font-bold disabled:opacity-50"
              >
                {isJoining ? '입장 중' : '모임 입장'}
              </button>
            </div>
            {errorMsg && <p className="text-error text-sm mt-4 text-readable">{errorMsg}</p>}
          </form>
        </main>
      </div>
    );
  }

  // --- DASHBOARD VIEW ---
  return (
    <div className="relative isolate min-h-screen">
      <div aria-hidden="true" className="glow-orb-layer">
        <div className="glow-orb bg-primary top-[-50px] right-[-50px]"></div>
        <div className="glow-orb bg-secondary bottom-[-100px] left-[-100px]" style={{animationDelay: '-5s'}}></div>
      </div>

      <header className="fixed top-0 w-full z-50 bg-surface/40 backdrop-blur-[40px] border-b border-outline-variant/10">
        <div className="flex justify-between items-center mobile-page-x py-base max-w-container-max mx-auto h-auto min-h-16 gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">terminal</span>
            <h1 className="text-xl sm:text-2xl font-bold leading-none text-primary whitespace-nowrap">MINDWEAVE</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className="hidden min-[360px]:flex items-center gap-2 glass-card px-3 py-1.5 rounded-full border border-outline-variant/20 text-xs min-w-0">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse"></span>
              <span className="font-medium text-on-surface truncate max-w-[8rem]">{session.name} 님</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-on-surface-variant hover:text-error transition-colors flex items-center justify-center w-11 h-11 rounded-full hover:bg-surface-variant"
              title="로그아웃"
            >
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-32 mobile-page-x max-w-container-max mx-auto min-h-screen w-full">
        <section className="mb-10">
          <div className="flex flex-col gap-2">
            <span className="font-label-caps text-primary tracking-widest uppercase">개요</span>
            <h2 className="font-headline-md text-on-surface">모임 목록</h2>
            <p className="font-body-md text-on-surface-variant max-w-md">동료들과 함께 새로운 아이디어를 나누어보세요.</p>
          </div>
        </section>

        {/* Join by code form & search logic combined here */}
        <form onSubmit={handleJoinByCode} className="mb-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative flex-grow min-w-0">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-50">search</span>
            <input 
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl pl-10 pr-4 py-3 focus:ring-1 focus:ring-primary focus:border-primary text-on-surface text-base uppercase tracking-wider"
              placeholder="초대 코드 입력..." 
              maxLength={6}
              type="text"
            />
          </div>
          <button type="submit" disabled={isJoining || !inviteCode} className="glass-card w-full sm:w-auto px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 font-bold">
            <span className="material-symbols-outlined">login</span>
            {isJoining ? '입장 중' : '입장'}
          </button>
        </form>

        {errorMsg && <p className="text-error text-sm mb-4 text-readable">{errorMsg}</p>}

        {canCreateMeeting && session?.sourceDocumentsAvailable && (
          <div className="mb-6 flex justify-end">
            <button
              onClick={() => router.push('/sources/import')}
              className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2.5 text-sm font-bold text-primary hover:bg-primary/20 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">upload_file</span>
              외부 자료 가져오기
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {meetings.length === 0 ? (
            <div className="glass-card p-6 sm:p-10 md:p-12 rounded-2xl flex flex-col items-center justify-center text-center opacity-70">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4">groups</span>
              <p className="text-on-surface-variant font-body-md">참여 중인 모임이 없습니다.</p>
              <p className="text-on-surface-variant text-sm mt-2">{canCreateMeeting ? '우측 하단의 + 버튼을 눌러 새 모임을 만드세요.' : '초대 코드로 모임에 참여할 수 있습니다.'}</p>
            </div>
          ) : (
            meetings.map((meeting) => (
              <div key={meeting.id} onClick={() => router.push(`/meetings/${meeting.id}`)} className="glass-card p-4 sm:p-6 rounded-2xl flex flex-col gap-4 relative overflow-hidden group cursor-pointer hover:border-primary/50">
                <div className="absolute top-0 right-0 p-3 md:p-4 flex gap-2 items-center">
                  {meeting.status === 'closed' && meeting.created_by === session?.id && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('이 모임을 정말 삭제하시겠습니까? (복구 불가)')) {
                          if (localStorage.getItem('mindweave_mock_meetings')) {
                            const all = JSON.parse(localStorage.getItem('mindweave_mock_meetings') || '[]');
                            localStorage.setItem('mindweave_mock_meetings', JSON.stringify(all.filter((m: Meeting) => m.id !== meeting.id)));
                          }
                          apiFetch(`/api/meetings/${meeting.id}`, { method: 'DELETE' })
                            .then(() => setMeetings(m => m.filter(x => x.id !== meeting.id)));
                        }
                      }}
                      className="opacity-60 hover:opacity-100 transition-opacity hover:bg-error/10 p-2 rounded-full flex items-center justify-center text-error z-10"
                      title="모임 삭제"
                    >
                      <span className="material-symbols-outlined text-[20px] md:text-xl">delete</span>
                    </button>
                  )}
                  <div className="opacity-40 group-hover:opacity-100 transition-opacity p-1.5 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary" style={{fontVariationSettings: "'FILL' 1"}}>arrow_forward</span>
                  </div>
                </div>
                <div className="flex items-start sm:items-center gap-3 sm:gap-4 pr-16 sm:pr-20 md:pr-16">
                  <div className="w-12 h-12 rounded-lg flex-shrink-0 bg-primary/10 flex items-center justify-center border border-primary/20">
                    <span className="material-symbols-outlined text-primary">code</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-headline-md text-[18px] sm:text-[20px] text-on-surface leading-tight text-readable">{meeting.title}</h3>
                    <p className="font-mono-code text-on-surface-variant mt-1 text-xs text-readable">{meeting.topic || '주제 없음'}</p>
                  </div>
                </div>
                <div className="flex flex-col min-[360px]:flex-row min-[360px]:items-center justify-between gap-2 mt-2 pt-2 border-t border-outline-variant/10">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="font-label-caps text-on-surface-variant">{new Date(meeting.meeting_date || meeting.created_at).toLocaleDateString()}</span>
                    {meeting.status === 'closed' && <span className="font-label-caps text-error bg-error/10 px-2 py-0.5 rounded-full text-[10px]">종료됨</span>}
                  </span>
                  <span className="font-label-caps text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20 tracking-wider self-start font-mono-code">
                    코드: {meeting.invite_code}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {canCreateMeeting && (
        <button onClick={() => router.push('/meetings/new')} className="fixed safe-bottom-action right-4 sm:right-6 w-14 h-14 bg-primary text-on-primary rounded-full shadow-[0_0_20px_rgba(173,198,255,0.4)] flex items-center justify-center z-50 hover:scale-110 active:scale-90 transition-transform duration-200" title="새 모임 만들기">
          <span className="material-symbols-outlined text-3xl">add</span>
        </button>
      )}
    </div>
  );
}
