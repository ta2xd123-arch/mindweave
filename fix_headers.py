import re

files = [
    r'c:\Users\IT-GOOD\MINDWEAVE\src\app\meetings\[meetingId]\page.tsx',
    r'c:\Users\IT-GOOD\MINDWEAVE\src\app\meetings\[meetingId]\report\page.tsx'
]

for file_path in files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add safe-area-inset-top to headers
    content = content.replace(
        '<header className="fixed top-0 w-full z-50 bg-surface/40 backdrop-blur-[40px] border-b border-outline-variant/10">',
        '<header className="fixed top-0 w-full z-50 bg-surface/40 backdrop-blur-[40px] border-b border-outline-variant/10 pt-[env(safe-area-inset-top)]">'
    )
    
    # In report page, the header might be slightly different
    content = content.replace(
        '<header className="fixed top-0 w-full z-50 p-2 md:p-4 bg-background/80 backdrop-blur-md border-b border-outline-variant/10">',
        '<header className="fixed top-0 w-full z-50 p-2 md:p-4 bg-background/80 backdrop-blur-md border-b border-outline-variant/10 pt-[calc(0.5rem+env(safe-area-inset-top))] md:pt-[calc(1rem+env(safe-area-inset-top))]">'
    )
    # Actually wait, let me just replace fixed top-0 w-full z-50... using regex
    content = re.sub(
        r'<header className="fixed top-0 w-full z-50 p-4 bg-background/80 backdrop-blur-md border-b border-outline-variant/10">',
        r'<header className="fixed top-0 w-full z-50 p-4 bg-background/80 backdrop-blur-md border-b border-outline-variant/10 pt-[calc(1rem+env(safe-area-inset-top))]">',
        content
    )
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Headers updated successfully.")
