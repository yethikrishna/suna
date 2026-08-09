import { fileReadRetryDelayMs, shouldRetryFileRead } from '@/features/files/hooks/file-read-retry';

type ReadSpreadsheetBlob = (filePath: string) => Promise<Blob>;
type Wait = (delayMs: number, signal?: AbortSignal) => Promise<void>;

const wait: Wait = (delayMs, signal) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, delayMs);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        reject(signal.reason);
      },
      { once: true },
    );
  });

export async function readSpreadsheetBlobWithRetry(
  filePath: string,
  readBlob: ReadSpreadsheetBlob,
  waitForRetry: Wait = wait,
  signal?: AbortSignal,
): Promise<Blob> {
  let failureCount = 0;

  while (true) {
    signal?.throwIfAborted();
    try {
      const blob = await readBlob(filePath);
      if (!blob || blob.size === 0) throw new Error('Empty file received');
      return blob;
    } catch (error) {
      if (!shouldRetryFileRead(filePath, failureCount, error)) throw error;
      await waitForRetry(fileReadRetryDelayMs(failureCount, filePath), signal);
      failureCount += 1;
    }
  }
}
