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
 * Vercel serverless handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const fastifyApp = await getApp();

    console.log('[Vercel Handler] Request:', req.method, req.url);

    // Use Fastify's inject method for serverless compatibility
    const response = await fastifyApp.inject({
      method: req.method as any,
      url: req.url || '/',
      headers: req.headers as any,
      payload: req.body,
      query: req.query as any
    });

    console.log('[Vercel Handler] Response status:', response.statusCode);

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