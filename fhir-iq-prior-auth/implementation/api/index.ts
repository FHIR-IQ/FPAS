/**
 * Vercel Serverless Function Entry Point
 *
 * Adapts the Fastify application for Vercel's serverless environment
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { buildApp } from '../src/app';

let app: any;

// POC Demo Mode - set environment variable
process.env.POC_DEMO_MODE = 'true';

/**
 * Initialize app on cold start
 */
async function getApp() {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

/**
 * Read raw body from request stream
 */
async function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      resolve(data);
    });
    req.on('error', reject);
  });
}

/**
 * Vercel serverless handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const fastifyApp = await getApp();

    console.log('[Vercel Handler] Request:', req.method, req.url);

    // Get the body - either from req.body (if pre-parsed) or from raw stream
    let payload: any = req.body;
    if (payload === undefined && req.method !== 'GET' && req.method !== 'HEAD') {
      const rawBody = await getRawBody(req);
      console.log('[Vercel Handler] Raw body length:', rawBody.length);
      if (rawBody) {
        try {
          payload = JSON.parse(rawBody);
        } catch {
          payload = rawBody;
        }
      }
    }

    console.log('[Vercel Handler] Body type:', typeof payload);
    console.log('[Vercel Handler] Body preview:', JSON.stringify(payload)?.substring(0, 200));

    // Use Fastify's inject method for serverless compatibility
    const response = await fastifyApp.inject({
      method: req.method as any,
      url: req.url || '/',
      headers: req.headers as any,
      payload: payload,
      query: req.query as any
    });

    console.log('[Vercel Handler] Response status:', response.statusCode);
    if (response.statusCode >= 400) {
      console.log('[Vercel Handler] Error response:', response.body?.substring(0, 500));
    }

    // Set response headers
    Object.keys(response.headers).forEach(key => {
      res.setHeader(key, response.headers[key]);
    });

    // Send response
    res.status(response.statusCode).send(response.body);
  } catch (error) {
    console.error('Serverless function error:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'fatal',
        code: 'exception',
        diagnostics: error instanceof Error ? error.message : 'Unknown error'
      }]
    });
  }
}

// Disable body parsing to handle it manually
export const config = {
  api: {
    bodyParser: false,
  },
};