'use client';

import { emergencyMode } from '@/lib/emergency-mode';

export function EmergencyBanner() {
  if (!emergencyMode.isEmergencyMode()) return null;

  return (
    <div className="fixed left-0 right-0 top-0 z-50 bg-red-600 px-4 py-2 text-center text-white">
      <div className="flex items-center justify-center gap-2">
        <span className="animate-pulse">🚨</span>
        <span className="font-semibold">
          {emergencyMode.getEmergencyMessage()}
        </span>
        <span className="animate-pulse">🚨</span>
      </div>
    </div>
  );
}
