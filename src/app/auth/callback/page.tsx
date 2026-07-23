'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const exchangeStarted = useRef(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (exchangeStarted.current) return;
    exchangeStarted.current = true;

    const finishSignIn = async () => {
      const callbackUrl = new URL(window.location.href);
      const code = callbackUrl.searchParams.get('code');
      const providerError = callbackUrl.searchParams.get('error_description');

      // Remove the one-time code from the visible URL before doing network work.
      window.history.replaceState(null, '', '/auth/callback');

      if (providerError) {
        setErrorMessage('Google 로그인이 취소되었거나 완료되지 않았습니다.');
        return;
      }

      if (!code) {
        setErrorMessage('로그인 인증 코드를 확인할 수 없습니다.');
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setErrorMessage('로그인 세션을 만들지 못했습니다. 다시 시도해 주세요.');
        return;
      }

      router.replace('/');
    };

    void finishSignIn();
  }, [router]);

  return (
    <main className="min-h-screen bg-background text-on-background flex items-center justify-center p-6">
      <div className="glass-card w-full max-w-md rounded-2xl p-8 text-center">
        <h1 className="text-xl font-bold">
          {errorMessage ? '로그인을 완료하지 못했습니다' : '로그인 확인 중'}
        </h1>
        <p className="mt-3 text-sm text-on-surface-variant">
          {errorMessage || '안전한 로그인 세션을 준비하고 있습니다.'}
        </p>
        {errorMessage && (
          <button
            type="button"
            onClick={() => router.replace('/')}
            className="mt-6 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary"
          >
            로그인 화면으로 돌아가기
          </button>
        )}
      </div>
    </main>
  );
}
