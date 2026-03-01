import type React from 'react';

/**
 * 간단한 마크다운 링크 패턴을 파싱하여 React 요소로 변환합니다.
 * 형식: [텍스트](URL) -> <a href="URL">텍스트</a>
 */
export function parseMarkdownLinks(text: string): React.ReactNode[] {
  if (typeof text !== 'string') return [text];

  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    const [fullMatch, linkText, url] = match;
    const startIndex = match.index;

    // 매치 이전의 일반 텍스트 추가
    if (startIndex > lastIndex) {
      parts.push(text.substring(lastIndex, startIndex));
    }

    // 링크 컴포넌트 추가
    parts.push(
      <a
        key={`link-${startIndex}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-blue-400 hover:text-blue-300 underline decoration-blue-500/30 hover:decoration-blue-400 underline-offset-2 transition-colors"
      >
        {linkText}
      </a>
    );

    lastIndex = startIndex + fullMatch.length;
  }

  // 마지막 매치 이후의 남은 텍스트 추가
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
