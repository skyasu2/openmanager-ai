import { MessageSquare, RefreshCw } from 'lucide-react';
import { memo } from 'react';

interface RestoreConversationBannerProps {
  messageCount: number;
  onRestore: () => void;
  onNewSession: () => void;
}

export const RestoreConversationBanner = memo(
  function RestoreConversationBanner({
    messageCount,
    onRestore,
    onNewSession,
  }: RestoreConversationBannerProps) {
    return (
      <div className="mx-auto mt-8 max-w-lg rounded-xl border border-blue-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <MessageSquare className="h-6 w-6" />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-gray-900">
            이전 대화 내역이 있습니다
          </h3>
          <p className="text-sm text-gray-500">
            마지막으로 진행했던 {messageCount}개의 대화 메시지를
            복원하시겠습니까?
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onNewSession}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />새 대화 시작
          </button>
          <button
            type="button"
            onClick={onRestore}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <MessageSquare className="h-4 w-4" />
            이전 대화 복원
          </button>
        </div>
      </div>
    );
  }
);
