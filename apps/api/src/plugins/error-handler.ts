import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { AppError, ErrorCodes } from '../lib/errors.js';
import type { FastifyPluginAsync } from 'fastify';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface FastifyValidationError {
  validation?: unknown;
  validationContext?: string;
  statusCode?: number;
  message: string;
}

function isFastifyValidationError(
  err: unknown,
): err is FastifyValidationError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'validation' in err &&
    Array.isArray((err as FastifyValidationError).validation)
  );
}

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error);

    // AppError — our custom errors
    if (error instanceof AppError) {
      const response: ErrorResponse = {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      };
      return reply.status(error.statusCode).send(response);
    }

    // ZodError — validation errors
    if (error instanceof ZodError) {
      const response: ErrorResponse = {
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Validation failed',
          details: error.issues,
        },
      };
      return reply.status(400).send(response);
    }

    // Fastify validation errors (from schema validation)
    if (isFastifyValidationError(error)) {
      const response: ErrorResponse = {
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: error.message,
          details: error.validation,
        },
      };
      return reply.status(400).send(response);
    }

    // Unknown errors
    const isProduction = fastify.config.NODE_ENV === 'production';
    const errMessage =
      error instanceof Error ? error.message : 'Internal server error';
    const errStatusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof (error as { statusCode: unknown }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : 500;

    const response: ErrorResponse = {
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: isProduction ? 'An unexpected error occurred' : errMessage,
      },
    };

    return reply.status(errStatusCode).send(response);
  });

  fastify.setNotFoundHandler((_request, reply) => {
    const response: ErrorResponse = {
      error: {
        code: ErrorCodes.NOT_FOUND,
        message: 'Route not found',
      },
    };
    return reply.status(404).send(response);
  });

  fastify.log.info('Error handler plugin registered');
};

export default fp(errorHandlerPlugin, {
  name: 'error-handler',
});
