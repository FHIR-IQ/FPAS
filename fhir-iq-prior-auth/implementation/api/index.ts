/**
 * Vercel Serverless Function Entry Point
 *
 * Adapts the Fastify application for Vercel's serverless environment
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { buildApp } from '../src/app';
import getRawBody from 'raw-body';

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
 * Vercel serverless handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const fastifyApp = await getApp();

    console.log('[Vercel Handler] Request:', req.method, req.url);
    console.log('[Vercel Handler] Content-Type:', req.headers['content-type']);

    // Get the payload - Vercel parses application/json but not application/fhir+json
    let payload: string | undefined;

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body && typeof req.body === 'object') {
        // Vercel already parsed the body (for application/json)
        payload = JSON.stringify(req.body);
        console.log('[Vercel Handler] Using pre-parsed body');
      } else if (req.body && typeof req.body === 'string') {
        // Body is already a string
        payload = req.body;
        console.log('[Vercel Handler] Using string body');
      } else {
        // Need to read raw body (for application/fhir+json)
        try {
          const rawBody = await getRawBody(req, {
            length: req.headers['content-length'],
            limit: '10mb',
            encoding: 'utf-8'
          });
          payload = rawBody;
          console.log('[Vercel Handler] Read raw body, length:', rawBody.length);
        } catch (err) {
          console.log('[Vercel Handler] Failed to read raw body:', err);
        }
      }
    }

    console.log('[Vercel Handler] Payload preview:', payload?.substring(0, 200));

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

// Disable Vercel's body parser to handle FHIR content types manually
export const config = {
  api: {
    bodyParser: false,
  },
};