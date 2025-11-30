import { config } from './config';

export interface FhirFetchOptions extends Omit<RequestInit, 'body'> {
  token?: string;
  body?: any; // Allow any JSON object for body
}

export interface FhirResponse<T = any> {
  ok: boolean;
  status: number;
  headers: Headers;
  json: T | null;
}

/**
 * FHIR API client with automatic base URL and headers
 */
export async function fhirFetch<T = any>(
  path: string,
  init?: FhirFetchOptions
): Promise<FhirResponse<T>> {
  const { token, body, ...fetchInit } = init || {};

  const url = path.startsWith('http') ? path : `${config.fhirBase}${path}`;

  const headers = new Headers(fetchInit.headers);
  headers.set('Accept', 'application/fhir+json');
  headers.set('Content-Type', 'application/fhir+json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Stringify body if it's an object
  let requestBody: string | undefined;
  if (body) {
    requestBody = typeof body === 'string' ? body : JSON.stringify(body);
    console.log('[fhirFetch] Request body type:', typeof requestBody);
    console.log('[fhirFetch] Request body preview:', requestBody.substring(0, 200));
  }

  try {
    console.log('[fhirFetch] Fetching:', url, fetchInit.method || 'GET');
    const response = await fetch(url, {
      ...fetchInit,
      headers,
      body: requestBody,
    });

    let json = null;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json') || contentType?.includes('application/fhir+json')) {
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
    console.error('FHIR fetch error:', error);
    throw error;
  }
}

/**
 * Helper to build cURL command for debugging
 */
export function buildCurlCommand(
  path: string,
  init?: FhirFetchOptions
): string {
  const { token, method = 'GET', body, ...rest } = init || {};
  const url = path.startsWith('http') ? path : `${config.fhirBase}${path}`;

  let curl = `curl -X ${method} '${url}'`;
  curl += ` \\\n  -H 'Accept: application/fhir+json'`;
  curl += ` \\\n  -H 'Content-Type: application/fhir+json'`;

  if (token) {
    curl += ` \\\n  -H 'Authorization: Bearer ${token}'`;
  }

  if (body) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    curl += ` \\\n  -d '${bodyStr}'`;
  }

  return curl;
}