# Implementation Plan - Node.js/TypeScript FHIR PA POC

## Technology Stack

### Core Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Gateway   │───▶│   HAPI FHIR      │───▶│   PostgreSQL    │
│ Node.js/Fastify │    │   JPA Server     │    │   Database      │
│   TypeScript    │    │    (Docker)      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│     Redis       │    │   Mock OAuth     │
│   + BullMQ      │    │   Provider       │
│  (Queues)       │    │  (OpenID Connect)│
└─────────────────┘    └──────────────────┘
```

### Technology Selection

#### API Gateway: Node.js + TypeScript + Fastify
**Why Fastify?**
- High performance (fastest Node.js framework)
- Excellent TypeScript support out of the box
- Built-in schema validation with Ajv
- Plugin ecosystem for FHIR operations
- Native async/await patterns

**Key Libraries:**
```json
{
  "fastify": "^4.24.0",
  "@fastify/swagger": "^8.12.0",
  "@types/fhir": "^0.0.37",
  "fhir": "^4.11.1",
  "ajv": "^8.12.0",
  "bullmq": "^4.15.0",
  "ioredis": "^5.3.2"
}
```

#### FHIR Server: HAPI FHIR JPA Server
**Why HAPI FHIR?**
- Industry standard FHIR R4 implementation
- Complete support for Da Vinci PAS/DTR profiles
- Built-in validation and terminology services
- JPA persistence with PostgreSQL
- Docker deployment ready

**Configuration:**
```yaml
version: '3.8'
services:
  fhir-server:
    image: hapiproject/hapi:v6.8.0
    ports:
      - "8080:8080"
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/fhir
      HAPI_FHIR_VALIDATION_REQUESTS_ENABLED: true
      HAPI_FHIR_OPENAPI_ENABLED: true
```

#### Queue System: BullMQ + Redis
**Why BullMQ?**
- Modern Redis-based queue system
- Excellent TypeScript support
- Built-in retry mechanisms and job scheduling
- Dashboard for monitoring queue health
- Perfect for async PA processing

#### Authentication: Mock OpenID Connect Provider
**Why Mock Provider?**
- Rapid POC development without external dependencies
- Full OAuth 2.0/OIDC compliance for testing
- Easy configuration for SMART on FHIR v2 scopes
- Transition path to production providers

## Project Structure

```
fhir-iq-prior-auth/
├── .specify/                    # Business requirements (existing)
├── specs/                       # FHIR specifications (existing)
├── diagrams/                    # Mermaid diagrams (existing)
├── implementation/
│   ├── api-gateway/            # Node.js/TypeScript API
│   │   ├── src/
│   │   │   ├── controllers/    # PAS operation handlers
│   │   │   ├── middleware/     # OAuth, validation
│   │   │   ├── services/       # Business logic
│   │   │   ├── queues/         # BullMQ workers
│   │   │   ├── types/          # TypeScript types
│   │   │   └── utils/          # Helpers
│   │   ├── tests/              # Unit and integration tests
│   │   ├── docker/             # Docker configuration
│   │   └── docs/               # API documentation
│   ├── fhir-server/            # HAPI FHIR configuration
│   ├── oauth-mock/             # Mock OAuth provider
│   ├── test-fixtures/          # Test data and scenarios
│   └── scripts/                # Setup and deployment scripts
└── docs/                       # Generated documentation
```

## Development Environment Setup

### Prerequisites
```bash
# Required tools
node --version    # v18.18.0+
npm --version     # v9.8.0+
docker --version  # v20.10.0+
java --version    # v11+ (for FHIR validator)
```

### Initial Setup
```bash
# Clone and setup
git clone <repository>
cd fhir-iq-prior-auth/implementation

# Start infrastructure
docker-compose up -d postgres redis fhir-server oauth-mock

# Install API gateway dependencies
cd api-gateway
npm install
npm run build

# Start development server
npm run dev
```

## Implementation Phases

### Phase 1: Foundation Setup (Week 1)

#### 1.1 Project Scaffolding
```bash
mkdir -p implementation/api-gateway/src/{controllers,middleware,services,queues,types,utils}
mkdir -p implementation/api-gateway/tests/{unit,integration}
mkdir -p implementation/fhir-server/config
mkdir -p implementation/oauth-mock/config
```

#### 1.2 Core Dependencies
```json
{
  "dependencies": {
    "fastify": "^4.24.0",
    "@fastify/swagger": "^8.12.0",
    "@fastify/swagger-ui": "^2.1.0",
    "@fastify/oauth2": "^7.5.0",
    "fhir": "^4.11.1",
    "@types/fhir": "^0.0.37",
    "bullmq": "^4.15.0",
    "ioredis": "^5.3.2",
    "ajv": "^8.12.0",
    "ajv-formats": "^2.1.1"
  },
  "devDependencies": {
    "@types/node": "^20.8.0",
    "typescript": "^5.2.0",
    "ts-node": "^10.9.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.5",
    "supertest": "^6.3.3"
  }
}
```

#### 1.3 Docker Compose Configuration
```yaml
# implementation/docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: fhir
      POSTGRES_USER: fhir_user
      POSTGRES_PASSWORD: fhir_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  fhir-server:
    image: hapiproject/hapi:v6.8.0
    ports:
      - "8080:8080"
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/fhir
      SPRING_DATASOURCE_USERNAME: fhir_user
      SPRING_DATASOURCE_PASSWORD: fhir_pass
      HAPI_FHIR_VALIDATION_REQUESTS_ENABLED: true
      HAPI_FHIR_OPENAPI_ENABLED: true
    depends_on:
      - postgres

  oauth-mock:
    image: ghcr.io/navikt/mock-oauth2-server:0.5.8
    ports:
      - "9000:9000"
    environment:
      JSON_CONFIG: |
        {
          "interactiveLogin": true,
          "httpServer": "NettyWrapper",
          "tokenCallbacks": [
            {
              "issuerId": "default",
              "tokenExpiry": 3600,
              "requestMappings": [
                {
                  "requestParam": "scope",
                  "match": "user/*.read",
                  "claims": {
                    "scope": "user/Claim.read user/ClaimResponse.read",
                    "aud": "fhir-iq-pas"
                  }
                }
              ]
            }
          ]
        }

volumes:
  postgres_data:
  redis_data:
```

### Phase 2: FHIR Operations (Week 2)

#### 2.1 CapabilityStatement Generation
```typescript
// src/services/capability-service.ts
import { CapabilityStatement } from 'fhir/r4';

export class CapabilityStatementService {
  generatePASCapability(): CapabilityStatement {
    return {
      resourceType: 'CapabilityStatement',
      status: 'active',
      kind: 'instance',
      implementation: {
        description: 'FHIR IQ Prior Authorization Service'
      },
      fhirVersion: '4.0.1',
      format: ['application/fhir+json'],
      rest: [{
        mode: 'server',
        resource: [{
          type: 'Claim',
          operation: [{
            name: 'submit',
            definition: 'http://hl7.org/fhir/us/davinci-pas/OperationDefinition/Claim-submit'
          }, {
            name: 'inquire',
            definition: 'http://hl7.org/fhir/us/davinci-pas/OperationDefinition/Claim-inquire'
          }]
        }]
      }]
    };
  }
}
```

#### 2.2 Operation Definitions
```typescript
// src/types/operations.ts
export interface ClaimSubmitRequest {
  resourceType: 'Parameters';
  parameter: Array<{
    name: string;
    resource: any;
  }>;
}

export interface ClaimSubmitResponse {
  resourceType: 'Bundle';
  type: 'collection';
  entry: Array<{
    resource: any;
  }>;
}
```

### Phase 3: PAS Controllers (Week 3)

#### 3.1 Claim/$submit Controller
```typescript
// src/controllers/pas-controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { Bundle, Claim, ClaimResponse } from 'fhir/r4';

export class PASController {
  async submitClaim(request: FastifyRequest, reply: FastifyReply) {
    try {
      const bundle = request.body as Bundle;

      // Validate PAS Bundle
      const validation = await this.validatePASBundle(bundle);
      if (!validation.valid) {
        return reply.code(400).send(validation.operationOutcome);
      }

      // Extract claim from bundle
      const claim = this.extractClaim(bundle);

      // Queue for UM processing
      const job = await this.queueService.addPARequest({
        claim,
        bundle,
        requestId: request.id
      });

      // Return async response
      if (request.headers.prefer === 'respond-async') {
        return reply.code(202).send({
          resourceType: 'Task',
          status: 'requested',
          id: job.id
        });
      }

      // Synchronous response (for simple cases)
      const decision = await this.umService.processPA(claim);
      const response = this.buildClaimResponse(claim, decision);

      return reply.send(response);
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  async inquireClaim(request: FastifyRequest, reply: FastifyReply) {
    // Implementation for Claim/$inquire
  }
}
```

#### 3.2 Queue Worker Implementation
```typescript
// src/queues/pa-worker.ts
import { Worker, Job } from 'bullmq';
import { UMService } from '../services/um-service';

interface PAJobData {
  claim: any;
  bundle: any;
  requestId: string;
}

export class PAWorker {
  private worker: Worker;

  constructor(private umService: UMService) {
    this.worker = new Worker('pa-requests', this.processJob.bind(this), {
      connection: { host: 'localhost', port: 6379 }
    });
  }

  async processJob(job: Job<PAJobData>) {
    const { claim, bundle, requestId } = job.data;

    try {
      // Update job progress
      await job.updateProgress(25);

      // Apply UM rules
      const decision = await this.umService.processPA(claim);
      await job.updateProgress(75);

      // Generate response
      const response = this.buildResponse(claim, decision);
      await job.updateProgress(100);

      return response;
    } catch (error) {
      throw new Error(`PA processing failed: ${error.message}`);
    }
  }
}
```

### Phase 4: DTR Integration (Week 4)

#### 4.1 DTR Service Implementation
```typescript
// src/services/dtr-service.ts
export class DTRService {
  async getQuestionnaire(serviceType: string): Promise<any> {
    // Load questionnaire from FHIR server
    const questionnaire = await this.fhirClient.read({
      resourceType: 'Questionnaire',
      id: `imaging-${serviceType}`
    });

    return questionnaire;
  }

  async executeCQL(libraryUrl: string, patientId: string): Promise<any> {
    // Mock CQL execution for POC
    return {
      ExistsFailedConservativeTx: true,
      HasNeuroDeficit: false,
      HasPriorLumbarImaging: false,
      HasRedFlagSymptoms: false
    };
  }

  async prepopulateQuestionnaire(questionnaireId: string, patientId: string): Promise<any> {
    const cqlResults = await this.executeCQL('imaging-lumbar-mri', patientId);

    // Build prepopulated response
    return {
      resourceType: 'QuestionnaireResponse',
      questionnaire: questionnaireId,
      status: 'in-progress',
      subject: { reference: `Patient/${patientId}` },
      item: [
        {
          linkId: 'failed-conservative',
          answer: [{ valueBoolean: cqlResults.ExistsFailedConservativeTx }]
        },
        {
          linkId: 'neuro-deficit',
          answer: [{ valueBoolean: cqlResults.HasNeuroDeficit }]
        }
      ]
    };
  }
}
```

### Phase 5: OAuth & Security (Week 5)

#### 5.1 OAuth Middleware
```typescript
// src/middleware/oauth-middleware.ts
import { FastifyRequest, FastifyReply } from 'fastify';

export class OAuthMiddleware {
  async verifyToken(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'login',
          details: { text: 'Bearer token required' }
        }]
      });
    }

    const token = authHeader.substring(7);
    try {
      const decoded = await this.validateToken(token);
      request.user = decoded;
    } catch (error) {
      return reply.code(401).send(this.buildAuthError());
    }
  }

  async checkScope(requiredScope: string) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const userScopes = request.user?.scope?.split(' ') || [];
      if (!this.hasScope(userScopes, requiredScope)) {
        return reply.code(403).send(this.buildScopeError(requiredScope));
      }
    };
  }
}
```

### Phase 6: Testing Framework (Week 6)

#### 6.1 Unit Tests
```typescript
// tests/unit/pas-controller.test.ts
import { PASController } from '../../src/controllers/pas-controller';

describe('PASController', () => {
  let controller: PASController;

  beforeEach(() => {
    controller = new PASController();
  });

  test('should validate PAS bundle', async () => {
    const bundle = loadTestFixture('pas-request-bundle.json');
    const result = await controller.validatePASBundle(bundle);
    expect(result.valid).toBe(true);
  });

  test('should return 400 for invalid bundle', async () => {
    const invalidBundle = { resourceType: 'Bundle', entry: [] };
    const result = await controller.validatePASBundle(invalidBundle);
    expect(result.valid).toBe(false);
    expect(result.operationOutcome.issue[0].code).toBe('invalid');
  });
});
```

#### 6.2 Integration Tests
```typescript
// tests/integration/pas-workflow.test.ts
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';

describe('PA Workflow Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  test('end-to-end PA submission', async () => {
    const bundle = loadTestFixture('pas-request-bundle.json');

    const response = await app.inject({
      method: 'POST',
      url: '/fhir/Claim/$submit',
      payload: bundle,
      headers: {
        'content-type': 'application/fhir+json',
        'authorization': 'Bearer test-token'
      }
    });

    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.payload);
    expect(result.resourceType).toBe('ClaimResponse');
    expect(result.disposition).toBe('Approved');
  });
});
```

## Development Workflow

### Local Development
```bash
# Start services
docker-compose up -d

# Run in development mode with hot reload
npm run dev

# Run tests
npm test
npm run test:integration

# Validate FHIR resources
npm run validate-fhir

# Check code quality
npm run lint
npm run type-check
```

### CI/CD Pipeline
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm run validate-fhir
      - run: npm run test:integration
```

## Performance Targets

### Response Time SLAs
- **Synchronous Operations**: < 2 seconds
- **Search Operations**: < 1 second
- **Questionnaire Load**: < 2 seconds
- **CQL Execution**: < 1 second

### Concurrent Load
- **PA Submissions**: 10 concurrent requests
- **Status Queries**: 50 concurrent requests
- **Queue Processing**: 5 jobs per second

## Monitoring & Observability

### Application Metrics
```typescript
// src/utils/metrics.ts
export class MetricsService {
  trackPASubmission(duration: number, outcome: string) {
    // Track submission metrics
  }

  trackQueueDepth(queueName: string, depth: number) {
    // Monitor queue health
  }
}
```

### Health Checks
```typescript
// src/routes/health.ts
export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        fhir: await this.checkFHIRServer(),
        redis: await this.checkRedis(),
        postgres: await this.checkDatabase()
      }
    };
  });
}
```

This implementation plan provides a comprehensive roadmap for building the FHIR Prior Authorization POC using the specified technology stack, with clear phases, deliverables, and success criteria.