export function getTrimmedEnv(name: string): string {
  return process.env[name]?.trim() ?? '';
}
