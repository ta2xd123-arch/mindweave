import React from 'react';

/**
 * 텍스트 내부의 http:// 또는 https:// URL을 감지하여 
 * 클릭 가능한 링크(새 탭 열기 + 아이콘)로 변환합니다.
 */
export function renderFormattedText(text: string) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, i) => {
    if (/^https?:\/\/[^\s]+$/.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary-container font-semibold break-all inline-flex items-center gap-1 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
          <span className="material-symbols-outlined text-[13px] inline-block align-middle">open_in_new</span>
        </a>
      );
    }
    return part;
  });
}
