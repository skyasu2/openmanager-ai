interface BootProgressBarProps {
  progress: number;
}

export const BootProgressBar = ({ progress }: BootProgressBarProps) => {
  return (
    <div className="relative mx-auto mb-8 w-full max-w-96">
      {/* 진행률 라벨 */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-white/60">
          시스템 로딩 진행률
        </span>
        <span className="text-sm font-semibold text-white/80">
          {Math.round(progress)}%
        </span>
      </div>

      {/* 진행률 바 컨테이너 */}
      <div className="relative h-4 overflow-hidden rounded-full border border-white/20 bg-white/10 shadow-lg">
        {/* 배경 그라데이션 효과 */}
        <div className="absolute inset-0 rounded-full bg-linear-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10" />

        {/* 메인 진행률 바 */}
        <div
          className="relative h-full overflow-hidden rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${progress}%`,
            background:
              'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #f59e0b)',
            boxShadow:
              '0 0 20px rgba(59, 130, 246, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
          }}
        >
          {/* 진행률 바 내부 반짝임 효과 */}
          <div className="animate-shimmer absolute inset-0 bg-linear-to-r from-transparent via-white/40 to-transparent" />

          {/* 진행률 바 상단 하이라이트 */}
          <div className="absolute left-0 right-0 top-0 h-1 rounded-full bg-linear-to-r from-white/30 via-white/50 to-white/30" />
        </div>

        {/* 진행률 포인터 - 부드러운 트랜지션 */}
        <div
          className="animate-pulse absolute top-1/2 h-3 w-3 -translate-y-1/2 transform rounded-full border-2 border-blue-400 bg-white shadow-lg transition-all duration-700 ease-out"
          style={{ left: `${progress}%`, animationDuration: '1.5s' }}
        />
      </div>
    </div>
  );
};
