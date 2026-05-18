export interface ResponseLatencyLabel {
  label: '응답 빠름' | '응답 보통' | '응답 느림';
  className: string;
  title: string;
}

export function getResponseLatencyLabel(
  processingTime?: number | null
): ResponseLatencyLabel | null {
  if (typeof processingTime !== 'number' || !Number.isFinite(processingTime)) {
    return null;
  }

  const roundedMs = Math.max(0, Math.round(processingTime));

  if (roundedMs < 1000) {
    return {
      label: '응답 빠름',
      className: 'border-emerald-100 bg-emerald-50 text-emerald-700',
      title: `${roundedMs}ms`,
    };
  }

  if (roundedMs <= 3000) {
    return {
      label: '응답 보통',
      className: 'border-amber-100 bg-amber-50 text-amber-700',
      title: `${roundedMs}ms`,
    };
  }

  return {
    label: '응답 느림',
    className: 'border-rose-100 bg-rose-50 text-rose-700',
    title: `${roundedMs}ms`,
  };
}
