/**
 * Promise timeout utility with proper cleanup (no timer leaks)
 *
 * @version 1.0.0
 * @created 2026-02-18
 */

/**
 * Wraps a promise with a timeout. Cleans up the timer in all cases
 * (resolve, reject, timeout) to prevent memory/timer leaks.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Error message on timeout
 * @returns The resolved value of the original promise
 * @throws Error if the promise does not resolve within timeoutMs
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}
