import { FileText, MessageSquare, Monitor } from 'lucide-react';
import type { AIAssistantFunction } from './AIAssistantIconPanel';

export const AI_ASSISTANT_LIGHT_THEME_TOKENS = {
  '--background': '0 0% 100%',
  '--foreground': '222.2 84% 4.9%',
  '--card': '0 0% 100%',
  '--card-foreground': '222.2 84% 4.9%',
  '--popover': '0 0% 100%',
  '--popover-foreground': '222.2 84% 4.9%',
  '--secondary': '210 40% 96%',
  '--secondary-foreground': '222.2 84% 4.9%',
  '--muted': '210 40% 96%',
  '--muted-foreground': '215.4 16.3% 46.9%',
  '--accent': '210 40% 96%',
  '--accent-foreground': '222.2 84% 4.9%',
  '--border': '214.3 31.8% 91.4%',
  '--input': '214.3 31.8% 91.4%',
} as const;

export const MOBILE_WORKSPACE_MEDIA_QUERY = '(max-width: 767px)';
export const DASHBOARD_ROUTE = '/dashboard';

export const AI_WORKSPACE_FUNCTION_TABS: Array<{
  id: AIAssistantFunction;
  label: string;
  description: string;
  icon: typeof MessageSquare;
}> = [
  {
    id: 'chat',
    label: 'AI Chat',
    description: '자연어 질의',
    icon: MessageSquare,
  },
  {
    id: 'auto-report',
    label: '장애 보고서',
    description: 'MD/TXT 다운로드',
    icon: FileText,
  },
  {
    id: 'intelligent-monitoring',
    label: '이상감지/추세',
    description: '실시간 분석 실행',
    icon: Monitor,
  },
];
