import re

with open(r'c:\Users\IT-GOOD\MINDWEAVE\src\app\meetings\new\page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state for maxParticipants
content = content.replace(
    "const [date, setDate] = useState('');",
    "const [date, setDate] = useState('');\n  const [maxParticipants, setMaxParticipants] = useState<number>(20);"
)

# 2. Add maxParticipants to payload
content = content.replace(
    "meetingDate: date ? new Date(date).toISOString() : new Date().toISOString(),\n        userId: session.id,",
    "meetingDate: date ? new Date(date).toISOString() : new Date().toISOString(),\n        userId: session.id,\n        maxParticipants,"
)
content = content.replace(
    "meeting_date: meetingData.meetingDate,\n          invite_code: inviteCode,",
    "meeting_date: meetingData.meetingDate,\n          invite_code: inviteCode,\n          max_participants: maxParticipants,"
)

# 3. Add UI field
ui_field = """            {/* Max Participants Input */}
            <div>
              <label htmlFor="maxParticipants" className="block text-sm font-semibold text-on-surface mb-2 pl-1">최대 참여 인원 (모임장 포함)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[20px]">group</span>
                </div>
                <input
                  type="number"
                  id="maxParticipants"
                  min="2"
                  max="50"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(parseInt(e.target.value) || 20)}
                  className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl pl-11 pr-4 py-3.5 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all font-medium"
                  required
                />
              </div>
              <p className="text-xs text-on-surface-variant mt-2 pl-1">2명에서 50명 사이로 설정 가능합니다.</p>
            </div>

            {/* Submit Button */}"""

content = content.replace("{/* Submit Button */}", ui_field)

with open(r'c:\Users\IT-GOOD\MINDWEAVE\src\app\meetings\new\page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("page.tsx updated")
