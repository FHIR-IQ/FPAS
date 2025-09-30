import { config } from './config';

export interface CdsClientOptions extends Omit<RequestInit, 'body'> {
  token?: string;
  body?: any; // Allow any JSON object for body
}

export interface CdsResponse<T = any> {
  ok: boolean;
  status: number;
  headers: Headers;
  json: T | null;
}

/**
 * CDS Hooks API client
 */
export async function cdsFetch<T = any>(
  path: string,
  init?: CdsClientOptions
): Promise<CdsResponse<T>> {
  const { token, body, ...fetchInit } = init || {};

  const url = path.startsWith('http') ? path : `${config.cdsBase}${path}`;

  const headers = new Headers(fetchInit.headers);
  headers.set('Accept', 'application/json');
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Stringify body if it's an object
  const requestBody = body && typeof body === 'object' ? JSON.stringify(body) : body;

  try {
    const response = await fetch(url, {
      ...fetchInit,
      headers,
      body: requestBody,
    });

    let json = null;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        json = await response.json();
      } catch (e) {
        console.warn('Failed to parse JSON response:', e);
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      json,
    };
  } catch (error) {
    console.error('CDS fetch error:', error);
    throw error;
  }
}

/**
 * Build cURL command for CDS Hooks requests
 */
export function buildCdsCurlCommand(
  path: string,
  init?: CdsClientOptions
): string {
  const { token, method = 'GET', body } = init || {};
  const url = path.startsWith('http') ? path : `${config.cdsBase}${path}`;

  let curl = `curl -X ${method} '${url}'`;
  curl += ` \\\n  -H 'Accept: application/json'`;
  curl += ` \\\n  -H 'Content-Type: application/json'`;

  if (token) {
    curl += ` \\\n  -H 'Authorization: Bearer ${token}'`;
  }

  if (body) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(JSON.parse(body as string), null, 2);
    curl += ` \\\n  -d '${bodyStr}'`;
  }

  return curl;
}