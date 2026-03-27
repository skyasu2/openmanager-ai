import { fn } from 'storybook/test';

export const systemInactivityService = {
  pauseSystem: fn(),
  resumeSystem: fn(),
  registerBackgroundTask: fn(),
  unregisterBackgroundTask: fn(),
  getBackgroundTasks: fn(() => []),
  isSystemPaused: fn(() => false),
};
