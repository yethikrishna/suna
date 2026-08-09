import { describe, expect, test } from 'bun:test';

import { readSpreadsheetBlobWithRetry } from './xlsx-loader';

describe('readSpreadsheetBlobWithRetry', () => {
  test('retries a transient HTML response until the spreadsheet loads', async () => {
    const expected = new Blob(['spreadsheet']);
    const delays: number[] = [];
    let attempts = 0;

    const result = await readSpreadsheetBlobWithRetry(
      '/workspace/report.xlsx',
      async () => {
        attempts += 1;
        if (attempts < 3) throw new SyntaxError("Unexpected token '<'");
        return expected;
      },
      async (delayMs) => {
        delays.push(delayMs);
      },
    );

    expect(result).toBe(expected);
    expect(attempts).toBe(3);
    expect(delays).toEqual([1_000, 2_000]);
  });

  test('stops after three automatic retries', async () => {
    const delays: number[] = [];
    let attempts = 0;

    await expect(
      readSpreadsheetBlobWithRetry(
        '/workspace/report.xlsx',
        async () => {
          attempts += 1;
          throw new Error('Sandbox is starting');
        },
        async (delayMs) => {
          delays.push(delayMs);
        },
      ),
    ).rejects.toThrow('Sandbox is starting');

    expect(attempts).toBe(4);
    expect(delays).toEqual([1_000, 2_000, 4_000]);
  });

  test('does not retry permanent file errors', async () => {
    const error = Object.assign(new Error('File not found'), { status: 404 });
    let attempts = 0;

    await expect(
      readSpreadsheetBlobWithRetry(
        '/workspace/missing.xlsx',
        async () => {
          attempts += 1;
          throw error;
        },
        async () => {},
      ),
    ).rejects.toBe(error);

    expect(attempts).toBe(1);
  });

  test('retries a zero-byte file while it is still being written', async () => {
    const expected = new Blob(['spreadsheet']);
    let attempts = 0;

    const result = await readSpreadsheetBlobWithRetry(
      '/workspace/report.xlsx',
      async () => {
        attempts += 1;
        return attempts === 1 ? new Blob([]) : expected;
      },
      async () => {},
    );

    expect(result).toBe(expected);
    expect(attempts).toBe(2);
  });

  test('uses the uploaded-file startup retry window', async () => {
    const expected = new Blob(['spreadsheet']);
    const delays: number[] = [];
    let attempts = 0;

    const result = await readSpreadsheetBlobWithRetry(
      '/workspace/uploads/report.xlsx',
      async () => {
        attempts += 1;
        if (attempts <= 3) throw new Error('Upload is still copying');
        return expected;
      },
      async (delayMs) => {
        delays.push(delayMs);
      },
    );

    expect(result).toBe(expected);
    expect(attempts).toBe(4);
    expect(delays).toEqual([2_000, 2_000, 2_000]);
  });

  test('stops before another read when the renderer is cancelled', async () => {
    const abortController = new AbortController();
    let attempts = 0;

    await expect(
      readSpreadsheetBlobWithRetry(
        '/workspace/report.xlsx',
        async () => {
          attempts += 1;
          throw new Error('Sandbox is starting');
        },
        async (_delayMs, signal) => {
          abortController.abort();
          signal?.throwIfAborted();
        },
        abortController.signal,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(attempts).toBe(1);
  });
});
