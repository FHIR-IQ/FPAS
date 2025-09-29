/**
 * DTR Launch Routes
 *
 * Handles SMART app launch for DTR questionnaires triggered by CRD hooks.
 * Implements SMART on FHIR launch flow for seamless EHR integration.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger';
import { DTRService } from '../services/dtr-prepopulation.service';

interface DTRLaunchParams {
  iss: string;        // FHIR server issuer
  launch: string;     // Launch token
  patient?: string;   // Patient ID
  order?: string;     // Order ID that triggered DTR
  code?: string;      // Procedure/medication code
}

interface SmartConfiguration {
  authorization_endpoint: string;
  token_endpoint: string;
  introspection_endpoint?: string;
  revocation_endpoint?: string;
  scopes_supported: string[];
  response_types_supported: string[];
  capabilities: string[];
}

/**
 * DTR Launch Routes Handler
 */
export class DTRLaunchRoutes {
  private dtrService: DTRService;

  constructor(dtrService: DTRService) {
    this.dtrService = dtrService;
  }

  /**
   * Register DTR launch routes
   */
  async register(server: FastifyInstance): Promise<void> {
    // DTR application launch endpoint
    server.get('/dtr-launch', async (request: FastifyRequest, reply: FastifyReply) => {
      return await this.handleDTRLaunch(request, reply);
    });

    // SMART configuration endpoint
    server.get('/.well-known/smart-configuration', async (request, reply) => {
      return this.getSmartConfiguration();
    });

    // DTR questionnaire selection
    server.get('/dtr-questionnaire/:orderCode', async (request: FastifyRequest, reply: FastifyReply) => {
      const { orderCode } = request.params as { orderCode: string };
      return await this.getQuestionnaireForOrder(orderCode, request);
    });

    // DTR questionnaire submission
    server.post('/dtr-submit', async (request: FastifyRequest, reply: FastifyReply) => {
      return await this.submitDTRResponse(request, reply);
    });

    logger.info('DTR launch routes registered');
  }

  /**
   * Handle DTR application launch from CRD hooks
   */
  private async handleDTRLaunch(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.query as DTRLaunchParams;

      logger.info('DTR launch initiated', {
        iss: params.iss,
        launch: params.launch,
        patient: params.patient,
        order: params.order,
        code: params.code
      });

      // Validate launch parameters
      if (!params.iss || !params.launch) {
        return reply.code(400).send({
          error: 'missing_parameters',
          error_description: 'Required parameters: iss, launch'
        });
      }

      // In a real implementation, this would:
      // 1. Validate the launch token with the FHIR server
      // 2. Exchange launch context for access token
      // 3. Retrieve patient and order context
      // 4. Launch DTR application UI

      // For POC, return a simplified DTR interface
      const dtrInterface = await this.generateDTRInterface(params);

      return reply.type('text/html').send(dtrInterface);

    } catch (error) {
      logger.error('DTR launch failed', {
        error: error.message,
        query: request.query
      });

      return reply.code(500).send({
        error: 'launch_failed',
        error_description: 'Unable to launch DTR application'
      });
    }
  }

  /**
   * Generate DTR interface HTML
   */
  private async generateDTRInterface(params: DTRLaunchParams): Promise<string> {
    const questionnaire = params.code
      ? await this.dtrService.getQuestionnaireByCode(params.code)
      : await this.dtrService.getDefaultQuestionnaire();

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DTR - Data Collection for Prior Authorization</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .dtr-container {
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .context-info {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            margin-bottom: 20px;
        }
        .question-group {
            margin-bottom: 25px;
            padding: 20px;
            border: 1px solid #e9ecef;
            border-radius: 6px;
        }
        .question-title {
            font-weight: 600;
            margin-bottom: 10px;
            color: #212529;
        }
        .form-control {
            width: 100%;
            padding: 10px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 14px;
        }
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            text-decoration: none;
            display: inline-block;
            margin-right: 10px;
        }
        .btn-primary {
            background-color: #007bff;
            color: white;
        }
        .btn-secondary {
            background-color: #6c757d;
            color: white;
        }
        .form-actions {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
        }
        .error {
            color: #dc3545;
            font-size: 14px;
            margin-top: 5px;
        }
        .success {
            color: #28a745;
            background: #d4edda;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="dtr-container">
        <div class="header">
            <h1>Data Collection for Prior Authorization</h1>
            <p>Complete this questionnaire to support your prior authorization request</p>
        </div>

        <div class="context-info">
            <strong>Order Context:</strong><br>
            Patient: ${params.patient || 'Not specified'}<br>
            Order: ${params.order || 'Not specified'}<br>
            Procedure/Service: ${params.code || 'Not specified'}<br>
            FHIR Server: ${params.iss}
        </div>

        <form id="dtr-form" onsubmit="submitDTR(event)">
            <div class="question-group">
                <div class="question-title">
                    Has the patient tried and failed conservative treatment for this condition?
                </div>
                <select name="failedConservativeTx" class="form-control" required>
                    <option value="">Please select...</option>
                    <option value="true">Yes, conservative treatment was tried and failed</option>
                    <option value="false">No, conservative treatment has not been attempted</option>
                </select>
            </div>

            <div class="question-group">
                <div class="question-title">
                    Does the patient have neurological deficits?
                </div>
                <select name="neuroDeficit" class="form-control" required>
                    <option value="">Please select...</option>
                    <option value="true">Yes, patient has neurological deficits</option>
                    <option value="false">No neurological deficits present</option>
                </select>
            </div>

            <div class="question-group">
                <div class="question-title">
                    Clinical notes and supporting documentation
                </div>
                <textarea name="clinicalNotes" class="form-control" rows="4"
                          placeholder="Provide additional clinical context, test results, or other supporting information..."></textarea>
            </div>

            <div class="question-group">
                <div class="question-title">
                    Expected duration of treatment/equipment use
                </div>
                <select name="treatmentDuration" class="form-control">
                    <option value="">Please select...</option>
                    <option value="short">Less than 30 days</option>
                    <option value="medium">30-90 days</option>
                    <option value="long">More than 90 days</option>
                    <option value="permanent">Permanent/ongoing</option>
                </select>
            </div>

            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Submit DTR Response</button>
                <button type="button" class="btn btn-secondary" onclick="saveDraft()">Save Draft</button>
            </div>
        </form>
    </div>

    <script>
        async function submitDTR(event) {
            event.preventDefault();

            const formData = new FormData(event.target);
            const responses = {};

            for (let [key, value] of formData.entries()) {
                responses[key] = value;
            }

            try {
                const response = await fetch('/dtr-submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        patient: '${params.patient}',
                        order: '${params.order}',
                        code: '${params.code}',
                        responses: responses,
                        launchContext: {
                            iss: '${params.iss}',
                            launch: '${params.launch}'
                        }
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    alert('DTR questionnaire submitted successfully! QuestionnaireResponse ID: ' + result.id);

                    // Close DTR app or redirect back to EHR
                    if (window.parent !== window) {
                        window.parent.postMessage({ type: 'dtr-complete', result: result }, '*');
                    }
                } else {
                    const error = await response.json();
                    alert('Submission failed: ' + error.message);
                }
            } catch (error) {
                alert('Network error: ' + error.message);
            }
        }

        function saveDraft() {
            const formData = new FormData(document.getElementById('dtr-form'));
            const responses = {};

            for (let [key, value] of formData.entries()) {
                responses[key] = value;
            }

            localStorage.setItem('dtr-draft-${params.order}', JSON.stringify(responses));
            alert('Draft saved successfully');
        }

        // Load draft if exists
        window.onload = function() {
            const draft = localStorage.getItem('dtr-draft-${params.order}');
            if (draft) {
                const responses = JSON.parse(draft);
                const form = document.getElementById('dtr-form');

                for (let [key, value] of Object.entries(responses)) {
                    const element = form.elements[key];
                    if (element) {
                        element.value = value;
                    }
                }
            }
        };
    </script>
</body>
</html>`;
  }

  /**
   * Get SMART configuration for DTR app
   */
  private getSmartConfiguration(): SmartConfiguration {
    const baseUrl = process.env.BASE_URL || 'https://fhir-iq-pas.example.com';

    return {
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      introspection_endpoint: `${baseUrl}/oauth/introspect`,
      scopes_supported: [
        'patient/*.read',
        'user/*.read',
        'user/Questionnaire.read',
        'user/QuestionnaireResponse.write',
        'launch'
      ],
      response_types_supported: ['code'],
      capabilities: [
        'launch-ehr',
        'launch-standalone',
        'client-public',
        'client-confidential-symmetric',
        'context-ehr-patient',
        'context-ehr-encounter',
        'sso-openid-connect'
      ]
    };
  }

  /**
   * Get questionnaire for specific order code
   */
  private async getQuestionnaireForOrder(orderCode: string, request: FastifyRequest) {
    try {
      logger.info('Fetching questionnaire for order code', { orderCode });

      const questionnaire = await this.dtrService.getQuestionnaireByCode(orderCode);

      if (!questionnaire) {
        return {
          error: 'questionnaire_not_found',
          message: `No DTR questionnaire found for order code: ${orderCode}`
        };
      }

      return questionnaire;

    } catch (error) {
      logger.error('Failed to fetch questionnaire', {
        error: error.message,
        orderCode
      });

      return {
        error: 'questionnaire_error',
        message: 'Unable to fetch questionnaire'
      };
    }
  }

  /**
   * Submit DTR questionnaire response
   */
  private async submitDTRResponse(request: FastifyRequest, reply: FastifyReply) {
    try {
      const submission = request.body as {
        patient: string;
        order: string;
        code: string;
        responses: Record<string, string>;
        launchContext: {
          iss: string;
          launch: string;
        };
      };

      logger.info('Processing DTR submission', {
        patient: submission.patient,
        order: submission.order,
        code: submission.code,
        responseCount: Object.keys(submission.responses).length
      });

      // Create QuestionnaireResponse
      const questionnaireResponse = await this.dtrService.createQuestionnaireResponse(
        submission.patient,
        submission.order,
        submission.code,
        submission.responses
      );

      // Store the response (in real implementation, POST to FHIR server)
      logger.info('DTR questionnaire response created', {
        questionnaireResponseId: questionnaireResponse.id,
        patient: submission.patient,
        order: submission.order
      });

      return {
        id: questionnaireResponse.id,
        status: 'completed',
        message: 'DTR questionnaire response submitted successfully',
        nextSteps: 'Prior authorization request will be automatically processed'
      };

    } catch (error) {
      logger.error('DTR submission failed', {
        error: error.message,
        body: request.body
      });

      return reply.code(500).send({
        error: 'submission_failed',
        message: 'Unable to process DTR submission'
      });
    }
  }
}