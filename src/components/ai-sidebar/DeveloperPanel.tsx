'use client';

import { useDeveloperPanel } from '@/hooks/ai/useDeveloperPanel';
import type { DeveloperPanelData } from '@/lib/ai/developer-panel';

interface DeveloperPanelProps {
  data: DeveloperPanelData | null;
}

export function DeveloperPanel({ data }: DeveloperPanelProps) {
  const { panelJson } = useDeveloperPanel(data);

  if (!panelJson) {
    return null;
  }

  return (
    <div data-testid="developer-panel" data-panel-json={panelJson} hidden />
  );
}
