import { Loader2 } from 'lucide-react';

export default function AIAssistantLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-950">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-blue-500" />
        <p className="text-sm text-gray-400">AI Assistant 로딩 중...</p>
      </div>
    </div>
  );
}
