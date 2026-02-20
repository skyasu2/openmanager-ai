let testModeEnabled = process.env.LANGFUSE_TEST_MODE === 'true';

export function isLangfuseTestModeEnabled(): boolean {
  return testModeEnabled;
}

export function setLangfuseTestModeEnabled(enabled: boolean): void {
  testModeEnabled = enabled;
}
