import re

with open(r'c:\Users\IT-GOOD\MINDWEAVE\src\app\join\[inviteCode]\page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Update UI block condition to allow session users to attempt joining
content = content.replace(
    ") : meeting.max_participants && meeting.current_participants && meeting.current_participants >= meeting.max_participants ? (",
    ") : meeting.max_participants && meeting.current_participants && meeting.current_participants >= meeting.max_participants && !session ? ("
)

with open(r'c:\Users\IT-GOOD\MINDWEAVE\src\app\join\[inviteCode]\page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Join page condition updated")
