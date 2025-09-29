/**
 * Vercel Serverless Function Entry Point
 *
 * Adapts the Fastify application for Vercel's serverless environment
 */

import { buildApp } from '../src/app';

let app: any;

export default async function handler(req: any, res: any) {
  // Initialize app if not already done
  if (!app) {
    app = await buildApp();
    await app.ready();
  }

  // Inject the request and response into Fastify
  await app.server.emit('request', req, res);
}