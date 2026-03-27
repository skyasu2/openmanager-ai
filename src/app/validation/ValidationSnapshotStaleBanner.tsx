'use client';

function getSnapshotAgeDays(generatedAt: string): number {
  const now = Date.now();
  const generated = new Date(generatedAt).getTime();

  if (Number.isNaN(generated)) {
    return Number.NaN;
  }

  return Math.floor((now - generated) / (1000 * 60 * 60 * 24));
}

export function ValidationSnapshotStaleBanner({
  generatedAt,
}: {
  generatedAt: string;
}) {
  const snapshotAgeDays = getSnapshotAgeDays(generatedAt);

  if (Number.isNaN(snapshotAgeDays) || snapshotAgeDays < 7) {
    return null;
  }

  return (
    <div className="relative z-50 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-300">
      ⚠️ 이 스냅샷은 {snapshotAgeDays}일 전 빌드 기준입니다. 최신 QA 기록은
      저장소의 <code className="font-mono">reports/qa/QA_STATUS.md</code>를
      참조하세요.
    </div>
  );
}
