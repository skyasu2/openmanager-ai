import { Clock, RotateCcw } from 'lucide-react';
import {
  getModelShortName,
  getProviderDisplayName,
  getProviderDotColor,
} from './shared';

interface ProviderAttributionChipProps {
  provider: string;
  modelId?: string;
  ttfbMs?: number;
  usedFallback?: boolean;
  rotationSlot?: number;
}

/**
 * Provider attribution chip for AI message metadata.
 * Displays provider name, model, latency, fallback status, and rotation slot.
 */
export function ProviderAttributionChip({
  provider,
  modelId,
  ttfbMs,
  usedFallback,
  rotationSlot,
}: ProviderAttributionChipProps) {
  const providerLabel = getProviderDisplayName(provider);
  const modelLabel = modelId ? getModelShortName(modelId) : null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
      <span className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 font-medium">
        <span
          className={`h-1.5 w-1.5 rounded-full ${getProviderDotColor(provider)}`}
          aria-hidden="true"
        />
        {providerLabel}
        {modelLabel && <span>/ {modelLabel}</span>}
      </span>

      {typeof ttfbMs === 'number' && (
        <span className="inline-flex items-center gap-1 rounded bg-slate-50 px-1.5 py-0.5 text-slate-600">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {ttfbMs}ms
        </span>
      )}

      {usedFallback && (
        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-600">
          fallback
        </span>
      )}

      {typeof rotationSlot === 'number' && (
        <span className="inline-flex items-center gap-1 rounded bg-slate-50 px-1.5 py-0.5 text-slate-600">
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          순환 {rotationSlot + 1}번
        </span>
      )}
    </div>
  );
}
