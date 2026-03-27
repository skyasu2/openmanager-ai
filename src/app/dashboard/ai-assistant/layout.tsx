import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Assistant',
  description:
    'AI 기반 서버 모니터링 어시스턴트 - 자연어 질의, 이상 탐지, 장애 분석',
};

export default function AIAssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
