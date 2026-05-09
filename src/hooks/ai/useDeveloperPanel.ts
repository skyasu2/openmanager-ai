'use client';

import { useMemo } from 'react';
import {
  type DeveloperPanelData,
  normalizeDeveloperPanelData,
} from '@/lib/ai/developer-panel';

export function useDeveloperPanel(data: DeveloperPanelData | null): {
  panelData: DeveloperPanelData | null;
  panelJson: string | null;
} {
  return useMemo(() => {
    const panelData = normalizeDeveloperPanelData(data);
    return {
      panelData,
      panelJson: panelData ? JSON.stringify(panelData) : null,
    };
  }, [data]);
}
