import re

with open(r'c:\Users\IT-GOOD\MINDWEAVE\src\app\join\[inviteCode]\page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update MeetingDetails interface
content = content.replace(
    "interface MeetingDetails {\n  id: string;\n  title: string;\n  topic: string;\n  description: string;\n  meeting_date: string;\n}",
    "interface MeetingDetails {\n  id: string;\n  title: string;\n  topic: string;\n  description: string;\n  meeting_date: string;\n  status?: string;\n  max_participants?: number;\n  current_participants?: number;\n}"
)

# 2. Extract error from fetch block
content = content.replace(
    "if (!res.ok) throw new Error(data.error || 'Failed to fetch meeting');",
    "if (!res.ok) { setErrorMsg(data.error || 'Failed to fetch meeting'); setIsLoading(false); return; }"
)

# 3. Add participant count UI below meeting date
ui_participants = """                  <div className="flex items-center gap-2 text-on-surface-variant bg-surface-variant/30 px-3 py-1.5 rounded-full border border-outline-variant/10 text-xs font-medium shrink-0">
                    <span className="material-symbols-outlined text-[14px]">group</span>
                    <span>{meeting.current_participants || 1} / {meeting.max_participants || 20}</span>
                  </div>"""

content = content.replace(
    '<span className="material-symbols-outlined text-[14px]">calendar_today</span>\n                    <span>{formattedDate}</span>\n                  </div>',
    '<span className="material-symbols-outlined text-[14px]">calendar_today</span>\n                    <span>{formattedDate}</span>\n                  </div>\n' + ui_participants
)

# 4. Handle full or closed state in UI
join_button_replace = """              {meeting.status === 'closed' ? (
                <div className="text-center p-4 bg-error/10 text-error rounded-xl font-bold border border-error/20">
                  <span className="material-symbols-outlined block text-2xl mb-1">cancel</span>
                  이미 종료된 모임입니다.
                </div>
              ) : meeting.max_participants && meeting.current_participants && meeting.current_participants >= meeting.max_participants ? (
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
              )}"""

# We need to replace the <form onSubmit={handleJoin}>...</form> block with the one above
content = re.sub(
    r'<form onSubmit=\{handleJoin\} className="space-y-4">.*?</form>',
    join_button_replace,
    content,
    flags=re.DOTALL
)

with open(r'c:\Users\IT-GOOD\MINDWEAVE\src\app\join\[inviteCode]\page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("join page updated")
