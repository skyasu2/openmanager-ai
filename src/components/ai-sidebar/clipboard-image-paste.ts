export interface ClipboardLikeItem {
  type: string;
  getAsFile: () => File | null;
}

/**
 * 클립보드에서 이미지 항목만 파일로 꺼낸다.
 * 함께 실린 텍스트는 호출측에서 입력창에 넣지 않는다.
 * 미지원 MIME도 수집해 검증 에러가 보이도록 둔다.
 */
export function collectClipboardImageFiles(
  items: ArrayLike<ClipboardLikeItem> | null | undefined
): File[] {
  if (!items || items.length === 0) {
    return [];
  }

  const imageFiles: File[] = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let imageIndex = 0;

  for (const item of Array.from(items)) {
    if (!item.type.startsWith('image/')) {
      continue;
    }

    const file = item.getAsFile();
    if (!file) {
      continue;
    }

    const subtype = item.type.slice('image/'.length).split('+')[0] || 'png';
    const extension = subtype === 'jpeg' ? 'jpg' : subtype;
    imageFiles.push(
      new File([file], `clipboard-${timestamp}-${imageIndex}.${extension}`, {
        type: item.type,
        lastModified: file.lastModified,
      })
    );
    imageIndex += 1;
  }

  return imageFiles;
}
