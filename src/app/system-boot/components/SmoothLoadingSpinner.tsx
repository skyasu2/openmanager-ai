import { Monitor } from 'lucide-react';

export const SmoothLoadingSpinner = () => {
  return (
    <div className="relative mx-auto mb-8 h-20 w-20">
      {/* 외부 링 - 더 부드러운 애니메이션 */}
      <div
        className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-r-purple-500 border-t-blue-500"
        style={{ animationDuration: '3s' }}
      />
      {/* 내부 링 - 더 부드러운 애니메이션 (역방향) */}
      <div
        className="border-3 animate-spin absolute inset-2 rounded-full border-transparent border-b-purple-400 border-l-pink-400"
        style={{ animationDuration: '2.5s', animationDirection: 'reverse' }}
      />
      {/* 중앙 아이콘 - 부드러운 펄스 */}
      <div
        className="animate-pulse absolute inset-6 flex items-center justify-center rounded-full bg-linear-to-r from-blue-500 to-purple-600"
        style={{ animationDuration: '2s' }}
      >
        <Monitor className="h-4 w-4 text-white" />
      </div>
    </div>
  );
};
