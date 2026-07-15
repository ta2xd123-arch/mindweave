import re

with open(r'c:\Users\IT-GOOD\MINDWEAVE\src\app\page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add email/password states and handleLogin functions
imports_to_add = """  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginMode, setLoginMode] = useState<'guest' | 'owner'>('guest');

  const handleOwnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput.trim()) return;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.trim(),
        password: passwordInput
      });
      if (error) throw error;
      // After successful Supabase login, save to local session
      const newSession = await saveSession(data.user?.user_metadata?.name || '모임장');
      setSession(newSession);
      setEmailInput('');
      setPasswordInput('');
    } catch (err: any) {
      setErrorMsg(err.message || '로그인 실패');
    }
  };
  
  const handleGoogleLogin = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
    } catch (err: any) {
      setErrorMsg(err.message || '구글 로그인 실패');
    }
  };
"""

content = content.replace("const [showLogin, setShowLogin] = useState(false);", "const [showLogin, setShowLogin] = useState(false);\n" + imports_to_add)

# Make sure supabase is imported
if "import { supabase" not in content:
    content = content.replace("import { isSupabaseConfigured } from '@/lib/supabase';", "import { isSupabaseConfigured, supabase } from '@/lib/supabase';")
else:
    content = content.replace("import { isSupabaseConfigured }", "import { isSupabaseConfigured, supabase }")

# Add the login UI
new_form_ui = """              <div className="glass-card max-w-md mx-auto p-6 rounded-2xl animate-fade-in-up">
                <div className="flex gap-2 mb-6">
                  <button onClick={() => setLoginMode('guest')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${loginMode === 'guest' ? 'bg-primary text-white' : 'bg-surface-variant text-on-surface-variant'}`}>게스트 참여</button>
                  <button onClick={() => setLoginMode('owner')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${loginMode === 'owner' ? 'bg-secondary text-white' : 'bg-surface-variant text-on-surface-variant'}`}>모임장 로그인</button>
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
                    {errorMsg && <p className="text-error text-xs mb-4 text-left">{errorMsg}</p>}
                    <button
                      type="submit"
                      className="w-full primary-gradient-btn py-3 rounded-xl font-headline-md text-[18px] text-white flex items-center justify-center gap-3"
                    >
                      게스트로 입장하기
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleOwnerLogin}>
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
                    {errorMsg && <p className="text-error text-xs mb-4 text-left">{errorMsg}</p>}
                    <button
                      type="submit"
                      className="w-full bg-secondary hover:bg-secondary/90 py-3 rounded-xl font-headline-md text-[18px] text-white flex items-center justify-center gap-3 mb-3 transition-colors"
                    >
                      이메일로 로그인
                      <span className="material-symbols-outlined">login</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      className="w-full bg-surface-container border border-outline-variant/30 hover:bg-surface-variant py-3 rounded-xl font-headline-md text-[16px] text-on-surface flex items-center justify-center gap-3 transition-colors"
                    >
                      Google 계정으로 로그인
                    </button>
                  </form>
                )}
              </div>"""

content = re.sub(
    r'<form onSubmit=\{handleLogin\} className="glass-card max-w-md mx-auto p-6 rounded-2xl animate-fade-in-up">.*?</form>',
    new_form_ui,
    content,
    flags=re.DOTALL
)

with open(r'c:\Users\IT-GOOD\MINDWEAVE\src\app\page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Main page updated with login forms")
