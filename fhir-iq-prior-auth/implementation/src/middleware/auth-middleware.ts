import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { providerAttributionService } from '../services/provider-attribution';

// Extend FastifyRequest to include user property
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      sub: string;
      scopes: string[];
      patient?: string;
      practitioner?: string;
      organization?: string;
      iss?: string;
      aud?: string;
      exp?: number;
    };
  }
}

// Hard-coded OAuth clients for POC
const OAUTH_CLIENTS = {
  'smart-ehr-client': {
    secret: 'poc-secret-123',
    allowedScopes: [
      'user/*.read',
      'user/Claim.write',
      'user/ClaimResponse.read',
      'user/Questionnaire.read',
      'user/QuestionnaireResponse.write',
      'system/Claim.write',
      'system/*.read'
    ]
  },
  'patient-app-client': {
    secret: 'poc-secret-456',
    allowedScopes: [
      'patient/*.read',
      'patient/Claim.read',
      'patient/ClaimResponse.read'
    ]
  },
  'system-client': {
    secret: 'poc-secret-789',
    allowedScopes: [
      'system/*.read',
      'system/*.write',
      'system/export'
    ]
  }
};

// JWT secret for POC
const JWT_SECRET = process.env.JWT_SECRET || 'poc-jwt-secret-change-in-production';

/**
 * OAuth middleware plugin for Fastify
 */
export async function authMiddleware(app: FastifyInstance) {
  // Decorate request with user property
  app.decorateRequest('user', null);

  // Add auth hooks
  app.addHook('onRequest', async (request, reply) => {
    // POC Demo Mode: Set mock user for all requests
    if (isPublicEndpoint(request.url)) {
      request.user = {
        sub: 'demo-user',
        scopes: ['system/*.read', 'system/*.write', 'user/*.read', 'user/*.write'],
        practitioner: 'Practitioner/demo-practitioner',
        organization: 'Organization/demo-org'
      };
      return;
    }

    // Extract and validate token
    try {
      const token = extractBearerToken(request);
      if (token) {
        const user = await validateToken(token);
        request.user = user;
      }
    } catch (error) {
      logger.debug('Token validation failed', {
        error: error.message,
        path: request.url
      });
      // Don't fail here - let route handlers decide if auth is required
    }
  });
}

/**
 * Middleware to require authentication for specific routes
 */
export function requireAuth(requiredScopes?: string[]) {
  return async function(request: FastifyRequest, reply: FastifyReply) {
    try {
      // POC Demo: Skip auth for public endpoints
      if (isPublicEndpoint(request.url)) {
        // Create a mock user context for demo purposes
        request.user = {
          sub: 'demo-user',
          scopes: ['system/*.read', 'system/*.write', 'user/*.read', 'user/*.write'],
          practitioner: 'Practitioner/demo-practitioner',
          organization: 'Organization/demo-org'
        };
        return;
      }

      // Check if user is authenticated
      if (!request.user) {
        logger.warn('Unauthorized request - no authentication', {
          path: request.url,
          method: request.method,
          ip: request.ip
        });

        return reply.code(401).send({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'security',
            details: {
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/operation-outcome',
                code: 'UNAUTHORIZED',
                display: 'Unauthorized'
              }]
            },
            diagnostics: 'Authentication required. Please provide a valid Bearer token.'
          }]
        });
      }

      // Check scopes if required
      if (requiredScopes && requiredScopes.length > 0) {
        const hasRequiredScope = checkScopes(request.user.scopes, requiredScopes);

        if (!hasRequiredScope) {
          logger.warn('Forbidden request - insufficient scopes', {
            path: request.url,
            method: request.method,
            userScopes: request.user.scopes,
            requiredScopes,
            userId: request.user.sub
          });

          return reply.code(403).send({
            resourceType: 'OperationOutcome',
            issue: [{
              severity: 'error',
              code: 'forbidden',
              details: {
                coding: [{
                  system: 'http://terminology.hl7.org/CodeSystem/operation-outcome',
                  code: 'FORBIDDEN',
                  display: 'Forbidden'
                }]
              },
              diagnostics: `Insufficient permissions. Required scope(s): ${requiredScopes.join(' or ')}`
            }]
          });
        }
      }

      // Check provider attribution for user scope
      if (request.user.scopes.some(s => s.startsWith('user/'))) {
        const isAttributed = await providerAttributionService.checkAttribution(
          request.user,
          request.body,
          request.params
        );

        if (!isAttributed) {
          logger.warn('Forbidden request - provider not attributed', {
            path: request.url,
            userId: request.user.sub,
            organization: request.user.organization
          });

          return reply.code(403).send({
            resourceType: 'OperationOutcome',
            issue: [{
              severity: 'error',
              code: 'forbidden',
              details: {
                coding: [{
                  system: 'http://fhir-iq.com/CodeSystem/pas-error-codes',
                  code: 'provider-not-attributed',
                  display: 'Provider not attributed to patient'
                }]
              },
              diagnostics: 'Provider is not attributed to the requested patient or resource'
            }]
          });
        }
      }

    } catch (error) {
      logger.error('Auth middleware error', {
        error: error.message,
        path: request.url
      });

      return reply.code(500).send({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Authentication processing error'
        }]
      });
    }
  };
}

/**
 * Check if endpoint is public (no auth required)
 */
function isPublicEndpoint(url: string): boolean {
  // Strip query parameters for matching
  const urlPath = url.split('?')[0];

  // POC Demo Mode: Allow all endpoints without authentication
  // In production, this should be restricted to specific public endpoints
  const pocDemoMode = process.env.POC_DEMO_MODE !== 'false';

  if (pocDemoMode) {
    logger.debug('POC Demo Mode: Bypassing auth for all endpoints', { url, urlPath });
    return true;
  }

  const publicEndpoints = [
    '/health',
    '/metadata',
    '/docs',
    '/openapi',
    '/.well-known',
    '/oauth2/token'
  ];

  return publicEndpoints.some(endpoint => urlPath.startsWith(endpoint));
}

/**
 * Extract Bearer token from request
 */
function extractBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Validate JWT token
 */
async function validateToken(token: string): Promise<any> {
  try {
    // For POC, decode and validate JWT
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Validate token structure
    if (!decoded.sub || !decoded.scopes || !Array.isArray(decoded.scopes)) {
      throw new Error('Invalid token structure');
    }

    // Validate client exists
    if (decoded.client_id && !OAUTH_CLIENTS[decoded.client_id]) {
      throw new Error('Unknown OAuth client');
    }

    // Return user context
    return {
      sub: decoded.sub,
      scopes: decoded.scopes,
      patient: decoded.patient,
      practitioner: decoded.practitioner,
      organization: decoded.organization,
      iss: decoded.iss,
      aud: decoded.aud,
      exp: decoded.exp
    };

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Check if user has required scopes
 */
function checkScopes(userScopes: string[], requiredScopes: string[]): boolean {
  if (!userScopes || userScopes.length === 0) {
    return false;
  }

  // Check if user has any of the required scopes
  return requiredScopes.some(required => {
    // Check exact match
    if (userScopes.includes(required)) {
      return true;
    }

    // Check wildcard scopes (e.g., user/*.read matches user/Claim.read)
    const wildcardScopes = userScopes.filter(s => s.includes('*'));
    return wildcardScopes.some(wildcard => {
      const pattern = wildcard.replace('*', '.*');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(required);
    });
  });
}

/**
 * Generate mock JWT token for testing
 */
export function generateMockToken(
  clientId: string,
  scopes: string[],
  additionalClaims?: any
): string {
  const client = OAUTH_CLIENTS[clientId];
  if (!client) {
    throw new Error(`Unknown client: ${clientId}`);
  }

  // Validate scopes against client's allowed scopes
  const validScopes = scopes.filter(scope =>
    client.allowedScopes.some(allowed => {
      if (allowed.includes('*')) {
        const pattern = allowed.replace('*', '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(scope);
      }
      return allowed === scope;
    })
  );

  const payload = {
    sub: additionalClaims?.sub || `${clientId}-user`,
    scopes: validScopes,
    client_id: clientId,
    iss: 'http://fhir-iq.com',
    aud: 'http://fhir-iq.com/pas',
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    iat: Math.floor(Date.now() / 1000),
    ...additionalClaims
  };

  return jwt.sign(payload, JWT_SECRET);
}
