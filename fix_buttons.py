import re

with open(r'c:\Users\IT-GOOD\MINDWEAVE\src\app\meetings\[meetingId]\page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace interactive button sizes for better touch targets
content = content.replace('w-8 h-8 md:w-10 md:h-10', 'w-11 h-11 md:w-12 md:h-12')
content = content.replace('className="w-10 h-10 flex', 'className="w-11 h-11 flex')
content = content.replace('p-1.5 rounded-full', 'p-2 rounded-full min-w-[44px] min-h-[44px]') # edit button

with open(r'c:\Users\IT-GOOD\MINDWEAVE\src\app\meetings\[meetingId]\page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Button sizes updated successfully.")
