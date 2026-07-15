const fs = require('fs');
const files = [
  'src/app/page.tsx',
  'src/app/meetings/[meetingId]/page.tsx',
  'src/app/meetings/[meetingId]/report/page.tsx',
  'src/app/meetings/new/page.tsx',
  'src/app/join/[inviteCode]/page.tsx'
];
files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let lines = fs.readFileSync(f, 'utf8').split('\n');
  let useClientIndex = lines.findIndex(l => l.includes("'use client'") || l.includes('"use client"'));
  if (useClientIndex > 0) {
    let useClientLine = lines.splice(useClientIndex, 1)[0];
    lines.unshift(useClientLine);
    fs.writeFileSync(f, lines.join('\n'));
  }
});
console.log('Fixed use client directive');
