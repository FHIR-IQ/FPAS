/**
 * NDJSON (Newline-Delimited JSON) parser utilities
 */

/**
 * Parse NDJSON text into an array of objects
 */
export function parseNDJSON<T = any>(ndjsonText: string): T[] {
  return ndjsonText
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.warn('Failed to parse NDJSON line:', line, e);
        return null;
      }
    })
    .filter((obj): obj is T => obj !== null);
}

/**
 * Get first N rows from NDJSON text
 */
export function getFirstNRows<T = any>(ndjsonText: string, n: number): T[] {
  const lines = ndjsonText.split('\n').filter((line) => line.trim().length > 0);
  const firstN = lines.slice(0, n);

  return firstN
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.warn('Failed to parse NDJSON line:', line, e);
        return null;
      }
    })
    .filter((obj): obj is T => obj !== null);
}

/**
 * Stream parse NDJSON with callback for each row
 * Useful for large files
 */
export async function streamParseNDJSON<T = any>(
  response: Response,
  onRow: (row: T, index: number) => void | Promise<void>,
  options?: {
    maxRows?: number;
  }
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let rowIndex = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Process remaining buffer
        if (buffer.trim()) {
          try {
            const row = JSON.parse(buffer);
            await onRow(row, rowIndex++);
          } catch (e) {
            console.warn('Failed to parse final NDJSON line:', buffer, e);
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const row = JSON.parse(line);
          await onRow(row, rowIndex++);

          if (options?.maxRows && rowIndex >= options.maxRows) {
            reader.cancel();
            return;
          }
        } catch (e) {
          console.warn('Failed to parse NDJSON line:', line, e);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Count total rows in NDJSON without parsing
 */
export function countNDJSONRows(ndjsonText: string): number {
  return ndjsonText.split('\n').filter((line) => line.trim().length > 0).length;
}