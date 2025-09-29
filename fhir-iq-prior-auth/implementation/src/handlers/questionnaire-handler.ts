import { logger } from '../utils/logger';

interface SearchContext {
  user?: any;
  correlationId: string;
}

/**
 * Handler for Questionnaire and DTR operations
 */
export class QuestionnaireHandler {
  async search(params: any, context: SearchContext): Promise<any> {
    logger.info('Questionnaire search', { params, correlationId: context.correlationId });

    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 0,
      entry: []
    };
  }

  async readById(id: string, context: SearchContext): Promise<any> {
    logger.info('Questionnaire read', { id, correlationId: context.correlationId });
    return null;
  }

  async populate(id: string, params: any, context: SearchContext): Promise<any> {
    logger.info('Questionnaire populate', { id, correlationId: context.correlationId });

    return {
      resourceType: 'QuestionnaireResponse',
      id: 'mock-response',
      status: 'completed'
    };
  }

  async createResponse(response: any, context: SearchContext): Promise<any> {
    logger.info('QuestionnaireResponse create', { correlationId: context.correlationId });

    return {
      ...response,
      id: 'mock-id'
    };
  }
}

export const questionnaireHandler = new QuestionnaireHandler();