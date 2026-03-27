export type ScheduledTimeout = ReturnType<typeof setTimeout>;

export interface TrackedTimeoutScheduler {
  clearAll: () => void;
  getPendingCount: () => number;
  schedule: (callback: () => void, delay: number) => ScheduledTimeout;
}

export function createTrackedTimeoutScheduler(): TrackedTimeoutScheduler {
  const scheduledTimeouts = new Set<ScheduledTimeout>();

  return {
    clearAll() {
      for (const timeout of scheduledTimeouts) {
        clearTimeout(timeout);
      }
      scheduledTimeouts.clear();
    },
    getPendingCount() {
      return scheduledTimeouts.size;
    },
    schedule(callback, delay) {
      const timeout = setTimeout(() => {
        scheduledTimeouts.delete(timeout);
        callback();
      }, delay);

      scheduledTimeouts.add(timeout);
      return timeout;
    },
  };
}
